import { z } from "zod";

export const collections = ["publications", "projects", "gallery"] as const;
export type Collection = typeof collections[number];
export function isCollection(value: string): value is Collection {
  return collections.some(collection => collection === value);
}
const text = (max = 2000) => z.string().trim().max(max).default("");
const title = z.string().trim().min(1).max(500);
const date = z.string().refine(value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value)).default("");
const url = text().refine(value => {
  if (!value) return true;
  try { const parsed = new URL(value); return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password; }
  catch { return false; }
});
export const contentSchemas = {
  publications: z.object({ title, authors: text(), journal: text(500), year: z.string().regex(/^\d{4}$/).refine(value => +value >= 1000 && +value <= 2200), url, summary: text(10000) }).strict(),
  projects: z.object({ title, summary: text(10000), lead: text(500), funder: text(500), grantNumber: text(500), startDate: date, endDate: date, url }).strict().refine(value => !value.startDate || !value.endDate || value.startDate <= value.endDate),
  gallery: z.object({ title, caption: text(5000), date }).strict(),
};
export type ContentData = { title: string; authors?: string; journal?: string; year?: string; url?: string; summary?: string; lead?: string; funder?: string; grantNumber?: string; startDate?: string; endDate?: string; caption?: string; date?: string };
export type LabEntry = { id: string; collection: Collection; data: ContentData; createdAt: string; updatedAt: string; revision: number; imageKey: string; imageType: string };
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
