"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/hooks/use-locale";
import { getLabContentCopy } from "@/lib/lab-content-copy";
import type { Collection,LabEntry } from "@/lib/lab-content-types";

export function LabContentList({collection,entries}:{collection:Collection;entries:LabEntry[]}) {
  const {locale} = useLocale();
  const copy = getLabContentCopy(locale);
  const router = useRouter();
  const [busy,setBusy] = useState<string>();
  const [error,setError] = useState("");
  async function remove(entry:LabEntry) {
    if (busy || !window.confirm(copy.confirmDelete)) return;
    setBusy(entry.id);setError("");
    try {
      const response = await fetch(`/api/lab/${collection}/${entry.id}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:entry.revision})});
      if (!response.ok) throw new Error(response.status === 409 ? copy.conflict : copy.failed);
      router.refresh();
    } catch (error) {setError(error instanceof Error ? error.message : copy.failed);}
    finally {setBusy(undefined);}
  }
  if (!entries.length) return <div className="panel lab-empty"><span className="lab-empty-symbol" aria-hidden="true">{collection === "gallery" ? "▧" : "＋"}</span><h2>{copy[collection].empty}</h2><Link href={`/${collection}/new`} className="button">{copy[collection].add} +</Link></div>;
  return <>{error && <p role="alert" className="lab-error">{error}</p>}<div className={`lab-entry-grid lab-entry-grid-${collection}`}>
    {entries.map(entry => <article className="lab-entry" key={entry.id}>
      {collection === "gallery" && <a href={`/api/lab/gallery/${entry.id}/image`} target="_blank" rel="noreferrer" aria-label={entry.data.title}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lab-gallery-image" src={`/api/lab/gallery/${entry.id}/image`} alt={entry.data.caption || entry.data.title} loading="lazy" />
      </a>}
      <div className="lab-entry-body">
        {(entry.data.year || entry.data.date) && <p className="lab-entry-year">{entry.data.year || entry.data.date}</p>}
        <h2>{entry.data.title}</h2>
        {entry.data.authors && <p className="lab-entry-authors">{entry.data.authors}</p>}
        {entry.data.journal && <p className="lab-entry-journal">{entry.data.journal}</p>}
        {(entry.data.summary || entry.data.caption) && <p className="lab-entry-description">{entry.data.summary || entry.data.caption}</p>}
        {collection === "projects" && <dl className="lab-project-meta">
          {(["lead","funder","grantNumber"] as const).filter(key => entry.data[key]).map(key => <div key={key}><dt>{copy.labels[key]}</dt><dd>{entry.data[key]}</dd></div>)}
          {entry.data.startDate && <div><dt>{copy.labels.startDate}</dt><dd>{entry.data.startDate}</dd></div>}
          {entry.data.endDate && <div><dt>{copy.labels.endDate}</dt><dd>{entry.data.endDate}</dd></div>}
        </dl>}
        {entry.data.url && <a className="lab-entry-link" href={entry.data.url} target="_blank" rel="noreferrer">{copy.open}</a>}
        <div className="lab-entry-actions"><Link href={`/${collection}/${entry.id}/edit`}>{copy.edit}</Link><button disabled={Boolean(busy)} type="button" onClick={() => remove(entry)}>{copy.remove}</button></div>
      </div>
    </article>)}
  </div></>;
}
