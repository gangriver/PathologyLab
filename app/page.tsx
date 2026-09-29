import Link from "next/link";
import { Fragment } from "react";
import { SiteHeader } from "@/components/site-header";
import { getLab } from "@/lib/lab";
import { getLocale } from "@/lib/locale-server";
import { getSiteCopy } from "@/lib/i18n-site";
import { getLabContentCopy } from "@/lib/lab-content-copy";
import { collections } from "@/lib/lab-content-types";

export default async function Home() {
  const locale = await getLocale();
  const lab = getLab(locale);
  const copy = getSiteCopy(locale);
  const contentCopy = getLabContentCopy(locale);
  return <><SiteHeader /><main id="main">
    <section className="shell members-section" id="members">
      <div className="section-eyebrow"><span className="status-dot" /> {lab.disciplines}</div>
      <div className="hero-heading"><h1>{copy.home.heading.map((line,index) => <Fragment key={index}>{index > 0 && <br />}{line}</Fragment>)}<span className="blue">.</span></h1><p>{copy.home.introduction[0]} <br />{copy.home.introduction[1]} <br /><span>{copy.home.introduction[2]}</span></p></div>
      <div className="section-label"><h2>{copy.home.members}</h2><span>{copy.home.memberCount(lab.members.length)}</span></div>
      <div className="member-grid">{lab.members.map((member, index) =>
        <article className={"member-card " + member.type} key={member.name}>
          <div className="member-top"><span className="member-index">0{index + 1}</span><span className="role-pill">{member.role}</span></div>
          <div className="member-monogram" aria-hidden="true">{member.initials}<span /></div>
          <div className="member-info"><p className="member-department">{member.department}</p><h3>{member.name}<span>{member.type === "faculty" ? copy.home.facultyTitle : member.role}</span></h3><p>{member.description}</p></div>
        </article>)}</div>
    </section>
    <section className="shell lab-overview"><div className="section-label"><h2>{contentCopy.labHeading}</h2></div><div className="lab-overview-grid">{collections.map((collection,index) => <Link href={`/${collection}`} className="lab-overview-card" key={collection}><span className="lab-entry-year">0{index+1}</span><h3>{contentCopy[collection].title}</h3><p>{contentCopy[collection].description}</p><span className="lab-entry-link">{contentCopy.view}</span></Link>)}</div></section>
    <section className="archive-intro"><div className="shell archive-grid"><div><div className="section-eyebrow">{copy.common.archiveEyebrow}</div><h2>{copy.home.archiveHeading.map((line,index) => <Fragment key={index}>{index > 0 && <br />}{line}</Fragment>)}</h2><p>{copy.home.archiveDescription[0]}<br />{copy.home.archiveDescription[1]}</p><Link href="/papers" className="button">{copy.home.openArchive} <span aria-hidden="true">↗</span></Link><p className="access-note">{copy.home.accessNote}</p></div>
    <div className="archive-features">{copy.home.archiveFeatures.map(([number, title, text]) => <div className="archive-feature" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><span aria-hidden="true">↗</span></div>)}</div></div></section>
  </main><footer className="shell footer"><span>{lab.name}</span><p>{lab.disciplines}</p><span>{copy.home.footer}</span></footer></>;
}
