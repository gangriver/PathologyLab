"use client";
import Link from "next/link";
import { useEffect,useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/hooks/use-locale";
import { getLabContentCopy } from "@/lib/lab-content-copy";
import { contentSchemas,MAX_IMAGE_BYTES,type Collection,type ContentData,type LabEntry } from "@/lib/lab-content-types";

const fields: Record<Collection,(keyof ContentData)[]> = {
  publications:["title","authors","journal","year","url","summary"],
  projects:["title","summary","lead","funder","grantNumber","startDate","endDate","url"],
  gallery:["title","caption","date"],
};
export function LabContentForm({collection,entry}:{collection:Collection;entry?:LabEntry}) {
  const {locale} = useLocale();
  const copy = getLabContentCopy(locale);
  const router = useRouter();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [file,setFile] = useState<File>();
  const [preview,setPreview] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  },[file]);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(fields[collection].map(key => [key,String(form.get(key) ?? "")]));
    if (!contentSchemas[collection].safeParse(data).success) { setError(copy.invalid); return; }
    if (collection === "gallery" && !entry && (!file || file.size > MAX_IMAGE_BYTES || !file.size)) { setError(copy.imageHelp); return; }
    setBusy(true);
    try {
      let body:BodyInit;
      let headers:HeadersInit | undefined;
      if (collection === "gallery" && !entry) {
        const upload = new FormData();
        upload.set("data",JSON.stringify(data));
        upload.set("image",file!);
        body = upload;
      } else { body = JSON.stringify(entry ? {data,revision:entry.revision} : data); headers={"Content-Type":"application/json"}; }
      const response = await fetch(`/api/lab/${collection}${entry ? `/${entry.id}` : ""}`,{method:entry ? "PATCH" : "POST",body,headers});
      if (!response.ok) throw new Error(response.status === 409 ? copy.conflict : response.status === 413 || (collection === "gallery" && response.status === 422) ? copy.imageHelp : copy.failed);
      router.push(`/${collection}`);
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : copy.failed); setBusy(false); }
  }
  return <form onSubmit={save} className="panel lab-content-form" aria-busy={busy}>
    <fieldset disabled={busy}>
      {fields[collection].map(key => {
        const required = key === "title" || key === "year";
        const multiline = ["summary","caption"].includes(key);
        const type = key === "url" ? "url" : key === "year" ? "number" : key.toLowerCase().includes("date") ? "date" : "text";
        return <label className="field" key={key}><span>{copy.labels[key]}{required && <span className="required-mark"> *</span>}</span>
          {multiline ? <textarea name={key} defaultValue={entry?.data[key] ?? ""} maxLength={key === "caption" ? 5000 : 10000} rows={5} />
          : <input type={type} name={key} required={required} defaultValue={entry?.data[key] ?? (key === "year" ? String(new Date().getFullYear()) : "")} min={key === "year" ? 1000 : undefined} max={key === "year" ? 2200 : undefined} maxLength={key === "authors" || key === "url" ? 2000 : 500} placeholder={key === "url" ? "https://" : undefined} />}
        </label>;
      })}
      {collection === "gallery" && !entry && <label className="field"><span>{copy.photo} <span className="required-mark">*</span></span><input type="file" accept="image/jpeg,image/png,image/webp" required onChange={event => {setFile(event.target.files?.[0]);setError("");}} /><small>{copy.imageHelp}</small></label>}
      {(preview || (entry && collection === "gallery")) && /* eslint-disable-next-line @next/next/no-img-element */
        <img className="lab-image-preview" src={preview || `/api/lab/gallery/${entry!.id}/image`} alt={entry?.data.title ?? copy.photo} />}
      {error && <p className="lab-error" role="alert">{error}</p>}
      <div className="lab-form-actions"><button type="submit" className="button">{busy ? copy.saving : copy.save}</button><Link className="button button-secondary" href={`/${collection}`}>{copy.cancel}</Link></div>
    </fieldset>
  </form>;
}
