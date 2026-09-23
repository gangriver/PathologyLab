import type { Locale } from "@/lib/i18n";

const siteCopy = {
  ko: {
    common: {
      archiveTitle: "논문 아카이브",
      addPaper: "논문 등록",
      paperDetails: "논문 상세",
      archiveEyebrow: "누구나 함께하는 연구 기록",
    },
    home: {
      heading: ["Spatial-Omics Lab을", "함께 만드는 사람들"],
      introduction: ["각자의 분야에서 깊이 있게.", "함께하는 자리에서 더 넓게.", "Spatial-Omics Lab의 멤버를 소개합니다."],
      members: "연구실 멤버",
      memberCount: (count: number) => `함께하는 ${count}명`,
      facultyTitle: "교수님",
      archiveHeading: ["함께 읽은 논문이", "우리의 다음 연구로."],
      archiveDescription: ["논문의 핵심부터 랩미팅에서 나눈 질문까지.", "함께 읽고 토론한 내용을 한곳에 쌓아갑니다."],
      openArchive: "논문 아카이브 열기",
      accessNote: "누구나 논문을 등록·열람·수정·삭제하고 토론에 참여할 수 있습니다.",
      archiveFeatures: [
        ["01", "논문 등록", "제목, 저자, 원문 링크를 모아 관리합니다."],
        ["02", "핵심 내용과 한계점", "연구 질문과 방법, 결과, 한계점을 정리합니다."],
        ["03", "랩미팅 기록", "발표일과 발표자, 함께 나눈 토론을 남깁니다."],
      ],
      footer: "함께 연구하고, 함께 기록합니다.",
    },
    papers: {
      description: "함께 읽은 논문과 랩미팅에서 나눈 생각을 모읍니다.",
      loading: "논문 공간을 불러오는 중입니다…",
    },
    newPaper: {
      heading: "새 논문 등록",
      description: "PDF로 기본 정보를 자동 입력하거나 직접 입력할 수 있습니다. 등록 방식을 선택해주세요.",
    },
    paper: {
      noAuthors: "저자 미입력",
      noNotes: "아직 정리한 내용이 없습니다.",
      meetingInformation: "랩미팅 정보",
      meetingDate: "발표일",
      presenter: "발표자",
      updatedAt: "마지막 수정",
      undecided: "미정",
      attachedPdf: (count: number) => `첨부 PDF · ${count}쪽`,
      readOriginal: "원문 읽기",
      referenceLinks: "참고 링크",
      attachAndSummarize: "PDF 첨부·AI 요약",
    },
    editPaper: {
      title: "논문 수정",
      heading: "논문 정리 수정",
      description: "핵심 내용과 발표 기록을 업데이트해주세요.",
    },
    error: {
      heading: "페이지를 불러오지 못했습니다.",
      description: "잠시 후 다시 시도해주세요.",
      retry: "다시 시도",
    },
    notFound: {
      heading: "페이지를 찾을 수 없습니다.",
      description: "주소를 확인하거나 홈으로 돌아가주세요.",
      backHome: "홈으로 돌아가기",
    },
  },
  en: {
    common: {
      archiveTitle: "Paper Archive",
      addPaper: "Add Paper",
      paperDetails: "Paper Details",
      archiveEyebrow: "Research records open to everyone",
    },
    home: {
      heading: ["The people", "who make our lab"],
      introduction: ["Going deeper in our own fields.", "Growing together through collaboration.", "Meet the members of our lab."],
      members: "Lab Members",
      memberCount: (count: number) => `${count} members`,
      facultyTitle: "Professor",
      archiveHeading: ["The papers we read together", "inspire our next research."],
      archiveDescription: ["From key findings to questions raised in lab meetings.", "We keep what we read and discuss together in one place."],
      openArchive: "Open Paper Archive",
      accessNote: "Anyone can add, read, edit, and delete papers and join the discussion.",
      archiveFeatures: [
        ["01", "Add Papers", "Keep titles, authors, and links to original papers together."],
        ["02", "Key Findings and Limitations", "Record research questions, methods, results, and limitations."],
        ["03", "Lab Meeting Notes", "Keep track of presentation dates, presenters, and discussions."],
      ],
      footer: "Researching together. Keeping records together.",
    },
    papers: {
      description: "A collection of papers we read and ideas we share in lab meetings.",
      loading: "Loading the paper archive…",
    },
    newPaper: {
      heading: "Add a New Paper",
      description: "Fill in basic details automatically from a PDF or enter them yourself. Choose how to add your paper.",
    },
    paper: {
      noAuthors: "No authors entered",
      noNotes: "No notes yet.",
      meetingInformation: "Lab Meeting Information",
      meetingDate: "Presentation date",
      presenter: "Presenter",
      updatedAt: "Last updated",
      undecided: "To be decided",
      attachedPdf: (count: number) => `Attached PDF · ${count} ${count === 1 ? "page" : "pages"}`,
      readOriginal: "Read Original Paper",
      referenceLinks: "Reference links",
      attachAndSummarize: "Attach PDF · AI Summary",
    },
    editPaper: {
      title: "Edit Paper",
      heading: "Edit Paper Notes",
      description: "Update the key findings and presentation details.",
    },
    error: {
      heading: "The page could not be loaded.",
      description: "Please try again in a moment.",
      retry: "Try Again",
    },
    notFound: {
      heading: "Page not found.",
      description: "Check the address or return to the home page.",
      backHome: "Back to Home",
    },
  },
} as const;

export function getSiteCopy(locale: Locale) {
  return siteCopy[locale];
}
