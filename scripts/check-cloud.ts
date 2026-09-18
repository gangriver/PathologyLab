import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

async function main() {
  const envPath = resolve(".env.cloud.local");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const projectUrl = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!projectUrl || !secretKey) {
    console.error(".env.cloud.local에 SUPABASE_URL과 SUPABASE_SECRET_KEY를 입력해주세요.");
    process.exitCode = 1;
    return;
  }

  let url: URL;
  try { url = new URL(projectUrl); }
  catch { throw new Error("설정 오류"); }
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    console.error("SUPABASE_URL에는 https://프로젝트ID.supabase.co 형식의 Project URL을 입력해주세요.");
    process.exitCode = 1;
    return;
  }
  if (!secretKey.startsWith("sb_secret_") || secretKey.length <= "sb_secret_".length) {
    console.error("SUPABASE_SECRET_KEY에는 sb_secret_로 시작하는 서버용 Secret key를 입력해주세요.");
    process.exitCode = 1;
    return;
  }

  // 비밀키가 다른 호스트로 전달되지 않도록 리디렉션을 허용하지 않습니다.
  const response = await fetch(new URL("/rest/v1/", url), {
    headers: { apikey: secretKey, Accept: "application/openapi+json" },
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  await response.body?.cancel();
  if (!response.ok) {
    console.error(`Supabase 연결 확인에 실패했습니다(HTTP ${response.status}). 프로젝트 실행 상태, Data API 활성화, URL과 Secret key를 확인해주세요.`);
    process.exitCode = 1;
    return;
  }
  console.log("Supabase Data API에 연결되어 키가 수락된 응답을 확인했습니다.");

  // 자료를 조회하거나 변경하지 않고 테이블의 존재와 서버용 읽기 권한을 확인합니다.
  for (const table of ["papers", "comments", "paper_documents"]) {
    const tableUrl = new URL(`/rest/v1/${table}`, url);
    tableUrl.searchParams.set("select", "*");
    tableUrl.searchParams.set("limit", "0");
    const tableResponse = await fetch(tableUrl, {
      headers: { apikey: secretKey },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    await tableResponse.body?.cancel();
    if (!tableResponse.ok) {
      console.error(`${table} 테이블 확인에 실패했습니다(HTTP ${tableResponse.status}). db/supabase.sql 실행 결과와 서버용 접근 권한을 확인해주세요.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${table} 테이블과 서버용 읽기 권한을 확인했습니다.`);
  }
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    console.error(".env.cloud.local의 R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY를 입력해주세요.");
    process.exitCode = 1;
    return;
  }
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
    console.error("R2_ACCOUNT_ID에는 32자리 계정 ID를, R2_BUCKET_NAME에는 생성한 버킷 이름을 입력해주세요.");
    process.exitCode = 1;
    return;
  }

  // 계정 ID로 공식 주소만 구성하며 파일 내용과 키는 출력하지 않습니다.
  const storage = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    followRegionRedirects: false,
    maxAttempts: 1,
  });
  try {
    await storage.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }), {
      abortSignal: AbortSignal.timeout(8000),
    });
  } catch {
    console.error("R2 연결을 확인하지 못했습니다. 계정 ID, 버킷 이름, S3 연결 키와 해당 버킷의 Object Read & Write 권한을 확인해주세요.");
    process.exitCode = 1;
    return;
  } finally {
    storage.destroy();
  }
  console.log("R2 버킷 연결과 파일 목록 읽기 권한을 확인했습니다.");
  console.log("논문·PDF의 저장·수정·삭제, 기존 자료 이전, 홈페이지 연결은 아직 검증하지 않았습니다.");
}

main().catch(() => {
  console.error("클라우드 연결을 확인하지 못했습니다. 환경 파일 형식, 연결 정보와 인터넷 연결을 확인해주세요.");
  process.exitCode = 1;
});
