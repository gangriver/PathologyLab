import { test } from "node:test";
import assert from "node:assert/strict";
import { createUploadTicket, readCloudPdfUpload } from "../lib/cloud-upload";
import { PDF_LIMITS } from "../lib/document-types";
import { getPdf, getPdfUrl } from "../lib/r2";
import { POST } from "../app/api/papers/uploads/route";

test("R2 직접 업로드의 서명과 파일 검증", async t => {
  const names = ["APP_URL", "CLOUD_STORAGE", "R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.APP_URL = "http://lab.test";
  process.env.CLOUD_STORAGE = "1";
  process.env.R2_ACCOUNT_ID = "a".repeat(32);
  process.env.R2_BUCKET_NAME = "test-papers";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  const content = new TextEncoder().encode("%PDF-1.7\ntest");
  function request(body: unknown, origin = "http://lab.test") {
    return new Request("http://lab.test/api/papers/uploads", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
  }
  try {
    await t.test("정확히 200MiB의 업로드 URL은 파일 크기·형식과 10분 만료를 서명", async () => {
      assert.equal(PDF_LIMITS.maxBytes, 200 * 1024 * 1024);
      const ticket = await createUploadTicket({ filename: "연구.pdf", byteLength: PDF_LIMITS.maxBytes });
      const metadata = JSON.parse(Buffer.from(ticket.uploadToken.split(".")[0], "base64url").toString("utf8")) as { byteLength: number };
      assert.equal(metadata.byteLength, 200 * 1024 * 1024);
      const url = new URL(ticket.uploadUrl);
      assert.equal(url.hostname, `${"a".repeat(32)}.r2.cloudflarestorage.com`);
      assert.match(url.pathname, /^\/test-papers\/staging\/[0-9a-f-]+\.pdf$/);
      assert.equal(url.searchParams.get("X-Amz-Expires"), "600");
      const headers = url.searchParams.get("X-Amz-SignedHeaders")?.split(";");
      assert.ok(headers?.includes("content-type"));
      assert.ok(headers?.includes("content-length"));
      assert.ok(!ticket.uploadUrl.includes("test-secret-key"));
      assert.ok(!ticket.uploadToken.includes("test-secret-key"));
    });
    await t.test("빈 파일·크기 초과·PDF 이외의 파일명은 티켓을 발급하지 않음", async () => {
      for (const byteLength of [0, -1, PDF_LIMITS.maxBytes + 1, 1.5]) {
        await assert.rejects(createUploadTicket({ filename: "paper.pdf", byteLength }), { status: 422 });
      }
      await assert.rejects(createUploadTicket({ filename: "paper.html", byteLength: 10 }), { status: 422 });
    });
    await t.test("변조된 토큰과 다른 출처는 저장소에 접근하지 않고 거부", async st => {
      const fetch = st.mock.method(globalThis, "fetch", async () => { throw new Error("저장소 접근 금지"); });
      const ticket = await createUploadTicket({ filename: "paper.pdf", byteLength: content.byteLength });
      const [payload, signature] = ticket.uploadToken.split(".");
      const metadata = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { filename: string };
      metadata.filename = "changed.pdf";
      const changedPayload = Buffer.from(JSON.stringify(metadata)).toString("base64url");
      await assert.rejects(readCloudPdfUpload(request({ uploadToken: `${changedPayload}.${signature}` })), { status: 400 });
      await assert.rejects(readCloudPdfUpload(request({ uploadToken: ticket.uploadToken }, "https://outside.test")), { status: 403 });
      assert.equal(fetch.mock.callCount(), 0);
    });
    await t.test("만료된 티켓은 다운로드 전에 거부", async st => {
      const issuedAt = Date.now();
      const ticket = await createUploadTicket({ filename: "paper.pdf", byteLength: content.byteLength });
      st.mock.method(Date, "now", () => issuedAt + 601000);
      const fetch = st.mock.method(globalThis, "fetch", async () => { throw new Error("저장소 접근 금지"); });
      await assert.rejects(readCloudPdfUpload(request({ uploadToken: ticket.uploadToken })), { status: 410 });
      assert.equal(fetch.mock.callCount(), 0);
    });
    await t.test("서명된 메타데이터와 실제 PDF 바이트를 연결하고 파일명을 정리", async st => {
      const fetch = st.mock.method(globalThis, "fetch", async () => new Response(content));
      const ticket = await createUploadTicket({ filename: "../연구\n자료.pdf", byteLength: content.byteLength });
      const upload = await readCloudPdfUpload(request({ uploadToken: ticket.uploadToken, revision: 3 }));
      assert.equal(upload.filename, ".._연구_자료.pdf");
      assert.equal(upload.revision, 3);
      assert.match(upload.uploadId, /^[0-9a-f-]{36}$/);
      assert.deepEqual(upload.content, content);
      assert.equal(fetch.mock.callCount(), 1);
    });
    await t.test("실제 다운로드 길이 불일치와 PDF 위장 파일을 거부", async st => {
      const ticket = await createUploadTicket({ filename: "paper.pdf", byteLength: content.byteLength });
      const fetch = st.mock.method(globalThis, "fetch", async () => new Response(content.subarray(0, 5)));
      await assert.rejects(readCloudPdfUpload(request({ uploadToken: ticket.uploadToken })), { status: 422 });
      fetch.mock.mockImplementation(async () => new Response(new Uint8Array(content.byteLength)));
      await assert.rejects(readCloudPdfUpload(request({ uploadToken: ticket.uploadToken })), { status: 415 });
    });
    await t.test("길이 헤더가 작아도 응답 본문이 200MiB를 넘으면 읽기를 중단", async st => {
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new Uint8Array(PDF_LIMITS.maxBytes + 1)); },
        cancel() { cancelled = true; },
      });
      st.mock.method(globalThis, "fetch", async () => new Response(body, { headers: { "content-length": "1" } }));
      await assert.rejects(getPdf("staging/test.pdf"), { status: 413 });
      assert.equal(cancelled, true);
    });
    await t.test("다운로드 주소의 한국어 파일명과 제어 문자를 안전하게 처리", async () => {
      const url = new URL(await getPdfUrl("papers/test.pdf", "논문\r\n자료.pdf"));
      const disposition = url.searchParams.get("response-content-disposition") ?? "";
      assert.ok(disposition.includes("filename*=UTF-8''"));
      assert.ok(disposition.includes(encodeURIComponent("논문__자료.pdf")));
      assert.ok(!/[\r\n]/.test(disposition));
    });
    await t.test("없는 객체와 연결 오류를 구분하며 내부 오류를 숨김", async st => {
      const fetch = st.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
      await assert.rejects(getPdf("papers/test.pdf"), { status: 404 });
      fetch.mock.mockImplementation(async () => { throw new Error("test-secret-key"); });
      await assert.rejects(getPdf("papers/test.pdf"), error => error instanceof Error && !error.message.includes("test-secret-key") && "status" in error && error.status === 502);
    });
    await t.test("본문 수신 중 연결이 끊기면 부분 파일을 반환하지 않고 오류 내용을 숨김", async st => {
      const requests: RequestInit[] = [];
      const body = new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(content); },
        pull(controller) { controller.error(new Error("test-secret-key")); },
      });
      st.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
        if (init) requests.push(init);
        return new Response(body);
      });
      await assert.rejects(getPdf("papers/test.pdf"), error => error instanceof Error && !error.message.includes("test-secret-key") && "status" in error && error.status === 502);
      assert.equal(requests[0].redirect, "error");
      assert.equal(requests[0].cache, "no-store");
      assert.ok(requests[0].signal instanceof AbortSignal);
    });
    await t.test("클라우드 기능을 끄면 발급 경로도 닫히고 켜도 출처 검증 적용", async () => {
      process.env.CLOUD_STORAGE = "0";
      assert.equal((await POST(request({ filename: "paper.pdf", byteLength: 5 }))).status, 404);
      process.env.CLOUD_STORAGE = "1";
      assert.equal((await POST(request({ filename: "paper.pdf", byteLength: 5 }, "https://outside.test"))).status, 403);
      assert.equal((await POST(request({ filename: "paper.pdf", byteLength: PDF_LIMITS.maxBytes }))).status, 201);
      assert.equal((await POST(request({ filename: "paper.pdf", byteLength: PDF_LIMITS.maxBytes + 1 }))).status, 422);
    });
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
