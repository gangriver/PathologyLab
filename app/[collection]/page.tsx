import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { LabContentList } from "@/components/lab-content-list";
import { listEntries } from "@/lib/lab-content";
import { getLocale } from "@/lib/locale-server";
import { getLabContentCopy } from "@/lib/lab-content-copy";
import { isCollection } from "@/lib/lab-content-types";
export const dynamic = "force-dynamic";
type Props = {params:Promise<{collection:string}>};
export async function generateMetadata({params}:Props) {
  const {collection} = await params;
  return {title:isCollection(collection) ? getLabContentCopy(await getLocale())[collection].title : ""};
}
export default async function CollectionPage({params}:Props) {
  const {collection} = await params;
  if (!isCollection(collection)) notFound();
  const copy = getLabContentCopy(await getLocale());
  const entries = await listEntries(collection);
  return <><SiteHeader /><main id="main" className="shell page-shell"><div className="page-heading"><div><div className="section-eyebrow">Spatial-Omics Lab</div><h1>{copy[collection].title}</h1><p>{copy[collection].description}</p></div><Link className="button" href={`/${collection}/new`}>{copy[collection].add} +</Link></div><LabContentList collection={collection} entries={entries} /></main></>;
}
