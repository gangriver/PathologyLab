"use client";
import { useEffect, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useApiRequest } from "./use-api-request";
import { PDF_LIMITS } from "@/lib/document-types";

export function usePdfImport(onPendingChange?: (pending: boolean) => void) {
  const router = useRouter();
  const { pending: requesting, error, send } = useApiRequest();
  const [navigating, startTransition] = useTransition();
  const pending = requesting || navigating;
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await send<{ id: string }>("/api/papers/import", "POST", form, PDF_LIMITS.uploadTimeoutMs);
    if (result) startTransition(() => { router.push("/papers/" + result.id + "/edit"); router.refresh(); });
  }
  return { pending, error, submit };
}
