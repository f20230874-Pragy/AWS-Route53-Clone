export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Opts = { method?: string; body?: unknown };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? "GET",
    credentials: "same-origin",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) {
    let msg = res.statusText || "Request failed";
    const d = data?.detail;
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d)) msg = d.map((e: any) => `${(e.loc ?? []).slice(1).join(".")}: ${e.msg}`).join("; ");
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
      window.dispatchEvent(new Event("r53:unauthorized"));
    }
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const qs = (params: Record<string, string | number | undefined>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") u.set(k, String(v)); });
  const s = u.toString();
  return s ? `?${s}` : "";
};
