import type { Locale } from "./i18n";

export const paperStatuses = { planned: "발표 예정", discussed: "토론 완료" } as const;
const englishPaperStatuses = { planned: "Planned", discussed: "Discussed" } as const;
export function getPaperStatuses(locale: Locale) { return locale === "en" ? englishPaperStatuses : paperStatuses; }
export type PaperStatus = keyof typeof paperStatuses;
export const PAPER_SUBTITLE_MAX_LENGTH = 200;
export const REFERENCE_LINK_LIMITS = { maxCount: 20, maxLabelLength: 100, maxUrlLength: 2000 } as const;
export type PaperReferenceLink = { label: string; url: string };
export type Paper = {
  id: string; title: string; subtitle: string; authors: string; url: string; referenceLinks: PaperReferenceLink[]; researchQuestion: string;
  methods: string; findings: string; limitations: string; meetingDate: string;
  presenter: string; status: PaperStatus; creatorName: string;
  createdAt: string; updatedAt: string; revision: number;
};
export type Comment = { id: string; paperId: string; authorName: string; content: string; createdAt: string };
