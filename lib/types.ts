export const paperStatuses = { planned: "발표 예정", discussed: "토론 완료" } as const;
export type PaperStatus = keyof typeof paperStatuses;
export type Paper = {
  id: string; title: string; authors: string; url: string; researchQuestion: string;
  methods: string; findings: string; limitations: string; meetingDate: string;
  presenter: string; status: PaperStatus; creatorName: string;
  createdAt: string; updatedAt: string; revision: number;
};
export type Comment = { id: string; paperId: string; authorName: string; content: string; createdAt: string };
