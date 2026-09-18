export type Locale = "ko" | "en";
export const LOCALE_COOKIE = "lab-locale";

export function normalizeLocale(value: unknown): Locale {
  return value === "en" ? "en" : "ko";
}

export function localeFromCookie(cookie: string | null): Locale {
  const value = cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(LOCALE_COOKIE + "="))?.slice(LOCALE_COOKIE.length + 1);
  return normalizeLocale(value);
}

export const shellCopy = {
  ko: {
    description: "인공지능, 의생명과학, 병리학을 함께 공부하는 연구실의 멤버 소개와 누구나 함께 기록하는 논문 아카이브입니다.",
    skip: "본문으로 이동", home: "홈", tagline: "연구와 기록의 공간", navigation: "주 메뉴",
    members: "멤버 소개", papers: "논문 아카이브", register: "논문 등록", language: "화면 언어",
  },
  en: {
    description: "Meet our researchers in artificial intelligence, biomedical science, and pathology, and explore our shared archive of papers and lab discussions.",
    skip: "Skip to content", home: "home", tagline: "A space for research and ideas", navigation: "Main navigation",
    members: "Members", papers: "Paper archive", register: "Add paper", language: "Display language",
  },
} as const;
