"use client";
import { useLocale } from "@/hooks/use-locale";
import { getSiteCopy } from "@/lib/i18n-site";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { locale } = useLocale();
  const copy = getSiteCopy(locale);
  return <main id="main" className="shell page-shell"><div className="empty-state"><h1>{copy.error.heading}</h1><p>{copy.error.description}</p><button className="button" onClick={reset}>{copy.error.retry}</button></div></main>;
}
