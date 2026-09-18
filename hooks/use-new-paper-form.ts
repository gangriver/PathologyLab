"use client";
import { useState } from "react";

export function useNewPaperForm() {
  const [mode, setMode] = useState<"pdf" | "manual">("pdf");
  const [pending, setPending] = useState(false);
  return { mode, setMode, pending, setPending };
}
