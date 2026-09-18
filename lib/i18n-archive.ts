import type { Locale } from "@/lib/i18n";

const archiveMessages = {
  ko: {
    dateLocale: "ko-KR",
    searchLabel: "논문 검색",
    searchPlaceholder: "논문 제목, 저자, 발표자 검색",
    statusFilterLabel: "발표 상태 필터",
    all: "전체",
    noMatchesTitle: "조건에 맞는 논문이 없습니다.",
    noMatchesDescription: "검색어나 발표 상태를 바꿔보세요.",
    emptyTitle: "첫 번째 논문을 함께 읽어볼까요?",
    emptyDescription: "랩미팅에서 나눌 논문을 등록하고 핵심 내용을 정리해보세요.",
    addFirstPaper: "첫 논문 등록하기",
    missingAuthors: "저자 미입력",
    presentationDate: "발표일",
    presenter: "발표자",
    undecided: "미정",
    discussion: "랩미팅 토론",
    guest: "방문자",
    noComments: "아직 토론 기록이 없습니다. 랩미팅에서 나온 질문이나 의견을 남겨주세요.",
    commentLabel: "토론 기록",
    commentPlaceholder: "함께 나눈 질문, 해석, 후속 연구 아이디어를 기록해주세요.",
    saving: "저장 중…",
    addComment: "토론 남기기",
  },
  en: {
    dateLocale: "en-US",
    searchLabel: "Search papers",
    searchPlaceholder: "Search by paper title, author, or presenter",
    statusFilterLabel: "Presentation status filter",
    all: "All",
    noMatchesTitle: "No papers match your search.",
    noMatchesDescription: "Try a different search or presentation status.",
    emptyTitle: "Ready to read our first paper together?",
    emptyDescription: "Add a paper for a lab meeting and summarize its key points.",
    addFirstPaper: "Add the first paper",
    missingAuthors: "Authors not provided",
    presentationDate: "Presentation date",
    presenter: "Presenter",
    undecided: "To be decided",
    discussion: "Discussion",
    guest: "Guest",
    noComments: "No discussion yet. Share questions or thoughts from the lab meeting.",
    commentLabel: "Discussion notes",
    commentPlaceholder: "Record questions, interpretations, and ideas for future research.",
    saving: "Saving…",
    addComment: "Add discussion",
  },
} as const;

export function getArchiveMessages(locale: Locale) {
  return archiveMessages[locale];
}

export function formatArchiveDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(archiveMessages[locale].dateLocale, { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(value));
}
