import { z } from "zod";
import { PAPER_SUBTITLE_MAX_LENGTH } from "./types";

const note = z.string().trim().max(12000, "각 정리는 12,000자 이내로 작성해주세요.");
const subtitle = z.string().trim().max(PAPER_SUBTITLE_MAX_LENGTH);
const date = z.string().refine(value => {
  if (!value) return true;
  const parsed = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "올바른 발표일을 입력해주세요.");
export const paperSchema = z.object({
  title: z.string().trim().min(1, "논문 제목을 입력해주세요.").max(500),
  subtitle: subtitle.default(""),
  authors: z.string().trim().max(500),
  url: z.string().trim().max(2000).refine(value => { if (!value) return true; try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; } }, "http 또는 https 원문 링크를 입력해주세요."),
  researchQuestion: note, methods: note, findings: note, limitations: note,
  meetingDate: date, presenter: z.string().trim().max(100),
  status: z.enum(["planned", "discussed"]),
});
export const updatePaperSchema = paperSchema.extend({ subtitle: subtitle.optional(), revision: z.number().int().positive() });
export const deletePaperSchema = z.object({ revision: z.number().int().positive() });
export const commentSchema = z.object({ content: z.string().trim().min(1, "토론 내용을 입력해주세요.").max(5000) });
export type PaperInput = z.infer<typeof paperSchema>;
export type PaperUpdateInput = Omit<PaperInput, "subtitle"> & { subtitle?: string };
