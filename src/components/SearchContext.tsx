"use client";

import { createContext, useContext, useState } from "react";

type SearchCtx = { query: string; setQuery: (q: string) => void };
const Ctx = createContext<SearchCtx>({ query: "", setQuery: () => {} });

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  return <Ctx.Provider value={{ query, setQuery }}>{children}</Ctx.Provider>;
}

export function useSearch() {
  return useContext(Ctx);
}
