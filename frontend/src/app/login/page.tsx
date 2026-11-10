"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Alert, Button, Field } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [account, setAccount] = useState("123456789012");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/auth/me").then(() => router.replace("/hosted-zones")).catch(() => {}); }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/auth/login", { method: "POST", body: { account_id: account, username, password } });
      router.replace("/hosted-zones");
    } catch (err: any) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="login-page">
      <div className="login-top"><span style={{ color: "#fff", fontWeight: 800, fontSize: 24, letterSpacing: -1 }}>aws</span></div>
      <form className="login-card" onSubmit={submit}>
        <h1>Sign in</h1>
        <div className="lbl" style={{ fontWeight: 700, marginBottom: 8 }}>IAM user</div>
        {error && <Alert type="error" header="Authentication failed">{error}</Alert>}
        <Field label="Account ID (12 digits) or account alias">
          <input type="text" value={account} onChange={(e) => setAccount(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="IAM user name">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
        </Field>
        <Button variant="primary" type="submit" loading={busy}>Sign in</Button>
        <div className="login-hint">
          <strong>Demo credentials</strong> (mocked authentication)<br />
          Account ID <span className="mono">123456789012</span> · User <span className="mono">admin</span> · Password <span className="mono">password</span>
        </div>
      </form>
    </div>
  );
}
