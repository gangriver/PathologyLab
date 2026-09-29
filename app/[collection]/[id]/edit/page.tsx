import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { LabContentForm } from "@/components/lab-content-form";
import { findEntry } from "@/lib/lab-content";
import { getLocale } from "@/lib/locale-server";
import { getLabContentCopy } from "@/lib/lab-content-copy";
import { isCollection } from "@/lib/lab-content-types";
export const dynamic = "force-dynamic";
export default async function EditEntryPage({params}:{params:Promise<{collection:string;id:string}>}) {
  const {collection,id} = await params;
  if (!isCollection(collection) || !/^[a-f0-9-]{36}$/.test(id)) notFound();
  const entry = await findEntry(collection,id);
  if (!entry) notFound();
  const copy = getLabContentCopy(await getLocale());
  return <><SiteHeader /><main id="main" className="shell page-shell lab-form-shell"><Link className="back-link" href={`/${collection}`}>← {copy[collection].title}</Link><div className="page-heading"><h1>{copy[collection].title} · {copy.edit}</h1></div><LabContentForm collection={collection} entry={entry} /></main></>;
}
