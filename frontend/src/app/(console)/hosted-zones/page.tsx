"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useFlash } from "@/components/Flash";
import { Icon } from "@/components/Icon";
import { Alert, Breadcrumbs, Button, Container, Field, Modal, PageHeader, Pagination, PreferencesModal } from "@/components/ui";
import { DeleteZoneModal, EditZoneModal } from "@/components/ZoneModals";
import { api, qs } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import type { Paged, Zone } from "@/lib/types";

function ZonesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const flash = useFlash();
  const [data, setData] = useState<Paged<Zone> | null>(null);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState(false);
  const [del, setDel] = useState<Zone | null>(null);
  const [edit, setEdit] = useState<Zone | null>(null);
  const q = useDebounced(search);

  const load = useCallback(() => {
    setLoading(true);
    api<Paged<Zone>>(`/hosted-zones${qs({ search: q, type, page, page_size: pageSize, sort, order })}`)
      .then((d) => { setData(d); const pages = Math.max(1, Math.ceil(d.total / pageSize)); if (page > pages) setPage(pages); })
      .catch((e) => flash.add({ type: "error", header: "Failed to load hosted zones", content: e.message }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, page, pageSize, sort, order]);
  useEffect(load, [load]);
  useEffect(() => { setPage(1); }, [q, type, pageSize]);

  const selZone = data?.items.find((z) => z.id === selected) ?? null;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const sortBy = (k: string) => { if (sort === k) setOrder(order === "asc" ? "desc" : "asc"); else { setSort(k); setOrder("asc"); } };
  const Th = ({ k, children }: { k?: string; children: React.ReactNode }) => (
    <th className={k ? "sortable" : ""} onClick={k ? () => sortBy(k) : undefined} aria-sort={k && sort === k ? (order === "asc" ? "ascending" : "descending") : undefined}>
      {children}{k && sort === k && <Icon name={order === "asc" ? "chevron-up" : "chevron-down"} size={11} className="sortico" />}
    </th>
  );

  return (
    <>
      <Breadcrumbs items={[{ text: "Route 53", href: "/hosted-zones" }, { text: "Hosted zones" }]} />
      <Container
        title="Hosted zones" count={total} flush
        desc="Automatic mode is the current search behavior; filter by name, type, description or hosted zone ID."
        actions={<>
          <Button disabled={!selZone} onClick={() => selZone && router.push(`/hosted-zones/${selZone.id}`)}>View details</Button>
          <Button disabled={!selZone} onClick={() => setEdit(selZone)}>Edit</Button>
          <Button disabled={!selZone} onClick={() => setDel(selZone)}>Delete</Button>
          <Button variant="primary" onClick={() => router.push("/hosted-zones/create")}>Create hosted zone</Button>
        </>}
      >
        <div className="toolbar">
          <div className="searchbox">
            <Icon name="search" size={14} />
            <input type="text" data-shortcut-search placeholder="Filter hosted zones by property or value" aria-label="Filter hosted zones"
                   value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option><option value="public">Public</option><option value="private">Private</option>
          </select>
          {(search || type) && <span className="matches">{total} {total === 1 ? "match" : "matches"}</span>}
          <span className="sp" />
          <Pagination page={page} pages={pages} onChange={setPage} />
          <Button variant="icon-only" aria-label="Preferences" onClick={() => setPrefs(true)}><Icon name="settings" /></Button>
          <Button variant="icon-only" aria-label="Refresh" onClick={load}><Icon name="refresh" /></Button>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>
              <th className="sel" />
              <Th k="name">Hosted zone name</Th><Th k="type">Type</Th><Th>Created by</Th><Th>Record count</Th><Th k="comment">Description</Th><Th k="id">Hosted zone ID</Th>
            </tr></thead>
            <tbody>
              {loading && !data && <tr><td colSpan={7} className="loading-row"><span className="spinner big" /></td></tr>}
              {data?.items.map((z) => (
                <tr key={z.id} className={selected === z.id ? "sel" : ""} onClick={() => setSelected(z.id)} style={{ cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                  <td className="sel"><input type="radio" name="zone" checked={selected === z.id} onChange={() => setSelected(z.id)} aria-label={`Select ${z.name}`} /></td>
                  <td><Link href={`/hosted-zones/${z.id}`} onClick={(e) => e.stopPropagation()}>{z.name.replace(/\.$/, "")}</Link></td>
                  <td>{z.type === "public" ? "Public" : "Private"}</td>
                  <td>{z.created_by}</td>
                  <td>{z.record_count}</td>
                  <td>{z.comment || "-"}</td>
                  <td className="mono">{z.id}</td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty">
                    {search || type ? (<><h3>No matches</h3><p>We can’t find a match for your filter.</p><Button onClick={() => { setSearch(""); setType(""); }}>Clear filter</Button></>)
                      : (<><h3>No hosted zones</h3><p>You don’t have any hosted zones.</p><Button variant="primary" onClick={() => router.push("/hosted-zones/create")}>Create hosted zone</Button></>)}
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Container>
      {prefs && <PreferencesModal pageSize={pageSize} onSave={setPageSize} onClose={() => setPrefs(false)} />}
      {del && <DeleteZoneModal zone={del} onClose={() => setDel(null)} onDeleted={() => { setDel(null); setSelected(null); load(); }} />}
      {edit && <EditZoneModal zone={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

export default function Page() {
  return <Suspense><ZonesPage /></Suspense>;
}
