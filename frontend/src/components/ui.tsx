"use client";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

export function Breadcrumbs({ items }: { items: { text: string; href?: string }[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumbs">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Icon name="chevron-right" size={12} className="sep" />}
          {it.href ? <Link href={it.href}>{it.text}</Link> : <span className="current">{it.text}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function Button({ variant, small, loading, children, className = "", ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "link" | "danger" | "icon-only"; small?: boolean; loading?: boolean }) {
  return (
    <button {...rest} disabled={rest.disabled || loading}
      className={`btn ${variant === "icon-only" ? "icon-only" : variant ?? ""} ${small ? "small" : ""} ${className}`}>
      {loading && <span className="spinner" />}{children}
    </button>
  );
}

export function PageHeader({ title, info = true, description, actions }: { title: React.ReactNode; info?: boolean; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}{info && <a className="info-link" role="button" tabIndex={0}>Info</a>}</h1>
        {description && <p className="desc">{description}</p>}
      </div>
      {actions && <div className="btn-group">{actions}</div>}
    </div>
  );
}

export function Container({ title, count, desc, actions, children, flush, collapsible, defaultOpen = true }:
  { title?: React.ReactNode; count?: number; desc?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; flush?: boolean; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="container">
      {title && (
        <div className={`c-header ${collapsible ? "collapsible" : ""} ${open ? "" : "nobb"}`} onClick={collapsible ? () => setOpen(!open) : undefined}>
          <div>
            <h2>
              {collapsible && <Icon name={open ? "caret-down" : "caret-right"} size={14} />}
              {title}{count !== undefined && <span className="count">({count})</span>}
              <a className="info-link" role="button" tabIndex={0} onClick={(e) => e.stopPropagation()}>Info</a>
            </h2>
            {desc && <div className="desc">{desc}</div>}
          </div>
          {actions && <div className="btn-group" onClick={(e) => e.stopPropagation()}>{actions}</div>}
        </div>
      )}
      {open && (flush ? children : <div className="c-body">{children}</div>)}
    </section>
  );
}

export function Field({ label, optional, desc, hint, error, children }:
  { label?: string; optional?: boolean; desc?: React.ReactNode; hint?: React.ReactNode; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="field">
      {label && <div className="lbl">{label}{optional && <span className="opt"> - optional</span>}</div>}
      {desc && <div className="desc">{desc}</div>}
      {children}
      {error ? <div className="err"><Icon name="error" size={14} style={{ marginTop: 3 }} />{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="track" />{children}
    </label>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="m-head"><h2>{title}</h2><button className="x" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
        <div className="m-body">{children}</div>
        {footer && <div className="m-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Alert({ type, header, children }: { type: "success" | "error" | "info" | "warning"; header?: string; children?: React.ReactNode }) {
  return (
    <div className={`alert ${type}`} role={type === "error" ? "alert" : undefined}>
      <Icon name={type} className="ico" />
      <div className="body">{header && <div className="hd">{header}</div>}{children && <div>{children}</div>}</div>
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages < 1) pages = 1;
  const nums: (number | "…")[] = [];
  if (pages <= 7) for (let i = 1; i <= pages; i++) nums.push(i);
  else {
    nums.push(1);
    if (page > 4) nums.push("…");
    for (let i = Math.max(2, page - 2); i <= Math.min(pages - 1, page + 2); i++) nums.push(i);
    if (page < pages - 3) nums.push("…");
    nums.push(pages);
  }
  return (
    <div className="pagination" role="navigation" aria-label="Pagination">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><Icon name="chevron-left" size={14} /></button>
      {nums.map((n, i) => n === "…" ? <span key={`d${i}`} className="dots">…</span> :
        <button key={n} className={n === page ? "active" : ""} aria-current={n === page ? "page" : undefined} onClick={() => onChange(n)}>{n}</button>)}
      <button disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><Icon name="chevron-right" size={14} /></button>
    </div>
  );
}

export function PreferencesModal({ pageSize, onSave, onClose }: { pageSize: number; onSave: (n: number) => void; onClose: () => void }) {
  const [v, setV] = useState(pageSize);
  return (
    <Modal title="Preferences" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { onSave(v); onClose(); }}>Confirm</Button></>}>
      <div className="lbl" style={{ fontWeight: 700, marginBottom: 6 }}>Page size</div>
      {[10, 20, 50, 100].map((n) => (
        <label key={n} className="radio-row"><input type="radio" name="ps" checked={v === n} onChange={() => setV(n)} />{n} resources</label>
      ))}
    </Modal>
  );
}

export function Dropdown({ label, children, align }: { label: React.ReactNode; children: (close: () => void) => React.ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="btn" style={{ background: "transparent" }} onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open}>{label}</button>
      {open && <div className={`dropdown-menu ${align === "left" ? "left" : ""}`} style={{ top: 36 }}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
