// 외부 파일 없이 텍스트 추출과 페이지 제한을 검증하는 최소 PDF입니다.
type PdfFixtureOptions = {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  xmp?: string;
  byteLength?: number;
  firstPageLines?: { text: string; fontSize?: number; y?: number }[];
};

function pdfString(text: string) {
  const bytes = Buffer.from(text, "utf16le");
  bytes.swap16();
  return "<FEFF" + bytes.toString("hex").toUpperCase() + ">";
}

export function makePdf(pages: string[], options: PdfFixtureOptions = {}): Uint8Array {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const pageIds: number[] = [];
  for (const [pageIndex, text] of pages.entries()) {
    const pageId = objects.length + 1;
    pageIds.push(pageId);
    const lines: NonNullable<PdfFixtureOptions["firstPageLines"]> = pageIndex === 0 && options.firstPageLines ? options.firstPageLines : [{ text }];
    const stream = lines.map((line, index) => {
      const escaped = line.text.replace(/([\\()])/g, "\\$1");
      return "BT /F1 " + (line.fontSize ?? 12) + " Tf 50 " + (line.y ?? 700 - index * 28) + " Td (" + escaped + ") Tj ET";
    }).join("\n");
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents " + (pageId + 1) + " 0 R >>");
    objects.push("<< /Length " + Buffer.byteLength(stream) + " >>\nstream\n" + stream + "\nendstream");
  }
  objects[1] = "<< /Type /Pages /Count " + pages.length + " /Kids [" + pageIds.map(id => id + " 0 R").join(" ") + "] >>";
  const entries = [["Title", options.title], ["Author", options.author], ["Subject", options.subject], ["Keywords", options.keywords]] as const;
  const info = entries.filter((entry): entry is readonly [typeof entry[0], string] => entry[1] !== undefined);
  const infoId = info.length ? objects.push("<< " + info.map(([key, value]) => "/" + key + " " + pdfString(value)).join(" ") + " >>") : undefined;
  if (options.xmp) {
    const metadataId = objects.push("<< /Type /Metadata /Subtype /XML /Length " + Buffer.byteLength(options.xmp) + " >>\nstream\n" + options.xmp + "\nendstream");
    objects[0] = "<< /Type /Catalog /Pages 2 0 R /Metadata " + metadataId + " 0 R >>";
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += (index + 1) + " 0 obj\n" + objects[index] + "\nendobj\n";
  }
  const xref = Buffer.byteLength(pdf);
  pdf += "xref\n0 " + offsets.length + "\n0000000000 65535 f \n";
  pdf += offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("");
  pdf += "trailer\n<< /Size " + offsets.length + " /Root 1 0 R" + (infoId ? " /Info " + infoId + " 0 R" : "") + " >>\nstartxref\n" + xref + "\n%%EOF\n";
  const content = Buffer.from(pdf);
  if (options.byteLength === undefined) return new Uint8Array(content);
  // 객체 오프셋은 유지하고 마지막 startxref 앞에 공백을 채웁니다.
  const split = content.lastIndexOf("startxref\n");
  const padded = new Uint8Array(options.byteLength).fill(32);
  padded.set(content.subarray(0, split));
  padded.set(content.subarray(split), padded.length - (content.length - split));
  return padded;
}
