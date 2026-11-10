"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LOCATIONS, RECORD_TYPES, REGIONS, ROUTING_POLICIES, type DnsRecord, type Zone } from "@/lib/types";
import { useFlash } from "./Flash";
import { Alert, Breadcrumbs, Button, Field, PageHeader, Toggle } from "./ui";

export interface Draft {
  key: number; name: string; type: string; is_alias: boolean; alias_target: string; evaluate: boolean; values: string; ttl: string;
  routing: string; set_identifier: string; weight: string; region: string; failover: string; location: string; health_check_id: string; error?: string | null;
}
let k = 1;
const blank = (): Draft => ({ key: k++, name: "", type: "A", is_alias: false, alias_target: "", evaluate: false, values: "", ttl: "300", routing: "Simple",
  set_identifier: "", weight: "10", region: "us-east-1", failover: "PRIMARY", location: "Default", health_check_id: "" });

const fromRecord = (r: DnsRecord, zoneName: string): Draft => ({
  ...blank(), name: r.name === zoneName ? "" : r.name.slice(0, -(zoneName.length + 1)), type: r.type, is_alias: r.is_alias, alias_target: r.alias_target ?? "",
  evaluate: r.evaluate_target_health, values: r.values.join("\n"), ttl: String(r.ttl ?? 300), routing: r.routing_policy, set_identifier: r.set_identifier ?? "",
  weight: String(r.weight ?? 10), region: r.region ?? "us-east-1", failover: r.failover_role ?? "PRIMARY", location: r.location ?? "Default", health_check_id: r.health_check_id ?? "",
});

const toBody = (d: Draft) => ({
  name: d.name.trim(), type: d.type, ttl: d.is_alias ? null : Number(d.ttl), values: d.is_alias ? [] : d.values.split("\n").map((s) => s.trim()).filter(Boolean),
  is_alias: d.is_alias, alias_target: d.is_alias ? d.alias_target.trim() : null, evaluate_target_health: d.is_alias && d.evaluate,
  routing_policy: d.routing, set_identifier: d.routing !== "Simple" ? d.set_identifier.trim() : null,
  weight: d.routing === "Weighted" ? Number(d.weight) : null, region: d.routing === "Latency" ? d.region : null,
  failover_role: d.routing === "Failover" ? d.failover : null, location: d.routing === "Geolocation" ? d.location : null,
  health_check_id: d.health_check_id.trim() || null,
});

function localCheck(d: Draft): string | null {
  if (!d.is_alias && !d.values.trim()) return "Enter at least one value.";
  if (d.is_alias && !d.alias_target.trim()) return "Enter the alias target.";
  if (!d.is_alias && (d.ttl === "" || isNaN(Number(d.ttl)) || Number(d.ttl) < 0 || Number(d.ttl) > 2147483647)) return "TTL must be a number between 0 and 2147483647.";
  if (d.routing !== "Simple" && !d.set_identifier.trim()) return "Record ID is required for this routing policy.";
  return null;
}

