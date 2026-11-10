"use client";
import React, { createContext, useCallback, useContext, useState } from "react";
import { Icon } from "./Icon";

export type FlashType = "success" | "error" | "info" | "warning";
export interface FlashItem { id: number; type: FlashType; header?: string; content: React.ReactNode }
interface Ctx { items: FlashItem[]; add: (i: Omit<FlashItem, "id">) => void; dismiss: (id: number) => void; clear: () => void }

const FlashCtx = createContext<Ctx>({ items: [], add: () => {}, dismiss: () => {}, clear: () => {} });
export const useFlash = () => useContext(FlashCtx);

let seq = 1;
export function FlashProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FlashItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((p) => p.filter((i) => i.id !== id)), []);
  const add = useCallback((i: Omit<FlashItem, "id">) => {
    const id = seq++;
    setItems((p) => [...p.slice(-3), { ...i, id }]);
    if (i.type === "success" || i.type === "info") setTimeout(() => dismiss(id), 8000);
  }, [dismiss]);
  const clear = useCallback(() => setItems([]), []);
  return <FlashCtx.Provider value={{ items, add, dismiss, clear }}>{children}</FlashCtx.Provider>;
}

export function Flashbar() {
  const { items, dismiss } = useFlash();
  if (!items.length) return null;
  return (
    <div className="flashbar" role="region" aria-label="Notifications">
      {items.map((i) => (
        <div key={i.id} className={`flash ${i.type}`} role={i.type === "error" ? "alert" : "status"}>
          <Icon name={i.type === "warning" ? "warning" : i.type} className="ico" />
          <div className="body">{i.header && <div className="hd">{i.header}</div>}<div>{i.content}</div></div>
          <button className="x" aria-label="Dismiss" onClick={() => dismiss(i.id)}><Icon name="close" /></button>
        </div>
      ))}
    </div>
  );
}
