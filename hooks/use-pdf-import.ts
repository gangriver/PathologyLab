"use client";
import { useEffect, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useApiRequest } from "./use-api-request";
import { uploadPdf } from "@/lib/upload-pdf";

export function usePdfImport(cloudStorage: boolean, onPendingChange?: (pending: boolean) => void) {
  const router = useRouter();
  const { pending: requesting, error, sendRequest } = useApiRequest();
  const [navigating, startTransition] = useTransition();
  const pending = requesting || navigating;
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await sendRequest<{ id: string }>(() => uploadPdf("/api/papers/import", form, cloudStorage));
    if (result) startTransition(() => { router.push("/papers/" + result.id + "/edit"); router.refresh(); });
  }
  return { pending, error, submit };
}
