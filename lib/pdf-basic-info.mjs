function clean(value, limit) {
  if (typeof value !== "string") return "";
  return value.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim().slice(0, limit).replace(/[\uD800-\uDBFF]$/, "").trim();
}

function metadataValue(value, limit) {
  const text = clean(Array.isArray(value) ? value.filter(item => typeof item === "string").join(", ") : value, limit);
  if (/^(?:untitled(?: document)?|unknown|anonymous|author|title|document|user|administrator|admin|none|n\/a)$/i.test(text)) return "";
  if (/^(?:microsoft\s+(?:word|office)|libreoffice|adobe\s+acrobat|acrobat|pdftex|pdflatex|latex|tex|overleaf)(?:\b|$)/i.test(text)) return "";
  if (/\.(?:docx?|tex|pdf)$/i.test(text)) return "";
  return text;
}

const sectionStart = /^(?:(?:\d+(?:\.\d+)*|[IVX]+)[.)]?\s+)?(?:abstract|introduction|references|bibliography|keywords|key words|초록|요약|서론|참고문헌)(?:\b|\s|[:.—–-]|$)/i;
const affiliation = /\b(?:department|university|institute|institution|laboratory|school|faculty|hospital|college|center|centre|journal|proceedings|press|copyright|published|accepted|received|affiliations?)\b|대학교|대학원|연구소|소속|학과|병원|@/i;

function textLines(items) {
  const lines = [];
  const textItems = items.filter(item => typeof item.str === "string" && item.str.trim() && Array.isArray(item.transform));
  textItems.sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  for (const item of textItems) {
    const size = Math.hypot(item.transform[2], item.transform[3]);
    // 회전된 여백 문구와 아주 작은 위첨자는 제목 후보로 사용하지 않습니다.
    if (!Number.isFinite(size) || size < 4 || Math.abs(item.transform[1]) > Math.abs(item.transform[0])) continue;
    const y = item.transform[5];
    let line = lines.slice(-4).find(candidate => Math.abs(candidate.y - y) <= Math.min(size, candidate.size) * 0.35);
    if (!line) {
      line = { y, size, parts: [] };
      lines.push(line);
    }
    line.size = Math.max(line.size, size);
    line.parts.push({ text: item.str, x: item.transform[4] });
  }
  return lines.sort((a, b) => b.y - a.y).map(line => ({
    y: line.y,
    size: line.size,
    text: clean(line.parts.sort((a, b) => a.x - b.x).map(part => part.text).join(" "), 4000),
  }));
}

function authorLine(text, limit) {
  if (affiliation.test(text) || sectionStart.test(text) || text.length > limit) return "";
  const names = text.replace(/[\d¹²³⁴⁵⁶⁷⁸⁹⁰*†‡§]+/g, "").trim().replace(/^by\s+/i, "")
    .split(/\s*(?:,|;|\band\b|&|·)\s*/i).filter(Boolean);
  if (!names.length || names.length > 20) return "";
  const nameWord = /^(?:\p{Lu}[\p{L}'’.-]*|van|von|de|del|da|di|le)$/u;
  for (const name of names) {
    if (/^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,5}$/u.test(name)) continue;
    const words = name.trim().split(/\s+/);
    if (words.length < 2 || words.length > 5 || !words.every(word => nameWord.test(word))) return "";
  }
  return names.join(", ");
}

function layoutInfo(lines, pageHeight, authorLimit) {
  const boundary = lines.findIndex(line => sectionStart.test(line.text));
  const header = lines.slice(0, Math.min(boundary < 0 ? 40 : boundary, 40));
  const bodyLines = boundary >= 0 ? lines.slice(boundary + 1) : lines;
  const sizes = bodyLines.map(line => line.size).sort((a, b) => a - b);
  const bodySize = sizes[Math.floor(sizes.length / 2)] ?? 12;
  const candidates = header.filter(line => line.y >= pageHeight * 0.5 && line.size >= 14 && line.size >= bodySize * 1.12 && !affiliation.test(line.text) && !/doi\b|https?:\/\//i.test(line.text) && line.text.length >= 8);
  const doiLines = boundary >= 0 ? header : header.filter(line => line.y >= pageHeight * 0.5 && /^(?:doi\s*:|https?:\/\/(?:dx\.)?doi\.org\/|10\.\d)/i.test(line.text));
  if (!candidates.length) return { title: "", authors: "", doiLines };
  const largestSize = Math.max(...candidates.map(line => line.size));
  const titleStart = header.findIndex(line => candidates.includes(line) && line.size >= largestSize * 0.92);
  let titleEnd = titleStart;
  while (titleEnd + 1 < header.length) {
    const previous = header[titleEnd];
    const next = header[titleEnd + 1];
    if (next.size < largestSize * 0.85 || next.size > largestSize * 1.15 || previous.y - next.y > largestSize * 2 || affiliation.test(next.text)) break;
    titleEnd++;
  }
  const title = header.slice(titleStart, titleEnd + 1).map(line => line.text).join(" ");
  const authors = [];
  for (let index = titleEnd + 1; index < Math.min(header.length, titleEnd + 5); index++) {
    const line = header[index];
    if (header[index - 1].y - line.y > largestSize * 2.5) break;
    const author = authorLine(line.text, authorLimit);
    if (!author) break;
    authors.push(author);
  }
  return { title, authors: authors.join(", "), doiLines };
}

function doiUrl(value, limit) {
  if (typeof value !== "string") return "";
  const matches = value.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi) ?? [];
  const dois = new Set(matches.map(match => {
    let doi = match.replace(/[.,;:]+$/, "");
    while (doi.endsWith(")") && (doi.match(/\)/g)?.length ?? 0) > (doi.match(/\(/g)?.length ?? 0)) doi = doi.slice(0, -1);
    return doi;
  }));
  if (dois.size !== 1) return "";
  const url = "https://doi.org/" + [...dois][0];
  return url.length <= limit ? url : "";
}

// 메타데이터를 우선하고, 없을 때만 첫 페이지의 명확한 제목·저자 행을 사용합니다.
export function extractBasicInfo({ info = {}, metadata = null, items = [], pageHeight = 0 }, limits) {
  const readMetadata = key => metadata?.get(key);
  const lines = textLines(items);
  const layout = layoutInfo(lines, pageHeight, limits.authors);
  const title = metadataValue(readMetadata("dc:title"), limits.title) || metadataValue(info.Title, limits.title) || clean(layout.title, limits.title);
  const authors = metadataValue(readMetadata("dc:creator"), limits.authors) || metadataValue(info.Author, limits.authors) || clean(layout.authors, limits.authors);
  const identifiers = [readMetadata("prism:doi"), readMetadata("dc:identifier"), info.Subject, info.Keywords];
  let url = "";
  for (const identifier of identifiers) {
    const value = Array.isArray(identifier) ? identifier.join(" ") : identifier;
    if (typeof value === "string" && /^(?:doi\s*:\s*|https?:\/\/(?:dx\.)?doi\.org\/|10\.\d)/i.test(value.trim())) url = doiUrl(value, limits.url);
    if (url) break;
  }
  // 본문과 참고문헌의 인용 DOI를 원문 주소로 잘못 채우지 않도록 머리말만 검사합니다.
  if (!url) url = doiUrl(layout.doiLines.map(line => line.text).join("\n"), limits.url);
  return { title, authors, url };
}
