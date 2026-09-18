"use client";
import Link from "next/link";
import { getLab } from "@/lib/lab";
import { shellCopy } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

export function SiteHeader() {
  const { locale, setLocale, pending } = useLocale();
  const lab = getLab(locale);
  const copy = shellCopy[locale];
  return <header className="site-header"><div className="shell header-inner">
    <Link href="/" className="brand" aria-label={lab.name + " " + copy.home}><span className="brand-mark" aria-hidden="true">ㄹ</span><span>{lab.name}<small>{copy.tagline}</small></span></Link>
    <div className="header-controls"><nav aria-label={copy.navigation}><Link href="/#members">{copy.members}</Link><Link href="/papers">{copy.papers}</Link><Link href="/papers/new" className="button button-small">{copy.register} <span aria-hidden="true">↗</span></Link></nav>
      <div className="language-switch" role="group" aria-label={copy.language} aria-busy={pending}>
        <button type="button" lang="ko" aria-pressed={locale === "ko"} disabled={pending} onClick={() => setLocale("ko")}>한국어</button>
        <button type="button" lang="en" aria-pressed={locale === "en"} disabled={pending} onClick={() => setLocale("en")}>EN</button>
      </div>
    </div>
  </div></header>;
}
