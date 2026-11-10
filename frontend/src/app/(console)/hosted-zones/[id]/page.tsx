"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useFlash } from "@/components/Flash";
import { Icon } from "@/components/Icon";
import { Alert, Breadcrumbs, Button, Container, Dropdown, Field, Modal, PageHeader, Pagination, PreferencesModal, fmtDate } from "@/components/ui";
import { api, qs } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { ROUTING_POLICIES, type DnsRecord, type ImportResult, type Paged, type Zone } from "@/lib/types";
import { DeleteZoneModal, EditZoneModal } from "@/components/ZoneModals";

const TYPES = ["A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SOA", "SRV", "TXT"];
const short = (n: string, zone: string) => n;

export default function ZoneDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const flash = useFlash();
  const [zone, setZone] = useState<Zone | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<"records" | "dnssec" | "tags">("records");
  const [editZone, setEditZone] = useState(false);
  const [delZone, setDelZone] = useState(false);
  const [tagsModal, setTagsModal] = useState(false);

  const loadZone = useCallback(() => {
    api<Zone>(`/hosted-zones/${id}`).then(setZone).catch((e) => { if (e.status === 404) setNotFound(true); else flash.add({ type: "error", content: e.message }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(loadZone, [loadZone]);

  if (notFound) return (<><Breadcrumbs items={[{ text: "Route 53", href: "/hosted-zones" }, { text: "Hosted zones", href: "/hosted-zones" }]} /><Alert type="error" header="Hosted zone not found">No hosted zone found with ID {id}. It may have been deleted.</Alert><Button onClick={() => router.push("/hosted-zones")}>Back to hosted zones</Button></>);
  if (!zone) return <div style={{ padding: 60, textAlign: "center" }}><span className="spinner big" /></div>;
  const zname = zone.name.replace(/\.$/, "");
  const tagList = Object.entries(zone.tags || {});

  return (
    <>
      <Breadcrumbs items={[{ text: "Route 53", href: "/hosted-zones" }, { text: "Hosted zones", href: "/hosted-zones" }, { text: zname }]} />
      <PageHeader title={zname} actions={<>
        <Dropdown label={<>Export <Icon name="caret-down" size={10} /></>} align="left">
          {(close) => (<>
            <a className="item" href={`/api/hosted-zones/${id}/export?format=json`} onClick={close}><Icon name="download" /> Export as JSON</a>
            <a className="item" href={`/api/hosted-zones/${id}/export?format=bind`} onClick={close}><Icon name="download" /> Export as BIND zone file</a>
          </>)}
        </Dropdown>
        <Button onClick={() => setDelZone(true)}>Delete zone</Button>
      </>} />
      <Container title="Hosted zone details" collapsible defaultOpen
        actions={<Button onClick={() => setEditZone(true)}>Edit hosted zone</Button>}>
        <div className="kv-grid">
          <div className="kv"><div className="k">Hosted zone name</div><div className="v">{zname}</div></div>
          <div className="kv"><div className="k">Hosted zone ID</div><div className="v mono">{zone.id}</div></div>
          <div className="kv"><div className="k">Description</div><div className="v">{zone.comment || "-"}</div></div>
          <div className="kv"><div className="k">Type</div><div className="v">{zone.type === "public" ? "Public hosted zone" : "Private hosted zone"}</div></div>
          <div className="kv"><div className="k">Record count</div><div className="v">{zone.record_count}</div></div>
          <div className="kv"><div className="k">Created by</div><div className="v">{zone.created_by}</div></div>
          {zone.type === "private" && <div className="kv"><div className="k">Associated VPC</div><div className="v">{zone.vpc_id} ({zone.vpc_region})</div></div>}
          <div className="kv"><div className="k">Created</div><div className="v">{fmtDate(zone.created_at)}</div></div>
        </div>
      </Container>

      <div className="tabs" role="tablist">
        <button role="tab" className={tab === "records" ? "active" : ""} onClick={() => setTab("records")}>Records ({zone.record_count})</button>
        <button role="tab" className={tab === "dnssec" ? "active" : ""} onClick={() => setTab("dnssec")}>DNSSEC signing</button>
        <button role="tab" className={tab === "tags" ? "active" : ""} onClick={() => setTab("tags")}>Hosted zone tags ({tagList.length})</button>
      </div>

      {tab === "records" && <RecordsTab zone={zone} onChanged={loadZone} />}
      {tab === "dnssec" && <Container title="DNSSEC signing" desc="DNSSEC signing is mocked in this clone."><div className="coming" style={{ padding: 30 }}><div className="big">Coming soon</div><p>DNSSEC is not available in this clone.</p></div></Container>}
      {tab === "tags" && (
        <Container title="Hosted zone tags" count={tagList.length} flush actions={<Button onClick={() => setTagsModal(true)}>Manage tags</Button>}>
          <div className="table-wrap"><table className="tbl"><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>
            {tagList.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v || "-"}</td></tr>)}
            {!tagList.length && <tr><td colSpan={2}><div className="empty"><h3>No tags</h3><p>No tags associated with this hosted zone.</p></div></td></tr>}
          </tbody></table></div>
        </Container>
      )}
      {editZone && <EditZoneModal zone={zone} onClose={() => setEditZone(false)} onSaved={() => { setEditZone(false); loadZone(); }} />}
      {delZone && <DeleteZoneModal zone={zone} onClose={() => setDelZone(false)} onDeleted={() => router.push("/hosted-zones")} />}
      {tagsModal && <TagsModal zone={zone} onClose={() => setTagsModal(false)} onSaved={() => { setTagsModal(false); loadZone(); }} />}
    </>
  );
}

function TagsModal({ zone, onClose, onSaved }: { zone: Zone; onClose: () => void; onSaved: () => void }) {
  const flash = useFlash();
  const [rows, setRows] = useState(Object.entries(zone.tags || {}).map(([k, v]) => ({ k, v })));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api(`/hosted-zones/${zone.id}`, { method: "PUT", body: { tags: Object.fromEntries(rows.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v])) } });
      flash.add({ type: "success", content: "Tags updated." }); onSaved();
    } catch (e: any) { flash.add({ type: "error", content: e.message }); setBusy(false); }
  };
  return (
    <Modal title="Manage tags" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save changes</Button></>}>
      {rows.map((r, i) => (
        <div className="kv-row" key={i}>
          <input type="text" placeholder="Key" value={r.k} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
          <input type="text" placeholder="Value" value={r.v} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
          <Button onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      <Button onClick={() => setRows([...rows, { k: "", v: "" }])}>Add new tag</Button>
    </Modal>
  );
}

function RecordsTab({ zone, onChanged }: { zone: Zone; onChanged: () => void }) {
  const router = useRouter();
  const flash = useFlash();
  const [data, setData] = useState<Paged<DnsRecord> | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [routing, setRouting] = useState("");
  const [alias, setAlias] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const q = useDebounced(search);

  const load = useCallback(() => {
    setLoading(true);
    api<Paged<DnsRecord>>(`/hosted-zones/${zone.id}/records${qs({ search: q, type, routing_policy: routing, alias, page, page_size: pageSize, sort, order })}`)
      .then((d) => { setData(d); const pages = Math.max(1, Math.ceil(d.total / pageSize)); if (page > pages) setPage(pages); })
      .catch((e) => flash.add({ type: "error", header: "Failed to load records", content: e.message }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.id, q, type, routing, alias, page, pageSize, sort, order]);
  useEffect(load, [load]);
  useEffect(() => { setPage(1); }, [q, type, routing, alias, pageSize]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const allOnPage = items.length > 0 && items.every((r) => sel.has(r.id));
  const toggle = (rid: number) => { const n = new Set(sel); n.has(rid) ? n.delete(rid) : n.add(rid); setSel(n); };
  const toggleAll = () => { const n = new Set(sel); items.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id))); setSel(n); };
  const selRecords = items.filter((r) => sel.has(r.id));
  const sortBy = (k: string) => { if (sort === k) setOrder(order === "asc" ? "desc" : "asc"); else { setSort(k); setOrder("asc"); } };
  const Th = ({ k, children }: { k?: string; children: React.ReactNode }) => (
    <th className={k ? "sortable" : ""} onClick={k ? () => sortBy(k) : undefined}>
      {children}{k && sort === k && <Icon name={order === "asc" ? "chevron-up" : "chevron-down"} size={11} className="sortico" />}
    </th>
  );
  const refresh = () => { load(); onChanged(); };

  return (
    <>
      <Container title="Records" count={total} flush
        desc="Automatic mode is the current search behavior optimized for best filter results. To change modes go to settings."
        actions={<>
          <Button disabled={sel.size === 0} onClick={() => setDelOpen(true)}>Delete record{sel.size > 1 ? "s" : ""}</Button>
          <Button onClick={() => setImportOpen(true)}>Import zone file</Button>
          <Button disabled={sel.size !== 1} onClick={() => router.push(`/hosted-zones/${zone.id}/records/${[...sel][0]}/edit`)}>Edit record</Button>
          <Button variant="primary" onClick={() => router.push(`/hosted-zones/${zone.id}/records/new`)}>Create record</Button>
        </>}>
        <div className="toolbar">
          <div className="searchbox">
            <Icon name="search" size={14} />
            <input type="text" data-shortcut-search placeholder="Filter records by property or value" aria-label="Filter records" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="">Type</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <select aria-label="Routing policy" value={routing} onChange={(e) => setRouting(e.target.value)}><option value="">Routing policy</option>{ROUTING_POLICIES.map((t) => <option key={t}>{t}</option>)}</select>
          <select aria-label="Alias" value={alias} onChange={(e) => setAlias(e.target.value)}><option value="">Alias</option><option value="yes">Yes</option><option value="no">No</option></select>
          {(search || type || routing || alias) && <span className="matches">{total} {total === 1 ? "match" : "matches"}</span>}
          <span className="sp" />
          <Pagination page={page} pages={pages} onChange={setPage} />
          <Button variant="icon-only" aria-label="Preferences" onClick={() => setPrefs(true)}><Icon name="settings" /></Button>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>
              <th className="sel"><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on page" /></th>
              <Th k="name">Record name</Th><Th k="type">Type</Th><Th k="routing_policy">Routing policy</Th><Th>Differentiator</Th><Th>Alias</Th>
              <Th>Value/Route traffic to</Th><Th k="ttl">TTL (seconds)</Th><Th>Health check ID</Th><Th>Evaluate target health</Th>
            </tr></thead>
            <tbody style={{ opacity: loading && data ? 0.6 : 1 }}>
              {loading && !data && <tr><td colSpan={10} className="loading-row"><span className="spinner big" /></td></tr>}
              {items.map((r) => (
                <tr key={r.id} className={sel.has(r.id) ? "sel" : ""} onClick={() => toggle(r.id)} style={{ cursor: "pointer" }}>
                  <td className="sel" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name} ${r.type}`} /></td>
                  <td>{r.name.replace(/\.$/, "")}</td>
                  <td>{r.type}</td>
                  <td>{r.routing_policy}</td>
                  <td>{r.set_identifier ?? "-"}{r.weight !== null && r.weight !== undefined ? ` (weight ${r.weight})` : ""}</td>
                  <td>{r.is_alias ? "Yes" : "No"}</td>
                  <td className="mono values-cell">{r.is_alias ? <div>{r.alias_target}</div> : r.values.map((v, i) => <div key={i}>{v}</div>)}</td>
                  <td>{r.is_alias ? "-" : r.ttl}</td>
                  <td>{r.health_check_id ?? "-"}</td>
                  <td>{r.is_alias ? (r.evaluate_target_health ? "Yes" : "No") : "-"}</td>
                </tr>
              ))}
              {data && items.length === 0 && (
                <tr><td colSpan={10}><div className="empty">
                  {search || type || routing || alias ? (<><h3>No matches</h3><p>We can’t find a match for your filter.</p><Button onClick={() => { setSearch(""); setType(""); setRouting(""); setAlias(""); }}>Clear filter</Button></>)
                    : (<><h3>No records</h3><p>This hosted zone has no records.</p></>)}
                </div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Container>
      {prefs && <PreferencesModal pageSize={pageSize} onSave={setPageSize} onClose={() => setPrefs(false)} />}
      {delOpen && <DeleteRecordsModal zone={zone} ids={[...sel]} known={selRecords} onClose={() => setDelOpen(false)} onDone={() => { setDelOpen(false); setSel(new Set()); refresh(); }} />}
      {importOpen && <ImportModal zone={zone} onClose={() => setImportOpen(false)} onDone={() => { refresh(); }} />}
    </>
  );
}

function DeleteRecordsModal({ zone, ids, known, onClose, onDone }: { zone: Zone; ids: number[]; known: DnsRecord[]; onClose: () => void; onDone: () => void }) {
  const flash = useFlash();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try {
      await api(`/hosted-zones/${zone.id}/records/bulk-delete`, { method: "POST", body: { ids } });
      flash.add({ type: "success", content: `Successfully deleted ${ids.length} record${ids.length > 1 ? "s" : ""}.` });
      onDone();
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Delete record${ids.length > 1 ? "s" : ""}`} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={go}>Delete</Button></>}>
      {error && <Alert type="error" header="Could not delete records">{error}</Alert>}
      <p>Are you sure you want to delete {ids.length > 1 ? `these ${ids.length} records` : "this record"}? This action can’t be undone.</p>
      <ul className="plain">{known.map((r) => <li key={r.id}><strong>{r.name.replace(/\.$/, "")}</strong> <span style={{ color: "var(--text-secondary)" }}>({r.type})</span></li>)}</ul>
    </Modal>
  );
}

function ImportModal({ zone, onClose, onDone }: { zone: Zone; onClose: () => void; onDone: () => void }) {
  const [content, setContent] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try { const r = await api<ImportResult>(`/hosted-zones/${zone.id}/records/import`, { method: "POST", body: { content, overwrite } }); setResult(r); onDone(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Import zone file" wide onClose={onClose}
      footer={<><Button onClick={onClose}>{result ? "Close" : "Cancel"}</Button><Button variant="primary" loading={busy} disabled={!content.trim()} onClick={go}>Import</Button></>}>
      {error && <Alert type="error">{error}</Alert>}
      {result && (
        <Alert type={result.errors.length ? "warning" : "success"} header="Import complete">
          {result.created} created, {result.updated} updated, {result.skipped.length} skipped, {result.errors.length} failed.
          {[...result.skipped.map((s) => `Skipped: ${s}`), ...result.errors.map((s) => `Error: ${s}`)].length > 0 && (
            <ul className="plain">{[...result.skipped.map((s) => `Skipped: ${s}`), ...result.errors.map((s) => `Error: ${s}`)].slice(0, 12).map((m, i) => <li key={i} className="mono" style={{ fontSize: 12 }}>{m}</li>)}</ul>)}
        </Alert>
      )}
      <Field label="Zone file" desc="Paste the contents of a BIND-format zone file, or upload one. SOA and apex NS records are ignored.">
        <input type="file" accept=".zone,.txt,.db,text/plain" style={{ marginBottom: 8 }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) setContent(await f.text()); }} />
        <textarea rows={10} value={content} onChange={(e) => setContent(e.target.value)} placeholder={`$ORIGIN ${zone.name}\n$TTL 300\nwww IN A 192.0.2.1\n@   IN MX 10 mail.${zone.name}`} />
      </Field>
      <label className="radio-row"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />Overwrite existing records with the same name and type</label>
    </Modal>
  );
}
