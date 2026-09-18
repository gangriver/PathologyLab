import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { z } from "zod";
import { ApiError, assertMutationOrigin } from "./api";
import { PDF_LIMITS, type ExtractedPdf } from "./document-types";
import { paperSchema } from "./validation";

let activeParsers = 0;
const extractionSchema = z.object({
  pages: z.array(z.object({ pageNumber: z.number().int().positive(), text: z.string() })),
  pageCount: z.number().int().positive(),
  textCharacters: z.number().int().nonnegative(),
  basicInfo: z.object({
    title: paperSchema.shape.title.catch(""),
    authors: paperSchema.shape.authors.catch(""),
    url: paperSchema.shape.url.catch(""),
  }).catch({ title: "", authors: "", url: "" }),
});
export async function readPdfUpload(request: Request) {
  assertMutationOrigin(request);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;")) throw new ApiError(415, "PDF 파일을 선택해주세요.");
  const maxBodyBytes = PDF_LIMITS.maxBytes + 64 * 1024;
  const maxSizeMB = PDF_LIMITS.maxBytes / 1024 / 1024;
  const sizeError = `PDF는 ${maxSizeMB}MB 이하로 업로드해주세요.`;
  if (Number(request.headers.get("content-length") ?? 0) > maxBodyBytes) throw new ApiError(413, sizeError);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "업로드할 파일이 없습니다.");
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      totalBytes += part.value.length;
      if (totalBytes > maxBodyBytes) { await reader.cancel(); throw new ApiError(413, sizeError); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  let form: FormData;
  try { form = await new Response(body, { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new ApiError(400, "파일 업로드 형식을 확인해주세요."); }
  const file = form.get("file");
  if (!(file instanceof File) || form.getAll("file").length !== 1) throw new ApiError(400, "PDF 파일 한 개를 선택해주세요.");
  if (!file.size || file.size > PDF_LIMITS.maxBytes) throw new ApiError(413, `비어 있지 않은 ${maxSizeMB}MB 이하의 PDF를 선택해주세요.`);
  if (!/\.pdf$/i.test(file.name) || !["", "application/pdf", "application/octet-stream"].includes(file.type)) throw new ApiError(415, "PDF 형식의 파일만 업로드할 수 있습니다.");
  const content = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(content.subarray(0, 5)) !== "%PDF-") throw new ApiError(415, "올바른 PDF 파일이 아닙니다.");
  const filename = Array.from(file.name.replace(/[\\/\u0000-\u001f\u007f]/g, "_")).slice(-200).join("");
  const rawRevision = form.get("revision");
  const revision = rawRevision === null ? undefined : Number(rawRevision);
  if (revision !== undefined && (!Number.isInteger(revision) || revision < 1)) throw new ApiError(422, "논문 버전을 확인해주세요.");
  return { filename, content, revision };
}
export async function extractPdf(content: Uint8Array): Promise<ExtractedPdf> {
  if (activeParsers >= PDF_LIMITS.maxConcurrentParsers) throw new ApiError(429, "다른 PDF를 처리하고 있습니다. 잠시 후 다시 시도해주세요.");
  activeParsers++;
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    worker = new Worker(resolve("lib/pdf-worker.mjs"), {
      execArgv: [],
      workerData: {
        content, maxPages: PDF_LIMITS.maxPages, maxTextCharacters: PDF_LIMITS.maxTextCharacters,
        basicInfoLimits: { title: paperSchema.shape.title.maxLength, authors: paperSchema.shape.authors.maxLength, url: paperSchema.shape.url.maxLength },
      },
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    const currentWorker = worker;
    return await new Promise<ExtractedPdf>((resolveResult, reject) => {
      timer = setTimeout(() => reject(new ApiError(408, "PDF 처리 시간이 초과되었습니다. 파일을 확인한 뒤 다시 시도해주세요.")), PDF_LIMITS.parseTimeoutMs);
      currentWorker.once("message", (message: unknown) => {
        const payload = z.object({ result: extractionSchema.optional(), error: z.string().optional() }).safeParse(message);
        if (!payload.success) return reject(new ApiError(422, "PDF 내용을 읽지 못했습니다."));
        if (payload.data.result) return resolveResult(payload.data.result);
        const errors: Record<string, string> = {
          pages: "60쪽 이하의 PDF를 업로드해주세요.",
          text: "추출한 본문이 너무 깁니다. 20만 자 이하의 문서를 사용해주세요.",
          password: "암호가 필요한 PDF입니다. 암호를 해제한 파일을 업로드해주세요.",
          invalid: "PDF 내용을 읽지 못했습니다. 손상되지 않은 파일인지 확인해주세요.",
        };
        reject(new ApiError(422, errors[payload.data.error ?? "invalid"] ?? errors.invalid));
      });
      currentWorker.once("error", () => reject(new ApiError(422, "PDF를 처리하지 못했습니다. 다른 파일로 다시 시도해주세요.")));
      currentWorker.once("exit", code => { if (code !== 0) reject(new ApiError(422, "PDF 처리가 중단되었습니다.")); });
    });
  } finally {
    if (timer) clearTimeout(timer);
    if (worker) await worker.terminate();
    activeParsers--;
  }
}
