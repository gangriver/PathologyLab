"use client";
import { useEffect } from "react";
import { create } from "zustand";
import type { Paper, PaperStatus } from "@/lib/types";

type Filters = { query: string; status: PaperStatus | "all"; presenter: string | null; setQuery: (query: string) => void; setStatus: (status: PaperStatus | "all") => void; setPresenter: (presenter: string | null) => void };
const useFilters = create<Filters>((set) => ({ query: "", status: "all", presenter: null, setQuery: (query) => set({ query }), setStatus: (status) => set({ status }), setPresenter: (presenter) => set({ presenter }) }));
export function usePaperFilters(papers: Paper[]) {
  const filters = useFilters();
  const query = filters.query.trim().toLocaleLowerCase();
  const presenters = [...new Set(papers.map(paper => paper.presenter.trim()).filter(Boolean))];
  const presenter = filters.presenter !== null && presenters.includes(filters.presenter) ? filters.presenter : null;
  useEffect(() => {
    if (filters.presenter !== presenter) filters.setPresenter(presenter);
  }, [filters.presenter, filters.setPresenter, presenter]);
  const filtered = papers.filter(paper => (filters.status === "all" || paper.status === filters.status) && (presenter === null || paper.presenter.trim() === presenter) && [paper.title, paper.authors, paper.presenter].some(value => value.toLocaleLowerCase().includes(query)));
  return { ...filters, presenter, presenters, filtered };
}
