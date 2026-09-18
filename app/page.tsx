import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getLab } from "@/lib/lab";
import { getLocale } from "@/lib/locale-server";
import { getSiteCopy } from "@/lib/i18n-site";

export default async function Home() {
  const locale = await getLocale();
  const lab = getLab(locale);
  const copy = getSiteCopy(locale);
  return <><SiteHeader /><main id="main">
    <section className="shell members-section" id="members">
      <div className="section-eyebrow"><span className="status-dot" /> {lab.disciplines}</div>
      <div className="hero-heading"><h1>{copy.home.heading[0]}<br />{copy.home.heading[1]}<span className="blue">.</span></h1><p>{copy.home.introduction[0]} <br />{copy.home.introduction[1]} <br /><span>{copy.home.introduction[2]}</span></p></div>
      <div className="section-label"><h2>{copy.home.members}</h2><span>{copy.home.memberCount(lab.members.length)}</span></div>
      <div className="member-grid">{lab.members.map((member, index) =>
        <article className={"member-card " + member.type} key={member.name}>
          <div className="member-top"><span className="member-index">0{index + 1}</span><span className="role-pill">{member.role}</span></div>
          <div className="member-monogram" aria-hidden="true">{member.initials}<span /></div>
          <div className="member-info"><p className="member-department">{member.department}</p><h3>{member.name}<span>{member.type === "faculty" ? copy.home.facultyTitle : member.role}</span></h3><p>{member.description}</p></div>
        </article>)}</div>
    </section>
    <section className="archive-intro"><div className="shell archive-grid"><div><div className="section-eyebrow">{copy.common.archiveEyebrow}</div><h2>{copy.home.archiveHeading[0]}<br />{copy.home.archiveHeading[1]}</h2><p>{copy.home.archiveDescription[0]}<br />{copy.home.archiveDescription[1]}</p><Link href="/papers" className="button">{copy.home.openArchive} <span aria-hidden="true">↗</span></Link><p className="access-note">{copy.home.accessNote}</p></div>
    <div className="archive-features">{copy.home.archiveFeatures.map(([number, title, text]) => <div className="archive-feature" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><span aria-hidden="true">↗</span></div>)}</div></div></section>
  </main><footer className="shell footer"><span>{lab.name}</span><p>{lab.disciplines}</p><span>{copy.home.footer}</span></footer></>;
}
