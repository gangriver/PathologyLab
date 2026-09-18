import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { lab } from "@/lib/lab";

export default function Home() {
  return <><SiteHeader /><main id="main">
    <section className="shell members-section" id="members">
      <div className="section-eyebrow"><span className="status-dot" /> {lab.disciplines}</div>
      <div className="hero-heading"><h1>우리 연구실을<br />함께 만드는 사람들<span className="blue">.</span></h1><p>각자의 분야에서 깊이 있게.<br />함께하는 자리에서 더 넓게.<br /><span>우리 연구실의 멤버를 소개합니다.</span></p></div>
      <div className="section-label"><h2>연구실 멤버</h2><span>함께하는 3명</span></div>
      <div className="member-grid">{lab.members.map((member, index) =>
        <article className={"member-card " + member.type} key={member.name}>
          <div className="member-top"><span className="member-index">0{index + 1}</span><span className="role-pill">{member.role}</span></div>
          <div className="member-monogram" aria-hidden="true">{member.initials}<span /></div>
          <div className="member-info"><p className="member-department">{member.department}</p><h3>{member.name}<span>{member.role === "교수" ? "교수님" : member.role}</span></h3><p>{member.description}</p></div>
        </article>)}</div>
    </section>
    <section className="archive-intro"><div className="shell archive-grid"><div><div className="section-eyebrow">누구나 함께하는 연구 기록</div><h2>함께 읽은 논문이<br />우리의 다음 연구로.</h2><p>논문의 핵심부터 랩미팅에서 나눈 질문까지.<br />함께 읽고 토론한 내용을 한곳에 쌓아갑니다.</p><Link href="/papers" className="button">논문 아카이브 열기 <span aria-hidden="true">↗</span></Link><p className="access-note">누구나 논문을 등록·열람·수정·삭제하고 토론에 참여할 수 있습니다.</p></div>
    <div className="archive-features">{[
      ["01", "논문 등록", "제목, 저자, 원문 링크를 모아 관리합니다."],
      ["02", "핵심 내용과 한계점", "연구 질문과 방법, 결과, 한계점을 정리합니다."],
      ["03", "랩미팅 기록", "발표일과 발표자, 함께 나눈 토론을 남깁니다."],
    ].map(([number, title, text]) => <div className="archive-feature" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><span aria-hidden="true">↗</span></div>)}</div></div></section>
  </main><footer className="shell footer"><span>{lab.name}</span><p>{lab.disciplines}</p><span>함께 연구하고, 함께 기록합니다.</span></footer></>;
}
