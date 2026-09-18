import { parentPort, workerData } from "node:worker_threads";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractBasicInfo } from "./pdf-basic-info.mjs";

// PDF 처리를 별도 스레드에 두어 제한 시간을 넘기면 부모가 종료할 수 있게 합니다.
const task = getDocument({
  data: new Uint8Array(workerData.content),
  stopAtErrors: true,
  isEvalSupported: false,
  useSystemFonts: false,
  verbosity: 0,
});
try {
  const document = await task.promise;
  if (document.numPages > workerData.maxPages) {
    parentPort.postMessage({ error: "pages" });
  } else {
    const pages = [];
    let textCharacters = 0;
    let firstPageItems = [];
    let firstPageHeight = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        if (pageNumber === 1) {
          firstPageItems = content.items;
          firstPageHeight = page.getViewport({ scale: 1 }).height;
        }
        const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
        textCharacters += text.length;
        if (textCharacters > workerData.maxTextCharacters) throw new Error("text-limit");
        pages.push({ pageNumber, text });
      } finally {
        page.cleanup();
      }
    }
    let basicInfo = { title: "", authors: "", url: "" };
    try {
      // 기본정보가 없거나 손상되어도 원본 저장과 본문 추출은 계속 진행합니다.
      const metadata = await document.getMetadata().catch(() => ({}));
      basicInfo = extractBasicInfo({ ...metadata, items: firstPageItems, pageHeight: firstPageHeight }, workerData.basicInfoLimits);
    } catch {
      // 기본정보를 확실하게 읽을 수 없는 파일은 입력란을 비워 둡니다.
    }
    parentPort.postMessage({ result: { pages, pageCount: document.numPages, textCharacters, basicInfo } });
  }
} catch (error) {
  parentPort.postMessage({ error: error?.name === "PasswordException" ? "password" : error?.message === "text-limit" ? "text" : "invalid" });
} finally {
  await task.destroy();
}
