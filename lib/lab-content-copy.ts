import type { Locale } from "./i18n";

const copy = {
  ko: {
    publications: { title: "Lab Publications", description: "우리 연구실에서 발표한 논문을 모았습니다.", add: "연구실 논문 등록", empty: "아직 등록된 연구실 논문이 없습니다." },
    projects: { title: "Ongoing Research Projects", description: "현재 수행 중인 연구 프로젝트와 지원 과제입니다.", add: "프로젝트 등록", empty: "아직 등록된 프로젝트가 없습니다." },
    gallery: { title: "Gallery", description: "연구실의 일상, 학회와 함께한 순간을 기록합니다.", add: "사진 올리기", empty: "아직 등록된 사진이 없습니다." },
    labels: { title: "제목", authors: "저자", journal: "학술지", year: "발표 연도", url: "DOI 또는 관련 웹 주소", summary: "소개 / 요약", lead: "연구책임자 / 참여 연구자", funder: "지원기관", grantNumber: "과제번호", startDate: "시작일", endDate: "종료일", caption: "사진 설명", date: "촬영일" },
    save: "저장", saving: "저장 중…", edit: "수정", remove: "삭제", cancel: "취소", back: "목록으로", open: "원문 / 관련 링크 ↗", photo: "사진 파일", imageHelp: "JPG, PNG, WebP · 최대 3MB", confirmDelete: "이 항목을 삭제할까요? 삭제한 내용은 복원할 수 없습니다.", failed: "처리하지 못했습니다. 입력 내용과 연결 상태를 확인해주세요.", invalid: "입력값을 확인해주세요. 웹 주소는 https:// 또는 http://로 시작해야 하며 종료일은 시작일 이후여야 합니다.", conflict: "다른 곳에서 내용이 변경되었습니다. 새로고침 후 다시 확인해주세요.", unavailable: "자료를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", required: "필수", labHeading: "연구와 연구실 소식", view: "살펴보기 ↗",
  },
  en: {
    publications: { title: "Lab Publications", description: "Research published by members of our laboratory.", add: "Add Publication", empty: "No lab publications have been added yet." },
    projects: { title: "Ongoing Research Projects", description: "Our current research projects and funded studies.", add: "Add Project", empty: "No research projects have been added yet." },
    gallery: { title: "Gallery", description: "Moments from lab life, conferences, and time together.", add: "Upload Photo", empty: "No photos have been added yet." },
    labels: { title: "Title", authors: "Authors", journal: "Journal", year: "Publication Year", url: "DOI or Related URL", summary: "Description / Summary", lead: "Principal Investigator / Researchers", funder: "Funding Agency", grantNumber: "Grant Number", startDate: "Start Date", endDate: "End Date", caption: "Photo Caption", date: "Photo Date" },
    save: "Save", saving: "Saving…", edit: "Edit", remove: "Delete", cancel: "Cancel", back: "Back to list", open: "Read paper / Related link ↗", photo: "Photo file", imageHelp: "JPG, PNG, WebP · up to 3MB", confirmDelete: "Delete this entry? This cannot be undone.", failed: "Unable to complete the request. Check your input and connection.", invalid: "Check the fields. URLs must start with https:// or http://, and the end date must not precede the start date.", conflict: "This entry was changed elsewhere. Refresh the page and try again.", unavailable: "Unable to load entries. Please try again shortly.", required: "Required", labHeading: "Research and lab life", view: "Explore ↗",
  },
} as const;
export function getLabContentCopy(locale: Locale) { return copy[locale]; }
