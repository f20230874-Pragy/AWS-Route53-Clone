"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Zone } from "@/lib/types";
import { useFlash } from "./Flash";
import { Alert, Button, Field, Modal } from "./ui";

export function DeleteZoneModal({ zone, onClose, onDeleted }: { zone: Zone; onClose: () => void; onDeleted: () => void }) {
  const flash = useFlash();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try {
      await api(`/hosted-zones/${zone.id}`, { method: "DELETE" });
      flash.add({ type: "success", content: `Successfully deleted hosted zone ${zone.name.replace(/\.$/, "")}.` });
      onDeleted();
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal title="Delete hosted zone" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={text !== "delete"} loading={busy} onClick={go}>Delete</Button></>}>
      {error && <Alert type="error" header="Could not delete hosted zone">{error}</Alert>}
      <p>Permanently delete the hosted zone <strong>{zone.name.replace(/\.$/, "")}</strong>?</p>
      <Alert type="warning">You can’t delete a hosted zone that contains records other than the default NS and SOA records. Delete those records first.</Alert>
      <Field label='To confirm deletion, type "delete" in the field'>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="delete" autoFocus />
      </Field>
    </Modal>
  );
}

export function EditZoneModal({ zone, onClose, onSaved }: { zone: Zone; onClose: () => void; onSaved: () => void }) {
  const flash = useFlash();
  const [comment, setComment] = useState(zone.comment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api(`/hosted-zones/${zone.id}`, { method: "PUT", body: { comment } });
      flash.add({ type: "success", content: `Successfully updated hosted zone ${zone.name.replace(/\.$/, "")}.` });
      onSaved();
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal title="Edit hosted zone" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save changes</Button></>}>
      {error && <Alert type="error">{error}</Alert>}
      <Field label="Hosted zone name"><input type="text" value={zone.name.replace(/\.$/, "")} disabled /></Field>
      <Field label="Type"><input type="text" value={zone.type === "public" ? "Public hosted zone" : "Private hosted zone"} disabled /></Field>
      <Field label="Description" optional hint={`The description can have up to 256 characters. ${256 - comment.length} remaining.`}>
        <textarea style={{ fontFamily: "inherit", fontSize: 14, minHeight: 72 }} maxLength={256} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
    </Modal>
  );
}

