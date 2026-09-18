"use client";
import { type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useApiRequest } from "./use-api-request";

export function useCommentForm(paperId: string) {
  const router = useRouter();
  const { pending, error, send } = useApiRequest();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = await send("/api/papers/" + paperId + "/comments", "POST", { content: new FormData(form).get("content") });
    if (result) { form.reset(); router.refresh(); }
  }
  return { pending, error, submit };
}
