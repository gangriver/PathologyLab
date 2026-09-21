export const PDF_LIMITS = {
  maxBytes: 50 * 1024 * 1024,
  maxPages: 100,
  maxTextCharacters: 200000,
  parseTimeoutMs: 15000,
  maxConcurrentParsers: 2,
  uploadTimeoutMs: 30000,
  cloudFinalizeTimeoutMs: 250000,
  summaryTimeoutMs: 90000,
  summaryClientTimeoutMs: 105000,
} as const;

export type PdfPage = { pageNumber: number; text: string };
export type PaperBasicInfo = { title: string; authors: string; url: string };
export type ExtractedPdf = { pages: PdfPage[]; pageCount: number; textCharacters: number; basicInfo: PaperBasicInfo };
export type PaperDocumentInfo = {
  id: string; paperId: string; filename: string; byteLength: number; pageCount: number;
  textCharacters: number; uploadedAt: string;
};
export type PaperDocument = PaperDocumentInfo & { content: Uint8Array; pagesJson: string };
export type SummarySection = { text: string; pages: number[] };
export type PaperSummary = {
  documentId: string; filename: string; title: string; authors: string;
  researchQuestion: SummarySection; methods: SummarySection; findings: SummarySection; limitations: SummarySection;
};
