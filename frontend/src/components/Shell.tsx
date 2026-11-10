"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import type { User } from "@/lib/types";
import { Flashbar, FlashProvider } from "./Flash";
import { Icon } from "./Icon";
import { Button, Modal } from "./ui";

export const NAV: { title?: string; items: { text: string; href: string }[] }[] = [
  { items: [{ text: "Dashboard", href: "/dashboard" }, { text: "Hosted zones", href: "/hosted-zones" }, { text: "Health checks", href: "/health-checks" }, { text: "Profiles", href: "/profiles" }] },
  { title: "IP-based routing", items: [{ text: "CIDR collections", href: "/cidr-collections" }] },
  { title: "Traffic flow", items: [{ text: "Traffic policies", href: "/traffic-policies" }, { text: "Policy records", href: "/policy-records" }] },
  { title: "Domains", items: [{ text: "Registered domains", href: "/registered-domains" }, { text: "Requests", href: "/domain-requests" }] },
  { title: "Resolver", items: [{ text: "VPCs", href: "/resolver/vpcs" }, { text: "Inbound endpoints", href: "/resolver/inbound-endpoints" }, { text: "Outbound endpoints", href: "/resolver/outbound-endpoints" }, { text: "Rules", href: "/resolver/rules" }, { text: "Query logging", href: "/resolver/query-logging" }] },
];

