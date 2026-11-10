"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFlash } from "@/components/Flash";
import { Alert, Breadcrumbs, Button, Container, Field, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { REGIONS, type Zone } from "@/lib/types";

const DOMAIN_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*\.?$/;

export default function CreateZone() {
  const router = useRouter();
  const flash = useFlash();
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [region, setRegion] = useState("us-east-1");
  const [vpc, setVpc] = useState("");
  const [tags, setTags] = useState<{ k: string; v: string }[]>([]);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameErr = !name.trim() ? "Domain name is required." : !DOMAIN_RE.test(name.trim()) ? "Domain name is not valid. Use letters, numbers and hyphens separated by dots." : null;
  const vpcErr = type === "private" && !vpc.trim() ? "VPC ID is required for a private hosted zone." : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameErr || vpcErr) return;
    setBusy(true); setError(null);
    try {
      const z = await api<Zone>("/hosted-zones", { method: "POST", body: {
        name, comment, type, vpc_region: type === "private" ? region : null, vpc_id: type === "private" ? vpc.trim() : null,
        tags: Object.fromEntries(tags.filter((t) => t.k.trim()).map((t) => [t.k.trim(), t.v])),
      } });
      flash.add({ type: "success", content: `Successfully created hosted zone ${z.name.replace(/\.$/, "")}.` });
      router.push(`/hosted-zones/${z.id}`);
    } catch (err: any) { setError(err.message); setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate className="form-wrap">
      <Breadcrumbs items={[{ text: "Route 53", href: "/hosted-zones" }, { text: "Hosted zones", href: "/hosted-zones" }, { text: "Create hosted zone" }]} />
      <PageHeader title="Create hosted zone" description="A hosted zone is a container for records, and records contain information about how you want to route traffic for a specific domain, such as example.com, and its subdomains." />
      {error && <Alert type="error" header="Could not create hosted zone">{error}</Alert>}
      <Container title="Hosted zone configuration" desc="The hosted zone is used to route traffic on the internet or in a VPC.">
        <Field label="Domain name" desc="This is the name of the domain that you want to route traffic for." error={touched ? nameErr : null}
               hint="Valid characters: a-z, 0-9, hyphen (-) and dots. Internationalized names must be entered in punycode.">
          <input type="text" className={touched && nameErr ? "invalid" : ""} value={name} onChange={(e) => setName(e.target.value)} placeholder="example.com" autoFocus />
        </Field>
        <Field label="Description" optional desc="This value lets you distinguish hosted zones that have the same name." hint={`The description can have up to 256 characters. ${256 - comment.length} remaining.`}>
          <textarea style={{ fontFamily: "inherit", fontSize: 14, minHeight: 72 }} maxLength={256} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="The hosted zone is used for..." />
        </Field>
        <Field label="Type" desc="The type indicates whether you want to route traffic on the internet or in an Amazon VPC.">
          <label className={`radio-tile ${type === "public" ? "on" : ""}`}>
            <input type="radio" name="type" checked={type === "public"} onChange={() => setType("public")} />
            <div><strong>Public hosted zone</strong><div className="sub" style={{ color: "var(--text-secondary)" }}>A public hosted zone determines how traffic is routed on the internet.</div></div>
          </label>
          <label className={`radio-tile ${type === "private" ? "on" : ""}`}>
            <input type="radio" name="type" checked={type === "private"} onChange={() => setType("private")} />
            <div><strong>Private hosted zone</strong><div className="sub" style={{ color: "var(--text-secondary)" }}>A private hosted zone determines how traffic is routed within an Amazon VPC.</div></div>
          </label>
        </Field>
        {type === "private" && (
          <div className="grid2">
            <Field label="Region" desc="Choose the Region of the VPC to associate with the zone.">
              <select value={region} onChange={(e) => setRegion(e.target.value)}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
            <Field label="VPC ID" desc="Enter a VPC ID." error={touched ? vpcErr : null}>
              <input type="text" className={touched && vpcErr ? "invalid" : ""} value={vpc} onChange={(e) => setVpc(e.target.value)} placeholder="vpc-0123456789abcdef0" />
            </Field>
          </div>
        )}
      </Container>
      <Container title="Tags" desc="Apply tags to your hosted zones to help organize and identify them.">
        {tags.map((t, i) => (
          <div className="kv-row" key={i}>
            <input type="text" placeholder="Enter key" value={t.k} onChange={(e) => setTags(tags.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
            <input type="text" placeholder="Enter value" value={t.v} onChange={(e) => setTags(tags.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
            <Button type="button" onClick={() => setTags(tags.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        ))}
        {tags.length === 0 && <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>No tags associated with the resource.</p>}
        <Button type="button" disabled={tags.length >= 50} onClick={() => setTags([...tags, { k: "", v: "" }])}>Add new tag</Button>
        <div className="hint" style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 12 }}>You can add {50 - tags.length} more tags.</div>
      </Container>
      <div className="form-actions">
        <Button type="button" onClick={() => router.push("/hosted-zones")}>Cancel</Button>
        <Button type="submit" variant="primary" loading={busy}>Create hosted zone</Button>
      </div>
    </form>
  );
}
