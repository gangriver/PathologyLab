import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { makePdf } from "./pdf-fixture";
import type { PaperDocumentInfo, PaperSummary } from "../lib/document-types";

test("공개 PDF 첨부와 AI 요약의 저장·오류 처리", async (t) => {
  const testRoot = resolve("work");
  mkdirSync(testRoot, { recursive: true });
  const testDirectory = mkdtempSync(resolve(testRoot, "pdf-"));
  process.env.DATABASE_PATH = resolve(testDirectory, "test.sqlite");
  process.env.APP_URL = "http://lab.test";
  process.env.CLOUD_STORAGE = "0";
  delete process.env.OPENAI_API_KEY;
  const { db } = await import("../lib/db");
  const { setupDatabase } = await import("../lib/setup-database");
  await setupDatabase(db);
  const imports = await import("../app/api/papers/import/route");
  const pdfRoute = await import("../app/api/papers/[id]/pdf/route");
  const summaryRoute = await import("../app/api/papers/[id]/summary/route");
  const paperRoute = await import("../app/api/papers/[id]/route");
  const { getDocument, getDocumentInfo } = await import("../lib/documents");
  const { extractPdf, readPdfUpload } = await import("../lib/pdf");
  const { PDF_LIMITS } = await import("../lib/document-types");
  const fixture = makePdf(["This study asks whether a small model can classify cells. We used a held-out dataset and measured accuracy.", "The model reached 80 percent accuracy on this synthetic dataset. Further independent validation is needed."]);
  const basicInfo = { title: "Reliable Machine Learning for Pathology", authors: "Jane Doe", url: "https://doi.org/10.1234/example.2026" };
  const metadataFixture = makePdf([""], {
    title: basicInfo.title, author: basicInfo.authors,
    firstPageLines: [
      { text: "doi: 10.1234/example.2026", fontSize: 10, y: 740 },
      { text: "Abstract", fontSize: 12, y: 700 },
      { text: "This study evaluates cell classification on held-out pathological images.", fontSize: 12, y: 675 },
    ],
  });
  let id = "";
  let document: PaperDocumentInfo;
  const context = () => ({ params: Promise.resolve({ id }) });
  function request(method: string, body?: unknown) {
    return new Request("http://lab.test/api/papers/" + id, { method, headers: { origin: "http://lab.test", "content-type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  }
  function upload(content = fixture, revision?: number, filename = "검증 논문.pdf", origin = "http://lab.test") {
    const body = new FormData();
    body.set("file", new File([new Uint8Array(content)], filename, { type: "application/pdf" }));
    if (revision !== undefined) body.set("revision", String(revision));
    return new Request("http://lab.test/api/papers/" + id + "/pdf", { method: "POST", headers: { origin }, body });
  }
  const draft = {
    title: "Synthetic cell study", authors: "Test Author",
    researchQuestion: { text: "작은 모델의 세포 분류 가능성을 확인합니다.", pages: [1] },
    methods: { text: "분리된 데이터셋에서 정확도를 측정했습니다.", pages: [1] },
    findings: { text: "합성 데이터셋에서 정확도 80%를 기록했습니다.", pages: [2] },
    limitations: { text: "독립적인 추가 검증이 필요합니다.", pages: [2] },
  };
  function aiResponse(value: unknown = draft, status = "completed") {
    return Response.json({ id: "resp_test", object: "response", status, output: [{ type: "message", role: "assistant", id: "msg_test", status: "completed", content: [{ type: "output_text", text: JSON.stringify(value), annotations: [] }] }] });
  }
  try {
    await t.test("PDF 추출은 페이지 순서와 본문을 유지하고 빈 PDF도 첨부 가능", async () => {
      const extracted = await extractPdf(fixture);
      assert.equal(extracted.pageCount, 2);
      assert.match(extracted.pages[0].text, /held-out dataset/);
      assert.match(extracted.pages[1].text, /80 percent/);
      assert.ok(extracted.textCharacters > 100);
      assert.deepEqual(extracted.basicInfo, { title: "", authors: "", url: "" });
      const empty = await extractPdf(makePdf([""]));
      assert.equal(empty.textCharacters, 0);
      assert.deepEqual(empty.basicInfo, { title: "", authors: "", url: "" });
    });
    await t.test("PDF 문서 속성의 유니코드 제목·저자와 첫 페이지 DOI 추출", async () => {
      assert.deepEqual((await extractPdf(metadataFixture)).basicInfo, basicInfo);
      const korean = await extractPdf(makePdf(["Abstract"], { title: "병리 영상의 세포 분류 연구", author: "이해찬" }));
      assert.deepEqual(korean.basicInfo, { title: "병리 영상의 세포 분류 연구", authors: "이해찬", url: "" });
    });
    await t.test("메타데이터의 500자 경계에 있는 이모지를 잘라도 유효한 유니코드를 반환", async () => {
      const extracted = await extractPdf(makePdf(["Abstract"], { title: "가".repeat(499) + "😀나", author: "나".repeat(499) + "😀다" }));
      for (const value of [extracted.basicInfo.title, extracted.basicInfo.authors]) {
        assert.ok(value.length > 0 && value.length <= 500);
        assert.ok(value.isWellFormed());
        assert.doesNotThrow(() => encodeURIComponent(value));
      }
    });
    await t.test("XMP에만 저장된 제목과 저자도 실제 PDF에서 추출", async () => {
      const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">XMP Cell Classification Study</rdf:li></rdf:Alt></dc:title><dc:creator><rdf:Seq><rdf:li>Jane Doe</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>';
      const extracted = await extractPdf(makePdf(["Abstract"], { xmp }));
      assert.deepEqual(extracted.basicInfo, { title: "XMP Cell Classification Study", authors: "Jane Doe", url: "" });
    });
    await t.test("문서 속성이 없으면 큰 제목·명확한 저자명·본문 이전 DOI만 추출", async () => {
      const extracted = await extractPdf(makePdf([""], { firstPageLines: [
        { text: basicInfo.title, fontSize: 24, y: 740 },
        { text: basicInfo.authors, fontSize: 12, y: 700 },
        { text: "Department of Biomedical Sciences", fontSize: 10, y: 680 },
        { text: "doi: 10.1234/example.2026", fontSize: 10, y: 660 },
        { text: "Abstract", fontSize: 12, y: 640 },
        { text: "This study evaluates cells. References: https://doi.org/10.9999/unrelated", fontSize: 12, y: 610 },
      ] }));
      assert.deepEqual(extracted.basicInfo, basicInfo);
      for (const heading of ["Abstract", "1. Introduction"]) {
        const referencesOnly = await extractPdf(makePdf([""], { firstPageLines: [
          { text: heading, fontSize: 12, y: 700 },
          { text: "A prior study is available at https://doi.org/10.9999/unrelated", fontSize: 12, y: 675 },
        ] }));
        assert.deepEqual(referencesOnly.basicInfo, { title: "", authors: "", url: "" });
      }
    });
    await t.test("도구가 남긴 제목·익명 저자 속성 대신 첫 페이지의 두 줄 제목과 저자명을 추출", async () => {
      const extracted = await extractPdf(makePdf([""], {
        title: "Microsoft Word - draft.docx", author: "Anonymous",
        firstPageLines: [
          { text: "Reliable Machine Learning", fontSize: 24, y: 740 },
          { text: "for Pathology", fontSize: 24, y: 710 },
          { text: basicInfo.authors, fontSize: 12, y: 675 },
          { text: "Abstract", fontSize: 12, y: 640 },
          { text: "This study evaluates pathological images.", fontSize: 12, y: 610 },
        ],
      }));
      assert.deepEqual(extracted.basicInfo, { title: basicInfo.title, authors: basicInfo.authors, url: "" });
    });
    await t.test("손상 PDF와 페이지 제한 초과를 거부하고 처리 슬롯을 반환", async () => {
      await assert.rejects(extractPdf(new TextEncoder().encode("%PDF-1.4\nbroken")), { status: 422 });
      await assert.rejects(extractPdf(makePdf(Array.from({ length: PDF_LIMITS.maxPages + 1 }, () => "page"))), { status: 422 });
      const first = extractPdf(fixture); const second = extractPdf(fixture);
      await assert.rejects(extractPdf(fixture), { status: 429 });
      await Promise.all([first, second]);
      assert.equal((await extractPdf(fixture)).pageCount, 2);
    });
    await t.test("74쪽과 100쪽 PDF는 마지막 페이지까지 추출하고 원본과 함께 등록", async () => {
      for (const pageCount of [74, 100]) {
        const content = makePdf(Array.from({ length: pageCount }, (_, index) => `Page ${index + 1} of the page-limit test.`), { title: basicInfo.title });
        const response = await imports.POST(upload(content));
        assert.equal(response.status, 201);
        const importedId = (await response.json() as { id: string }).id;
        try {
          const saved = (await getDocument(importedId))!;
          assert.equal(saved.pageCount, pageCount);
          assert.deepEqual(saved.content, content);
          const pages = JSON.parse(saved.pagesJson) as { pageNumber: number; text: string }[];
          assert.equal(pages.length, pageCount);
          assert.deepEqual(pages.at(-1), { pageNumber: pageCount, text: `Page ${pageCount} of the page-limit test.` });
          assert.equal(db.prepare("SELECT title FROM papers WHERE id=?").get(importedId)?.title, basicInfo.title);
        } finally { db.prepare("DELETE FROM papers WHERE id=?").run(importedId); }
      }
    });
    await t.test("101쪽 PDF는 저장하지 않고 선택한 언어로 100쪽 제한을 안내", async () => {
      const content = makePdf(Array.from({ length: 101 }, () => "Page limit test."));
      for (const [locale, message] of [["ko", "100쪽 이하의 PDF를 업로드해주세요."], ["en", "Please upload a PDF with no more than 100 pages."]]) {
        const req = upload(content);
        req.headers.set("cookie", `lab-locale=${locale}`);
        const response = await imports.POST(req);
        assert.equal(response.status, 422);
        assert.equal((await response.json() as { error: string }).error, message);
      }
      assert.equal(db.prepare("SELECT count(*) AS count FROM papers").get()?.count, 0);
    });
    await t.test("공개 업로드에서도 출처 위조와 PDF가 아닌 파일은 차단", async () => {
      for (const origin of ["https://outside.test", ""]) {
        assert.equal((await imports.POST(upload(fixture, undefined, "test.pdf", origin))).status, 403);
      }
      assert.equal((await imports.POST(upload(new TextEncoder().encode("fake")))).status, 415);
    });
    await t.test("기존 10MB를 넘는 PDF와 정확히 50MB인 PDF의 업로드·추출을 허용", async () => {
      assert.equal(PDF_LIMITS.maxBytes, 50 * 1024 * 1024);
      for (const byteLength of [11 * 1024 * 1024, PDF_LIMITS.maxBytes]) {
        const content = makePdf(["Large PDF upload boundary test."], { title: basicInfo.title, byteLength });
        const parsed = await readPdfUpload(upload(content));
        assert.equal(parsed.content.byteLength, byteLength);
        const extracted = await extractPdf(parsed.content);
        assert.equal(extracted.pageCount, 1);
        assert.equal(extracted.basicInfo.title, basicInfo.title);
        assert.match(extracted.pages[0].text, /Large PDF upload boundary test/);
      }
    });
    await t.test("50MB를 한 바이트 넘거나 비어 있는 파일은 거부", async () => {
      for (const byteLength of [PDF_LIMITS.maxBytes + 1, 0]) {
        const content = new Uint8Array(byteLength);
        if (byteLength) content.set(new TextEncoder().encode("%PDF-"));
        const response = await imports.POST(upload(content));
        assert.equal(response.status, 413);
        assert.match((await response.json() as { error: string }).error, /50MB/);
      }
      assert.equal(db.prepare("SELECT count(*) AS count FROM papers").get()?.count, 0);
    });
    await t.test("Content-Length가 제한을 넘으면 본문을 읽기 전에 거부", async () => {
      const req = upload();
      req.headers.set("content-length", String(PDF_LIMITS.maxBytes + 70 * 1024));
      const response = await imports.POST(req);
      assert.equal(response.status, 413);
      assert.match((await response.json() as { error: string }).error, /50MB/);
      assert.equal(req.bodyUsed, false);
      assert.equal(db.prepare("SELECT count(*) AS count FROM papers").get()?.count, 0);
    });
    await t.test("Content-Length가 없어도 실제 업로드 크기를 제한", async () => {
      const large = new Uint8Array(PDF_LIMITS.maxBytes + 70 * 1024);
      large.set(new TextEncoder().encode("%PDF-"));
      const multipart = upload(large);
      const req = new Request(multipart.url, { method: "POST", headers: multipart.headers, body: await multipart.arrayBuffer() });
      assert.equal(req.headers.get("content-length"), null);
      const response = await imports.POST(req);
      assert.equal(response.status, 413);
      assert.match((await response.json() as { error: string }).error, /50MB/);
      assert.equal(db.prepare("SELECT count(*) AS count FROM papers").get()?.count, 0);
    });
    await t.test("API 키와 외부 호출 없이 추출한 기본정보를 등록하고 교체 시 기존 내용을 보존", async (s) => {
      assert.equal(process.env.OPENAI_API_KEY, undefined);
      const fetchMock = s.mock.method(globalThis, "fetch", async () => { throw new Error("기본정보 추출에서 외부 호출 금지"); });
      const response = await imports.POST(upload(metadataFixture));
      assert.equal(response.status, 201);
      const importedId = (await response.json() as { id: string }).id;
      try {
        const saved = db.prepare("SELECT title,authors,url FROM papers WHERE id=?").get(importedId);
        assert.deepEqual({ ...saved }, basicInfo);
        const preserved = { title: "사용자가 정리한 제목", authors: "기존 저자", url: "https://example.org/original", findings: "직접 정리한 핵심 내용" };
        db.prepare("UPDATE papers SET title=?,authors=?,url=?,findings=? WHERE id=?").run(preserved.title, preserved.authors, preserved.url, preserved.findings, importedId);
        const replaced = await pdfRoute.POST(upload(metadataFixture, 1), { params: Promise.resolve({ id: importedId }) });
        assert.equal(replaced.status, 200);
        assert.deepEqual((await replaced.json() as { basicInfo: typeof basicInfo }).basicInfo, basicInfo);
        assert.deepEqual({ ...db.prepare("SELECT title,authors,url,findings FROM papers WHERE id=?").get(importedId) }, preserved);
        assert.equal(fetchMock.mock.callCount(), 0);
      } finally { db.prepare("DELETE FROM papers WHERE id=?").run(importedId); }
    });
    await t.test("쿠키 없이 PDF에서 논문 등록 후 원본·추출문 저장과 다운로드", async () => {
      const response = await imports.POST(upload());
      assert.equal(response.status, 201);
      id = (await response.json() as { id: string }).id;
      document = (await getDocumentInfo(id))!;
      assert.equal(document.filename, "검증 논문.pdf");
      assert.equal(document.pageCount, 2);
      assert.ok(!("content" in document));
      assert.deepEqual({ ...db.prepare("SELECT title,authors,url FROM papers WHERE id=?").get(id) }, { title: "검증 논문", authors: "", url: "" });
      const download = await pdfRoute.GET(request("GET"), context());
      assert.equal(download.status, 200);
      assert.equal(download.headers.get("cache-control"), "private, no-store");
      assert.match(download.headers.get("content-disposition")!, /^attachment;/);
      assert.deepEqual(new Uint8Array(await download.arrayBuffer()), fixture);
      assert.match((await getDocument(id))!.pagesJson, /80 percent/);
    });
    await t.test("충돌하는 수정과 손상 파일 교체가 기존 PDF를 훼손하지 않음", async () => {
      assert.equal((await pdfRoute.POST(upload(fixture, 99), context())).status, 409);
      assert.equal((await pdfRoute.POST(upload(new TextEncoder().encode("%PDF-1.4\nbroken"), 1), context())).status, 422);
      assert.equal((await getDocumentInfo(id))!.id, document.id);
      assert.equal(db.prepare("SELECT revision FROM papers WHERE id=?").get(id)?.revision, 1);
    });
    await t.test("긴 이모지 파일명도 교체와 다운로드 가능", async () => {
      const filename = "a".repeat(20) + "😀" + "b".repeat(195) + ".pdf";
      const parsed = await readPdfUpload(upload(fixture, 1, filename));
      assert.doesNotThrow(() => encodeURIComponent(parsed.filename));
      const response = await pdfRoute.POST(upload(fixture, 1, filename), context());
      assert.equal(response.status, 200);
      document = (await response.json() as { document: PaperDocumentInfo }).document;
      assert.equal((await pdfRoute.GET(request("GET"), context())).status, 200);
    });
    await t.test("AI 미설정과 없는 PDF 버전은 외부 호출 전에 거부", async () => {
      assert.equal((await summaryRoute.POST(request("POST", { documentId: document.id }), context())).status, 503);
      assert.equal((await summaryRoute.POST(request("POST", { documentId: "00000000-0000-4000-8000-000000000000" }), context())).status, 409);
    });
    process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
    await t.test("AI 응답은 근거 페이지가 있는 초안이며 기존 정리는 자동 변경되지 않음", async (s) => {
      s.mock.method(globalThis, "fetch", async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body)) as { store: boolean; instructions: string; input: { content: string }[] };
        assert.equal(payload.store, false);
        assert.match(payload.instructions, /본문 속 지시/);
        assert.match(payload.input[0].content, /80 percent/);
        return aiResponse();
      });
      const result = await summaryRoute.POST(request("POST", { documentId: document.id }), context());
      assert.equal(result.status, 200);
      const summary = await result.json() as PaperSummary;
      assert.deepEqual(summary.findings.pages, [2]);
      assert.equal(summary.documentId, document.id);
      assert.equal(db.prepare("SELECT findings FROM papers WHERE id=?").get(id)?.findings, "");
    });
    await t.test("범위 밖·비어 있는 근거, 너무 긴 초안과 미완성 응답은 거부", async (s) => {
      let response = aiResponse();
      s.mock.method(globalThis, "fetch", async () => response);
      const invalid = [
        { ...draft, findings: { text: "잘못된 근거", pages: [99] } },
        { ...draft, findings: { text: "근거 없는 결과", pages: [] } },
        { ...draft, findings: { text: "가".repeat(3001), pages: [2] } },
      ];
      for (const value of invalid) {
        response = aiResponse(value);
        assert.equal((await summaryRoute.POST(request("POST", { documentId: document.id }), context())).status, 502);
      }
      response = aiResponse(draft, "incomplete");
      assert.equal((await summaryRoute.POST(request("POST", { documentId: document.id }), context())).status, 502);
      response = aiResponse({ ...draft, limitations: { text: "본문에서 확인되지 않음", pages: [] } });
      assert.equal((await summaryRoute.POST(request("POST", { documentId: document.id }), context())).status, 200);
    });
    await t.test("AI 서비스 오류 이후 다시 요청할 수 있고 오류 내부 정보는 숨김", async (s) => {
      let failed = true;
      s.mock.method(globalThis, "fetch", async () => failed ? Response.json({ error: { message: "private upstream detail" } }, { status: 429 }) : aiResponse());
      const result = await summaryRoute.POST(request("POST", { documentId: document.id }), context());
      assert.equal(result.status, 429);
      assert.doesNotMatch(await result.text(), /private upstream/);
      failed = false;
      assert.equal((await summaryRoute.POST(request("POST", { documentId: document.id }), context())).status, 200);
    });
    await t.test("같은 PDF의 AI 동시 요청은 한 번만 실행", async (s) => {
      const started = Promise.withResolvers<void>();
      const finished = Promise.withResolvers<Response>();
      s.mock.method(globalThis, "fetch", async () => { started.resolve(); return finished.promise; });
      const first = summaryRoute.POST(request("POST", { documentId: document.id }), context());
      await started.promise;
      try {
        assert.equal((await summaryRoute.POST(request("POST", { documentId: document.id }), context())).status, 429);
      } finally { finished.resolve(aiResponse()); }
      assert.equal((await first).status, 200);
    });
    await t.test("AI 요청 취소 시 대기 상태를 해제", async (s) => {
      const abort = new AbortController();
      s.mock.method(globalThis, "fetch", async () => { abort.abort(); throw new Error("테스트 요청 취소"); });
      const req = new Request(request("POST", { documentId: document.id }), { signal: abort.signal });
      assert.equal((await summaryRoute.POST(req, context())).status, 504);
    });
    await t.test("생성 중 PDF가 교체되면 이전 원문의 AI 응답은 폐기", async (s) => {
      const originalId = document.id;
      s.mock.method(globalThis, "fetch", async () => {
        db.prepare("UPDATE paper_documents SET id=? WHERE paperId=?").run("00000000-0000-4000-8000-000000000001", id);
        return aiResponse();
      });
      assert.equal((await summaryRoute.POST(request("POST", { documentId: originalId }), context())).status, 409);
      document = (await getDocumentInfo(id))!;
    });
    await t.test("본문이 없는 PDF는 첨부되지만 AI 요약을 요청할 수 없음", async () => {
      assert.equal((await pdfRoute.POST(upload(makePdf([""]), 2), context())).status, 200);
      document = (await getDocumentInfo(id))!;
      assert.equal((await summaryRoute.POST(request("POST", { documentId: document.id }), context())).status, 422);
    });
    await t.test("첨부 삭제는 버전을 확인하고 논문 삭제 시 원본도 함께 삭제", async () => {
      assert.equal((await pdfRoute.DELETE(request("DELETE", { revision: 2 }), context())).status, 409);
      assert.equal((await pdfRoute.DELETE(request("DELETE", { revision: 3 }), context())).status, 200);
      assert.equal(await getDocumentInfo(id), undefined);
      assert.equal((await pdfRoute.POST(upload(fixture, 4), context())).status, 200);
      assert.equal((await paperRoute.DELETE(request("DELETE", { revision: 5 }), context())).status, 200);
      assert.equal(await getDocumentInfo(id), undefined);
      assert.equal((await pdfRoute.GET(request("GET"), context())).status, 404);
    });
  } finally {
    db.close();
    if (dirname(testDirectory) !== testRoot) throw new Error("테스트 폴더 정리 경로가 올바르지 않습니다.");
    rmSync(testDirectory, { recursive: true });
  }
});
