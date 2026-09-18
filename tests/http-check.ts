import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { makePdf } from "./pdf-fixture";
import { PDF_LIMITS } from "../lib/document-types";

async function main() {
  for (const route of ["import", "[id]/pdf"]) {
    const trace = JSON.parse(readFileSync(resolve(".next/server/app/api/papers", route, "route.js.nft.json"), "utf8")) as { files: string[] };
    for (const filename of ["pdf-worker.mjs", "pdf-basic-info.mjs"]) {
      assert.ok(trace.files.some(file => file.replaceAll("\\", "/").endsWith("/lib/" + filename)), "PDF 처리 파일의 빌드 포함 실패: " + route + "/" + filename);
    }
  }
  const testRoot = resolve("work");
  mkdirSync(testRoot, { recursive: true });
  const directory = mkdtempSync(resolve(testRoot, "http-"));
  const portServer = createServer();
  portServer.listen(0, "127.0.0.1");
  await once(portServer, "listening");
  const address = portServer.address();
  if (!address || typeof address === "string") throw new Error("검증 포트 생성 실패");
  const port = address.port;
  await new Promise<void>((done, reject) => portServer.close(error => error ? reject(error) : done()));
  const base = "http://127.0.0.1:" + port;
  process.env.DATABASE_PATH = resolve(directory, "test.sqlite");
  process.env.APP_URL = base;
  process.env.OPENAI_API_KEY = "";
  const { db } = await import("../lib/db");
  const { setupDatabase } = await import("../lib/setup-database");
  await setupDatabase(db);
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let logs = "";
  child.stdout.on("data", chunk => { logs += String(chunk); });
  child.stderr.on("data", chunk => { logs += String(chunk); });
  const get = (path: string) => fetch(base + path, { signal: AbortSignal.timeout(15000) });
  const mutate = (path: string, method: string, body: unknown) => fetch(base + path, {
    method, headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await fetch(base, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
      await new Promise(done => setTimeout(done, 200));
    }
    assert.ok(ready, "프로덕션 서버 시작 실패: " + logs);
    const homeHtml = await (await get("/")).text();
    assert.doesNotMatch(homeHtml, /href="\/(login|signup)"|멤버 로그인/);
    for (const path of ["/login", "/signup", "/pending", "/members"]) {
      const response = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(15000) });
      assert.ok([307, 308].includes(response.status), "옛 회원 화면 이동 실패: " + path);
      assert.equal(new URL(response.headers.get("location")!, base).pathname, "/papers");
    }
    for (const path of ["/api/auth/get-session", "/api/members"]) {
      assert.equal((await get(path)).status, 404, "삭제된 인증 API가 열려 있음: " + path);
    }
    assert.equal((await mutate("/api/auth/sign-up/email", "POST", {})).status, 404);
    assert.equal((await mutate("/api/members", "PATCH", { userId: "missing", status: "active" })).status, 404);

    const newPage = await get("/papers/new");
    assert.equal(newPage.status, 200);
    const newPageHtml = await newPage.text();
    assert.match(newPageHtml, /PDF로 시작하기/);
    assert.ok(newPageHtml.replace(/<[^>]*>/g, "").includes(`최대 ${PDF_LIMITS.maxBytes / 1024 / 1024}MB`), "등록 화면의 PDF 용량 안내 불일치");
    const basicInfo = { title: "HTTP Cell Classification Study", authors: "Jane Doe", url: "https://doi.org/10.1234/http.2026" };
    const bytes = makePdf([""], { byteLength: PDF_LIMITS.maxBytes, title: basicInfo.title, author: basicInfo.authors, firstPageLines: [
      { text: "doi: 10.1234/http.2026", fontSize: 10, y: 740 },
      { text: "Abstract", fontSize: 12, y: 700 },
      { text: "Synthetic HTTP test paper with a research question, a held-out evaluation dataset, and an accuracy result. This text is for testing only.", fontSize: 12, y: 675 },
    ] });
    const body = new FormData(); body.set("file", new File([new Uint8Array(bytes)], "HTTP 검증.pdf", { type: "application/pdf" }));
    const imported = await fetch(base + "/api/papers/import", { method: "POST", headers: { origin: base }, body, signal: AbortSignal.timeout(30000) });
    const importedText = await imported.text();
    assert.equal(imported.status, 201, importedText + logs);
    const { id } = JSON.parse(importedText) as { id: string };
    const edit = await get("/papers/" + id + "/edit");
    assert.equal(edit.status, 200);
    const editHtml = await edit.text();
    assert.ok(editHtml.includes("HTTP 검증.pdf"), "편집 화면 원본 표시 실패: " + logs);
    assert.ok(editHtml.includes("AI 요약 연결 대기"), "AI 연결 상태 표시 실패: " + logs);
    const inputs = editHtml.match(/<input\b[^>]*>/g) ?? [];
    for (const [name, value] of Object.entries(basicInfo)) {
      assert.ok(inputs.some(input => input.includes('name="' + name + '"') && input.includes('value="' + value + '"')), "PDF 기본정보 자동 입력 실패: " + name);
    }
    const raw = await get("/api/papers/" + id + "/pdf");
    assert.equal(raw.status, 200);
    assert.deepEqual(new Uint8Array(await raw.arrayBuffer()), bytes);
    const detail = await get("/api/papers/" + id);
    assert.equal(detail.status, 200);
    const { paper } = await detail.json() as { paper: Record<string, unknown> };
    assert.deepEqual({ title: paper.title, authors: paper.authors, url: paper.url }, basicInfo);
    const saved = await mutate("/api/papers/" + id, "PATCH", { ...paper, findings: "HTTP 저장 검증" });
    assert.equal(saved.status, 200, await saved.text());
    assert.equal(db.prepare("SELECT findings FROM papers WHERE id=?").get(id)?.findings, "HTTP 저장 검증");
    assert.equal((await mutate("/api/papers/" + id, "PATCH", { ...paper, findings: "이전 버전 덮어쓰기" })).status, 409);
    const comment = await mutate("/api/papers/" + id + "/comments", "POST", { content: "HTTP 토론 검증 <script>alert(1)</script>" });
    assert.equal(comment.status, 201);
    for (const [path, expected] of [["/papers", basicInfo.title], ["/papers/" + id, "HTTP 토론 검증"], ["/papers/" + id + "/edit", "HTTP 저장 검증"]]) {
      const page = await get(path);
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.ok(html.includes(expected) && !html.includes('$RX("B:0"'), "저장 후 화면 재조회 실패: " + path + logs);
      assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    }
    const list = await get("/api/papers");
    assert.equal(list.status, 200);
    assert.equal((await list.json() as { id: string }[])[0].id, id);
    const manual = await mutate("/api/papers", "POST", { ...paper, title: "수동 등록 HTTP 검증" });
    assert.equal(manual.status, 201);
    const manualId = (await manual.json() as { id: string }).id;
    assert.equal((await mutate("/api/papers/" + manualId, "DELETE", { revision: 1 })).status, 200);
    assert.equal((await mutate("/api/papers/" + id, "DELETE", { revision: 2 })).status, 200);
    assert.equal((await get("/api/papers/" + id)).status, 404);
    assert.equal((await get("/api/papers/" + id + "/pdf")).status, 404);
    assert.equal(db.prepare("SELECT count(*) AS count FROM comments WHERE paperId=?").get(id)?.count, 0);
    console.log("프로덕션 HTTP 검증 통과: PDF 최대 용량 업로드·다운로드, 용량 안내, 인증 API 제거, 기존 로그인 주소 이동, PDF 기본정보 자동 입력, 쿠키 없는 등록·편집·토론·삭제, 저장 후 재조회");
  } finally {
    if (child.exitCode === null) { child.kill(); await once(child, "exit"); }
    db.close();
    if (dirname(directory) !== testRoot) throw new Error("검증 폴더 경로 오류");
    rmSync(directory, { recursive: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
