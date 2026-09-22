import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError } from "./api";
import { PDF_LIMITS } from "./document-types";

export const R2_URL_LIFETIME_SECONDS = 600;

function createStorage() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId) || !bucket || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || !accessKeyId || !secretAccessKey) {
    throw new ApiError(503, "PDF 저장소 연결이 설정되지 않았습니다.");
  }
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
      followRegionRedirects: false,
      maxAttempts: 1,
      requestChecksumCalculation: "WHEN_REQUIRED",
      requestHandler: { connectionTimeout: 5000, requestTimeout: PDF_LIMITS.storageTransferTimeoutMs, throwOnRequestTimeout: true },
    }),
  };
}

export async function putPdf(storageKey: string, content: Uint8Array, options?: { ifAbsent?: boolean }): Promise<void> {
  if (!content.byteLength || content.byteLength > PDF_LIMITS.maxBytes) throw new ApiError(413, "PDF 파일 크기를 확인해주세요.");
  const { client, bucket } = createStorage();
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: content, ContentType: "application/pdf", ContentLength: content.byteLength, ...(options?.ifAbsent ? { IfNoneMatch: "*" } : {}) }), {
      abortSignal: AbortSignal.timeout(PDF_LIMITS.storageTransferTimeoutMs),
    });
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 412) throw new ApiError(409, "이미 저장된 PDF 파일입니다.");
    throw new ApiError(502, "PDF를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  finally { client.destroy(); }
}

export async function deletePdf(storageKey: string): Promise<void> {
  const { client, bucket } = createStorage();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }), { abortSignal: AbortSignal.timeout(PDF_LIMITS.uploadTimeoutMs) });
  } catch { throw new ApiError(502, "PDF 파일을 정리하지 못했습니다. 잠시 후 다시 시도해주세요."); }
  finally { client.destroy(); }
}

export async function getPdfUploadUrl(storageKey: string, byteLength: number): Promise<string> {
  const { client, bucket } = createStorage();
  try {
    return await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: "application/pdf", ContentLength: byteLength }), {
      expiresIn: R2_URL_LIFETIME_SECONDS,
      signableHeaders: new Set(["content-type", "content-length"]),
    });
  } catch { throw new ApiError(502, "PDF 업로드를 준비하지 못했습니다. 잠시 후 다시 시도해주세요."); }
  finally { client.destroy(); }
}

export async function getPdfUrl(storageKey: string, filename: string): Promise<string> {
  const { client, bucket } = createStorage();
  const safeFilename = filename.toWellFormed().replace(/[\\/\u0000-\u001f\u007f]/g, "_");
  const encodedFilename = encodeURIComponent(safeFilename).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  try {
    return await getSignedUrl(client, new GetObjectCommand({
      Bucket: bucket, Key: storageKey,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `attachment; filename="paper.pdf"; filename*=UTF-8''${encodedFilename}`,
    }), { expiresIn: R2_URL_LIFETIME_SECONDS });
  } catch { throw new ApiError(502, "PDF 다운로드를 준비하지 못했습니다. 잠시 후 다시 시도해주세요."); }
  finally { client.destroy(); }
}

export async function getPdf(storageKey: string): Promise<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(await getPdfUrl(storageKey, "paper.pdf"), {
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(PDF_LIMITS.storageTransferTimeoutMs),
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      if (response.status === 404) throw new ApiError(404, "PDF 파일을 찾을 수 없습니다.");
      throw new ApiError(502, "PDF 파일을 불러오지 못했습니다. 파일 업로드 후 다시 시도해주세요.");
    }
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    // 응답 헤더가 없거나 잘못되어도 실제로 읽은 바이트 수로 제한합니다.
    if (Number(response.headers.get("content-length")) > PDF_LIMITS.maxBytes) throw new ApiError(413, "PDF 파일 크기가 허용 범위를 초과합니다.");
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      byteLength += result.value.byteLength;
      if (byteLength > PDF_LIMITS.maxBytes) throw new ApiError(413, "PDF 파일 크기가 허용 범위를 초과합니다.");
      chunks.push(result.value);
    }
    if (!byteLength) throw new ApiError(422, "비어 있는 PDF 파일은 사용할 수 없습니다.");
    const content = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.byteLength; }
    return content;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "PDF 파일을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    if (reader) { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
}
