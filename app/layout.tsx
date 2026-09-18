import type { Metadata } from "next";
import { lab } from "@/lib/lab";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: lab.name, template: "%s | " + lab.name },
  description: "인공지능, 의생명과학, 병리학을 함께 공부하는 연구실의 멤버 소개와 누구나 함께 기록하는 논문 아카이브입니다.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><a className="skip-link" href="#main">본문으로 이동</a>{children}</body></html>;
}
