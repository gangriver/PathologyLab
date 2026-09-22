import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { PDF_LIMITS } from "../lib/document-types";
import { uploadPdf } from "../lib/upload-pdf";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };
const importUrl = "/api/papers/import";
const uploadUrl = "https://storage.example.test/temporary/document.pdf?signature=test";
const uploadToken = "test-upload-token";

function formWithFile(file = new File(["%PDF-1.7\n검증"], "검증 논문.pdf", { type: "application/pdf" }), revision?: number) {
  const form = new FormData();
  form.set("file", file);
  if (revision !== undefined) form.set("revision", String(revision));
  return form;
}

function mockFetch(t: TestContext, responses: (Response | Error)[]) {
  const calls: FetchCall[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    const response = responses.shift();
    assert.ok(response, "예정되지 않은 네트워크 요청이 발생했습니다.");
    if (response instanceof Error) throw response;
    return response;
  });
  return calls;
}

function preparationResponse() {
  return Response.json({ uploadUrl, uploadToken });
}

function readJsonBody(call: FetchCall): unknown {
  assert.equal(typeof call.init?.body, "string");
  return JSON.parse(call.init?.body as string);
}

function assertSignal(call: FetchCall) {
  assert.ok(call.init?.signal instanceof AbortSignal);
  assert.equal(call.init.signal.aborted, false);
}

test("로컬 PDF 업로드는 기존 multipart 요청 한 번과 파일·버전을 보존", async t => {
  const expected = Response.json({ id: "local-paper" });
  const calls = mockFetch(t, [expected]);
  const form = formWithFile(undefined, 7);
  const response = await uploadPdf("/api/papers/local-paper/pdf", form, false);
  assert.equal(response, expected);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "/api/papers/local-paper/pdf");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.body, form);
  assert.equal(new Headers(calls[0].init?.headers).has("content-type"), false);
  assert.equal(form.get("revision"), "7");
  assertSignal(calls[0]);
});

test("200MiB 클라우드 PDF 등록은 한글 파일명과 빈 MIME을 허용하며 세 단계로 전송", async t => {
  const expected = Response.json({ id: "cloud-paper" }, { status: 201 });
  const calls = mockFetch(t, [preparationResponse(), new Response(null, { status: 200 }), expected]);
  const file = new File(["%PDF-1.7\n검증"], "병리 연구 논문.pdf");
  // 네트워크를 모의하므로 실제 대형 버퍼 없이 파일 크기 경계와 전송 경로를 확인합니다.
  Object.defineProperty(file, "size", { value: PDF_LIMITS.maxBytes });
  const form = formWithFile(file);
  assert.equal(await uploadPdf(importUrl, form, true), expected);
  assert.deepEqual(calls.map(call => call.input), ["/api/papers/uploads", uploadUrl, importUrl]);
  assert.deepEqual(calls.map(call => call.init?.method), ["POST", "PUT", "POST"]);
  assert.deepEqual(readJsonBody(calls[0]), { filename: file.name, byteLength: file.size });
  assert.equal(file.size, 200 * 1024 * 1024);
  assert.deepEqual(readJsonBody(calls[2]), { uploadToken });
  assert.equal(new Headers(calls[0].init?.headers).get("content-type"), "application/json");
  assert.equal(new Headers(calls[2].init?.headers).get("content-type"), "application/json");
  assert.equal(calls[1].init?.body, file);
  assert.equal(calls[1].init?.credentials, "omit");
  assert.equal(calls[1].init?.redirect, "error");
  const uploadHeaders = new Headers(calls[1].init?.headers);
  assert.equal(uploadHeaders.get("content-type"), "application/pdf");
  assert.equal(uploadHeaders.has("content-length"), false);
  assert.equal(uploadHeaders.has("authorization"), false);
  assert.equal(form.get("file"), file);
  for (const call of calls) assertSignal(call);
});

test("클라우드 PDF 교체는 최종 요청에 정수 revision을 전달", async t => {
  const target = "/api/papers/existing-paper/pdf";
  const calls = mockFetch(t, [preparationResponse(), new Response(null), Response.json({ revision: 13 })]);
  await uploadPdf(target, formWithFile(undefined, 12), true);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].input, target);
  assert.deepEqual(readJsonBody(calls[2]), { uploadToken, revision: 12 });
});

