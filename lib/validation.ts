import { z } from "zod";
import { PAPER_SUBTITLE_MAX_LENGTH, REFERENCE_LINK_LIMITS } from "./types";

const note = z.string().trim().max(12000, "각 정리는 12,000자 이내로 작성해주세요.");
const subtitle = z.string().trim().max(PAPER_SUBTITLE_MAX_LENGTH);
function isHttpUrl(value: string) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
const referenceLinks = z.array(z.object({
  label: z.string().trim().max(REFERENCE_LINK_LIMITS.maxLabelLength),
  url: z.string().trim().max(REFERENCE_LINK_LIMITS.maxUrlLength),
}).superRefine((link, context) => {
  if (Boolean(link.label) !== Boolean(link.url)) {
    context.addIssue({ code: "custom", message: "참고 링크의 이름과 URL을 모두 입력해주세요." });
  } else if (link.url && !isHttpUrl(link.url)) {
    context.addIssue({ code: "custom", message: "http 또는 https 참고 링크를 입력해주세요." });
  }
})).transform(links => links.filter(link => link.label || link.url))
  .refine(links => links.length <= REFERENCE_LINK_LIMITS.maxCount, `참고 링크는 ${REFERENCE_LINK_LIMITS.maxCount}개까지 추가할 수 있습니다.`);
const date = z.string().refine(value => {
  if (!value) return true;
  const parsed = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "올바른 발표일을 입력해주세요.");
export const paperSchema = z.object({
  title: z.string().trim().min(1, "논문 제목을 입력해주세요.").max(500),
  subtitle: subtitle.default(""),
  authors: z.string().trim().max(500),
  url: z.string().trim().max(2000).refine(value => !value || isHttpUrl(value), "http 또는 https 원문 링크를 입력해주세요."),
  referenceLinks: referenceLinks.default([]),
  researchQuestion: note, methods: note, findings: note, limitations: note,
  meetingDate: date, presenter: z.string().trim().max(100),
  status: z.enum(["planned", "discussed"]),
});
export const updatePaperSchema = paperSchema.extend({ subtitle: subtitle.optional(), referenceLinks: referenceLinks.optional(), revision: z.number().int().positive() });
export const deletePaperSchema = z.object({ revision: z.number().int().positive() });
export const commentSchema = z.object({ content: z.string().trim().min(1, "토론 내용을 입력해주세요.").max(5000) });
export type PaperInput = z.infer<typeof paperSchema>;
export type PaperUpdateInput = Omit<PaperInput, "subtitle" | "referenceLinks"> & { subtitle?: string; referenceLinks?: PaperInput["referenceLinks"] };
