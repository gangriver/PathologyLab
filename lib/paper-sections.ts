import type { Locale } from "./i18n";

export const paperSections = [
  { key: "researchQuestion", label: "연구 질문", placeholder: "어떤 문제를 풀기 위한 연구인가요?" },
  { key: "methods", label: "연구 방법", placeholder: "사용한 데이터, 실험 설계와 분석 방법을 정리해주세요." },
  { key: "findings", label: "핵심 내용", placeholder: "주요 결과와 이 논문의 기여를 정리해주세요." },
  { key: "limitations", label: "한계점", placeholder: "연구의 한계, 해석에 주의할 점과 후속 질문을 남겨주세요." },
] as const;

const englishSections: Record<typeof paperSections[number]["key"], { label: string; placeholder: string }> = {
  researchQuestion: { label: "Research question", placeholder: "What problem does this study address?" },
  methods: { label: "Methods", placeholder: "Describe the data, study design, and analysis methods." },
  findings: { label: "Key findings", placeholder: "Summarize the main results and contributions of this paper." },
  limitations: { label: "Limitations", placeholder: "Note limitations, caveats, and questions for future research." },
};
export function getPaperSections(locale: Locale) {
  return paperSections.map(section => locale === "en" ? { ...section, ...englishSections[section.key] } : section);
}