function RecordPanel({ d, idx, zone, count, editing, onChange, onRemove }:
  { d: Draft; idx: number; zone: Zone; count: number; editing: boolean; onChange: (p: Partial<Draft>) => void; onRemove: () => void }) {
  const zname = zone.name.replace(/\.$/, "");
  const typeInfo = RECORD_TYPES.find((t) => t.value === d.type);
  const lockName = editing && d.type === "NS" && d.name === "";
  return (
    <div className="rec-panel">
      <div className="rp-head"><span>{editing ? "Record" : `Record ${idx + 1}`}</span>{!editing && count > 1 && <Button type="button" small onClick={onRemove}>Remove</Button>}</div>
      <div className="rp-body">
        {d.error && <Alert type="error" header="Could not create this record">{d.error}</Alert>}
        <div className="grid2">
          <Field label="Record name" desc="Keep blank to create a record for the root domain." hint={`Valid characters: a-z, 0-9, hyphen (-), underscore (_), and asterisk (*) for wildcards.`}>
            <div className="inline-input">
              <input type="text" aria-label="Record name" value={d.name} disabled={lockName} onChange={(e) => onChange({ name: e.target.value })} placeholder="subdomain" />
              <span className="suffix">.{zname}</span>
            </div>
          </Field>
          <Field label="Record type" desc={typeInfo?.desc}>
            <select aria-label="Record type" value={d.type} disabled={lockName} onChange={(e) => onChange({ type: e.target.value, is_alias: ["A", "AAAA", "CNAME"].includes(e.target.value) ? d.is_alias : false })}>
              {RECORD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
            </select>
          </Field>
        </div>
        {["A", "AAAA", "CNAME"].includes(d.type) && (
          <Field><Toggle checked={d.is_alias} onChange={(v) => onChange({ is_alias: v })}><strong>Alias</strong></Toggle></Field>
        )}
        {d.is_alias ? (
          <div className="grid2">
            <Field label="Route traffic to" desc="Enter the DNS name of the AWS resource (for example, a CloudFront distribution or load balancer) or another record in this zone.">
              <input type="text" aria-label="Alias target" value={d.alias_target} onChange={(e) => onChange({ alias_target: e.target.value })} placeholder="d111111abcdef8.cloudfront.net" />
            </Field>
            <Field label="Evaluate target health"><Toggle checked={d.evaluate} onChange={(v) => onChange({ evaluate: v })}>{d.evaluate ? "Yes" : "No"}</Toggle></Field>
          </div>
        ) : (
          <div className="grid2">
            <Field label="Value" desc="Enter multiple values on separate lines." hint={`Example: ${typeInfo?.hint ?? ""}`}>
              <textarea aria-label="Value" rows={4} value={d.values} onChange={(e) => onChange({ values: e.target.value })} placeholder={typeInfo?.hint} />
            </Field>
            <Field label="TTL (seconds)" desc="Recommended values: 60 to 172800 (two days).">
              <input type="number" aria-label="TTL" min={0} value={d.ttl} onChange={(e) => onChange({ ttl: e.target.value })} />
              <div className="ttl-quick">{[["1m", 60], ["5m", 300], ["1h", 3600], ["1d", 86400]].map(([l, v]) => <button type="button" key={l} onClick={() => onChange({ ttl: String(v) })}>{l}</button>)}</div>
            </Field>
          </div>
        )}
        <Field label="Routing policy" desc="Route 53 responds to queries based only on the values in this record." >
          <select aria-label="Routing policy" value={d.routing} onChange={(e) => onChange({ routing: e.target.value })} style={{ maxWidth: 360 }}>
            {ROUTING_POLICIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        {d.routing !== "Simple" && (
          <div className="grid2">
            <Field label="Record ID" desc="Enter a unique value that identifies this record in the group."><input type="text" aria-label="Record ID" value={d.set_identifier} onChange={(e) => onChange({ set_identifier: e.target.value })} /></Field>
            {d.routing === "Weighted" && <Field label="Weight" desc="A value between 0 and 255."><input type="number" aria-label="Weight" min={0} max={255} value={d.weight} onChange={(e) => onChange({ weight: e.target.value })} /></Field>}
            {d.routing === "Latency" && <Field label="Region"><select aria-label="Region" value={d.region} onChange={(e) => onChange({ region: e.target.value })}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>}
            {d.routing === "Failover" && <Field label="Failover record type"><select aria-label="Failover record type" value={d.failover} onChange={(e) => onChange({ failover: e.target.value })}><option value="PRIMARY">Primary</option><option value="SECONDARY">Secondary</option></select></Field>}
            {d.routing === "Geolocation" && <Field label="Location"><select aria-label="Location" value={d.location} onChange={(e) => onChange({ location: e.target.value })}>{LOCATIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>}
            <Field label="Health check ID" optional><input type="text" aria-label="Health check ID" value={d.health_check_id} onChange={(e) => onChange({ health_check_id: e.target.value })} /></Field>
          </div>
        )}
      </div>
    </div>
  );
}

export function RecordForm({ mode }: { mode: "create" | "edit" }) {
  const { id, rid } = useParams<{ id: string; rid?: string }>();
  const router = useRouter();
  const flash = useFlash();
  const [zone, setZone] = useState<Zone | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([blank()]);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const z = await api<Zone>(`/hosted-zones/${id}`);
        setZone(z);
        if (mode === "edit") setDrafts([fromRecord(await api<DnsRecord>(`/hosted-zones/${id}/records/${rid}`), z.name)]);
      } catch (e: any) { setLoadErr(e.message); }
    })();
  }, [id, rid, mode]);

  if (loadErr) return <Alert type="error" header="Unable to load">{loadErr}</Alert>;
  if (!zone) return <div style={{ padding: 60, textAlign: "center" }}><span className="spinner big" /></div>;
  const zname = zone.name.replace(/\.$/, "");
  const title = mode === "create" ? "Quick create record" : "Edit record";
  const patch = (key: number, p: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...p, error: null } : d)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const checked = drafts.map((d) => ({ ...d, error: localCheck(d) }));
    if (checked.some((d) => d.error)) { setDrafts(checked); return; }
    setBusy(true);
    const remaining: Draft[] = [];
    let created = 0, failed = false;
    for (const d of checked) {
      if (failed) { remaining.push(d); continue; }
      try {
        await api(mode === "create" ? `/hosted-zones/${id}/records` : `/hosted-zones/${id}/records/${rid}`, { method: mode === "create" ? "POST" : "PUT", body: toBody(d) });
        created++;
      } catch (err: any) { failed = true; remaining.push({ ...d, error: err.message }); }
    }
    setBusy(false);
    if (!failed) {
      flash.add({ type: "success", content: mode === "create" ? `Successfully created ${created} record${created > 1 ? "s" : ""} in hosted zone ${zname}.` : `Successfully edited the record in hosted zone ${zname}.` });
      router.push(`/hosted-zones/${id}`);
    } else {
      setDrafts(remaining);
      if (created) flash.add({ type: "info", content: `${created} record${created > 1 ? "s were" : " was"} created. Fix the remaining record and try again.` });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="form-wrap">
      <Breadcrumbs items={[{ text: "Route 53", href: "/hosted-zones" }, { text: "Hosted zones", href: "/hosted-zones" }, { text: zname, href: `/hosted-zones/${id}` }, { text: title }]} />
      <PageHeader title={title} description={mode === "create" ? "Create one or more records in the hosted zone using the quick create form." : undefined} />
      {drafts.map((d, i) => (
        <RecordPanel key={d.key} d={d} idx={i} zone={zone} count={drafts.length} editing={mode === "edit"} onChange={(p) => patch(d.key, p)} onRemove={() => setDrafts(drafts.filter((x) => x.key !== d.key))} />
      ))}
      {mode === "create" && <div style={{ marginBottom: 20 }}><Button type="button" disabled={drafts.length >= 25} onClick={() => setDrafts([...drafts, blank()])}>Add another record</Button></div>}
      <div className="form-actions sticky-actions">
        <Button type="button" onClick={() => router.push(`/hosted-zones/${id}`)}>Cancel</Button>
        <Button type="submit" variant="primary" loading={busy}>{mode === "create" ? `Create record${drafts.length > 1 ? "s" : ""}` : "Save"}</Button>
      </div>
    </form>
  );
}
