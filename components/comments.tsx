"use client";
import { useCommentForm } from "@/hooks/use-comment-form";
import { useLocale } from "@/hooks/use-locale";
import { formatArchiveDate, getArchiveMessages } from "@/lib/i18n-archive";
import type { Comment } from "@/lib/types";

export function Comments({ paperId, comments }: { paperId: string; comments: Comment[] }) {
  const { locale } = useLocale();
  const messages = getArchiveMessages(locale);
  const { pending, error, submit } = useCommentForm(paperId);
  return <section className="panel" style={{ marginTop: 25 }}><h2 style={{ fontSize: 20, fontWeight: 700 }}>{messages.discussion} <span className="muted">{comments.length}</span></h2>
    {comments.length ? comments.map(comment => <article key={comment.id} className="comment"><div className="comment-top"><strong>{comment.authorName === "방문자" ? messages.guest : comment.authorName}</strong><time dateTime={comment.createdAt}>{formatArchiveDate(comment.createdAt, locale)}</time></div><p>{comment.content}</p></article>) : <p className="form-note">{messages.noComments}</p>}
    <form onSubmit={submit} style={{ marginTop: 22 }}><label className="field">{messages.commentLabel}<textarea name="content" required maxLength={5000} rows={4} placeholder={messages.commentPlaceholder} /></label>{error && <p className="alert alert-error" role="alert">{error}</p>}<div className="form-footer"><button className="button" disabled={pending}>{pending ? messages.saving : messages.addComment}</button></div></form>
  </section>;
}
