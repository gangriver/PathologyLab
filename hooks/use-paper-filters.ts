"use client";
import { create } from "zustand";
import type { Paper, PaperStatus } from "@/lib/types";

type Filters = { query: string; status: PaperStatus | "all"; setQuery: (query: string) => void; setStatus: (status: PaperStatus | "all") => void };
const useFilters = create<Filters>((set) => ({ query: "", status: "all", setQuery: (query) => set({ query }), setStatus: (status) => set({ status }) }));
export function usePaperFilters(papers: Paper[]) {
  const filters = useFilters();
  const query = filters.query.trim().toLocaleLowerCase();
  const filtered = papers.filter(paper => (filters.status === "all" || paper.status === filters.status) && [paper.title, paper.authors, paper.presenter].some(value => value.toLocaleLowerCase().includes(query)));
  return { ...filters, filtered };
}
