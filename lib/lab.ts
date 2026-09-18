export const lab = {
  name: "우리 연구실",
  disciplines: "인공지능 · 의생명과학 · 병리학",
  members: [
    { name: "노명균", initials: "노", role: "교수", department: "병리학", description: "병리학 분야의 연구와 교육을 담당합니다.", type: "faculty" },
    { name: "Amin", initials: "A", role: "박사과정", department: "의생명과학과", description: "의생명과학과에서 박사과정을 진행하고 있습니다.", type: "doctoral" },
    { name: "이해찬", initials: "이", role: "석사과정", department: "인공지능학과", description: "인공지능학과에서 석사과정을 진행하고 있습니다.", type: "masters" },
  ],
} as const;