test("파일 누락·빈 파일·200MiB 초과·잘못된 형식은 네트워크 요청 전에 거부", async t => {
  const calls = mockFetch(t, []);
  const oversized = new File(["%PDF-1.7"], "large.pdf");
  Object.defineProperty(oversized, "size", { value: PDF_LIMITS.maxBytes + 1 });
  const cases: [FormData, number][] = [
    [new FormData(), 400],
    [formWithFile(new File([], "empty.pdf")), 413],
    [formWithFile(oversized), 413],
    [formWithFile(new File(["text"], "notes.txt", { type: "application/pdf" })), 415],
    [formWithFile(new File(["text"], "notes.pdf", { type: "text/plain" })), 415],
  ];
  for (const [form, status] of cases) {
    assert.equal((await uploadPdf(importUrl, form, true)).status, status);
  }
  assert.equal(calls.length, 0);
});

test("업로드 준비 실패 시 저장소 전송과 최종 등록을 생략", async t => {
  const expected = Response.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  const calls = mockFetch(t, [expected]);
  const response = await uploadPdf(importUrl, formWithFile(), true);
  assert.equal(response, expected);
  assert.equal(response.status, 429);
  assert.equal(calls.length, 1);
});

test("준비 응답의 필수 값이 잘못되면 저장소로 전송하지 않음", async t => {
  const calls = mockFetch(t, [Response.json({ uploadUrl, uploadToken: null })]);
  const response = await uploadPdf(importUrl, formWithFile(), true);
  assert.equal(response.status, 502);
  assert.equal(calls.length, 1);
  const body = await response.text();
  assert.match(body, /업로드를 준비하지 못했습니다/);
  assert.equal(body.includes(uploadUrl), false);
});

test("저장소 PUT 실패는 최종 등록을 생략하고 외부 오류 본문을 노출하지 않음", async t => {
  const privateDetail = "<Error><RequestId>private-request-id</RequestId><Signature>private-signature</Signature></Error>";
  const calls = mockFetch(t, [preparationResponse(), new Response(privateDetail, { status: 403, headers: { "content-type": "application/xml" } })]);
  const response = await uploadPdf(importUrl, formWithFile(), true);
  assert.equal(response.status, 502);
  assert.equal(calls.length, 2);
  const body = await response.text();
  assert.match(body, /PDF 파일을 업로드하지 못했습니다/);
  assert.equal(body.includes("private-"), false);
  assert.equal(body.includes(uploadUrl), false);
  assert.equal(body.includes(uploadToken), false);
});

test("최종 등록의 버전 충돌 응답은 그대로 전달", async t => {
  const expected = Response.json({ error: "논문이 변경되었습니다. 새로고침 후 다시 확인해주세요." }, { status: 409 });
  const calls = mockFetch(t, [preparationResponse(), new Response(null), expected]);
  assert.equal(await uploadPdf("/api/papers/existing-paper/pdf", formWithFile(undefined, 1), true), expected);
  assert.equal(calls.length, 3);
});

test("각 전송 단계의 네트워크 실패 뒤 같은 입력으로 재시도 가능", async t => {
  for (const failedStage of [0, 1, 2]) {
    await t.test(`${failedStage + 1}단계 연결 실패`, async child => {
      const interrupted: (Response | Error)[] = [];
      if (failedStage > 0) interrupted.push(preparationResponse());
      if (failedStage > 1) interrupted.push(new Response(null));
      interrupted.push(new TypeError("모의 네트워크 연결 실패"));
      const success = Response.json({ id: "retried-paper" });
      const calls = mockFetch(child, [...interrupted, preparationResponse(), new Response(null), success]);
      const form = formWithFile();
      const file = form.get("file");
      await assert.rejects(uploadPdf(importUrl, form, true), TypeError);
      assert.equal(calls.length, failedStage + 1);
      assert.equal(await uploadPdf(importUrl, form, true), success);
      assert.equal(calls.length, failedStage + 4);
      assert.equal(form.get("file"), file);
    });
  }
});
