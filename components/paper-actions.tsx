"use client";
import { usePaperActions } from "@/hooks/use-paper-actions";
import Link from "next/link";
export function PaperActions({ id, revision }: { id: string; revision: number }) {
  const { text, pending, error, remove } = usePaperActions(id, revision);
  return <div><div className="form-footer"><Link href={"/papers/" + id + "/edit"} className="button button-secondary">{text.edit}</Link><button onClick={remove} className="button button-danger" disabled={pending}>{pending ? text.deleting : text.delete}</button></div>{error && <p role="alert" className="alert alert-error">{error}</p>}</div>;
}
