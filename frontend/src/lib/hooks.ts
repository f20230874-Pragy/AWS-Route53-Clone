"use client";
import { useEffect, useState } from "react";

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState("light");
  useEffect(() => { setTheme(document.documentElement.dataset.theme || "light"); }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("r53-theme", next); } catch { /* ignore */ }
    setTheme(next);
  };
  return [theme, toggle];
}