function TopNav({ user, onSignOut, onToggleNav }: { user: User; onSignOut: () => void; onToggleNav: () => void }) {
  const [theme, toggleTheme] = useTheme();
  const [menu, setMenu] = useState<string | null>(null);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const acct = user.account_id.replace(/(\d{4})(\d{4})(\d{4})/, "$1-$2-$3");
  return (
    <header className="topnav" ref={ref}>
      <button onClick={onToggleNav} aria-label="Toggle navigation"><Icon name="menu" size={18} /></button>
      <Link href="/hosted-zones" className="logo" aria-label="Home">
        aws
        <svg width="26" height="8" viewBox="0 0 26 8"><path d="M1 2c8 6 16 6 23 0" stroke="#ff9900" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>
      </Link>
      <div className="dropdown">
        <button className="navbtn" onClick={() => setMenu(menu === "svc" ? null : "svc")}><Icon name="grid" /> Services</button>
        {menu === "svc" && (
          <div className="dropdown-menu left" style={{ minWidth: 260 }}>
            <div className="head">Recently visited</div>
            <Link href="/hosted-zones" className="item" onClick={() => setMenu(null)}><Icon name="globe" /> Route 53</Link>
            <div className="item disabled"><Icon name="cube" /> Other services are not part of this clone</div>
          </div>
        )}
      </div>
      <form className="search" onSubmit={(e) => { e.preventDefault(); const q = new FormData(e.currentTarget).get("q") as string; router.push(`/hosted-zones${q ? `?q=${encodeURIComponent(q)}` : ""}`); }}>
        <Icon name="search" size={14} />
        <input name="q" placeholder="Search for hosted zones" aria-label="Search" autoComplete="off" />
      </form>
      <div className="spacer" />
      <button onClick={toggleTheme} aria-label="Toggle dark mode" title="Toggle dark mode (t)"><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
      <button aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={() => window.dispatchEvent(new Event("r53:shortcuts"))}><Icon name="keyboard" /></button>
      <button aria-label="Notifications"><Icon name="bell" /></button>
      <div className="dropdown">
        <button className="navbtn" onClick={() => setMenu(menu === "region" ? null : "region")}>Global <Icon name="caret-down" size={10} /></button>
        {menu === "region" && <div className="dropdown-menu"><div className="head">Region</div><div className="item">Global</div></div>}
      </div>
      <div className="dropdown">
        <button className="navbtn" onClick={() => setMenu(menu === "acct" ? null : "acct")} data-testid="account-menu">
          {user.username} @ {acct} <Icon name="caret-down" size={10} />
        </button>
        {menu === "acct" && (
          <div className="dropdown-menu" style={{ minWidth: 240 }}>
            <div className="head">Account ID: {acct}</div>
            <div className="head" style={{ borderBottom: 0 }}>IAM user: {user.username}</div>
            <button className="item" onClick={onSignOut}>Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}

function SideNav({ collapsed, onClose }: { collapsed: boolean; onClose: () => void }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <nav className={`sidenav ${collapsed ? "collapsed" : ""}`} aria-label="Navigation">
      <div className="title">
        <Link href="/hosted-zones">Route 53</Link>
        <button aria-label="Close navigation" onClick={onClose}><Icon name="close" size={14} /></button>
      </div>
      {NAV.map((g, gi) => (
        <div key={gi}>
          {g.title && <><hr /><div className="section">{g.title}</div></>}
          <div className={g.title ? "sub" : ""}>
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className={`navlink ${active(it.href) ? "active" : ""}`} aria-current={active(it.href) ? "page" : undefined}>{it.text}</Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [["/", "Focus the filter box"], ["g then h", "Go to Hosted zones"], ["c", "Create a hosted zone / record"], ["t", "Toggle dark mode"], ["?", "Show this help"], ["Esc", "Close dialog"]];
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Close</Button>}>
      {rows.map(([k, d]) => <div key={k} className="shortcut-row"><span>{d}</span><span>{k.split(" then ").map((x, i) => <React.Fragment key={x}>{i > 0 && " then "}<kbd>{x}</kbd></React.Fragment>)}</span></div>)}
    </Modal>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [help, setHelp] = useState(false);
  const [, toggleTheme] = useTheme();
  const gPressed = useRef(0);

  useEffect(() => {
    api<User>("/auth/me").then(setUser).catch(() => router.replace("/login"));
    const un = () => router.replace("/login");
    const sh = () => setHelp(true);
    window.addEventListener("r53:unauthorized", un);
    window.addEventListener("r53:shortcuts", sh);
    return () => { window.removeEventListener("r53:unauthorized", un); window.removeEventListener("r53:shortcuts", sh); };
  }, [router]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector(".overlay")) return;
      if (e.key === "/") { const s = document.querySelector<HTMLInputElement>("[data-shortcut-search]"); if (s) { e.preventDefault(); s.focus(); } }
      else if (e.key === "?") setHelp(true);
      else if (e.key === "t") toggleTheme();
      else if (e.key === "g") gPressed.current = Date.now();
      else if (e.key === "h" && Date.now() - gPressed.current < 1200) router.push("/hosted-zones");
      else if (e.key === "c") {
        if (path === "/hosted-zones") router.push("/hosted-zones/create");
        else if (/^\/hosted-zones\/[^/]+$/.test(path) && path !== "/hosted-zones/create") router.push(`${path}/records/new`);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [path, router, toggleTheme]);

  const signOut = async () => { try { await api("/auth/logout", { method: "POST" }); } catch { /* ignore */ } router.replace("/login"); };

  if (!user) return <div style={{ padding: 80, textAlign: "center" }}><span className="spinner big" /></div>;
  return (
    <FlashProvider>
      <TopNav user={user} onSignOut={signOut} onToggleNav={() => setCollapsed((c) => !c)} />
      <div className="shell">
        <SideNav collapsed={collapsed} onClose={() => setCollapsed(true)} />
        <main className={`main ${collapsed ? "nonav" : ""}`}>
          <div className="content"><Flashbar />{children}</div>
        </main>
      </div>
      <footer className="footer">
        <span>Route 53 console clone — educational project, not affiliated with AWS</span>
        <span className="sp" />
        <a>Privacy</a><a>Terms</a><a>Cookie preferences</a>
      </footer>
      {help && <ShortcutsModal onClose={() => setHelp(false)} />}
    </FlashProvider>
  );
}
