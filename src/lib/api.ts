// The one way screens talk to the backend. Calls go to our own /api proxy (see app/api/[...path]/route.ts).
export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined>;
type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; query?: Query };
export type Reply<T> = { data: T; count?: number; message: string };

const FALLBACK = "Something went wrong. Try again.";

export async function api<T = unknown>(path: string, { method = "GET", body, query }: Options = {}): Promise<Reply<T>> {
  const qs = query
    ? "?" + new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]])))
    : "";
  const res = await fetch(`/api/${path}${qs}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({ status: 0, message: FALLBACK }));
  if (!res.ok || json.status !== 1) {
    const expired = res.status === 401 || (res.status === 403 && /expired token/i.test(json.message ?? ""));
    if (expired && !path.startsWith("admin/auth/") && typeof window !== "undefined") window.location.assign("/login?expired=1");
    throw new ApiError(json.message || FALLBACK, res.status, json.data);
  }
  return { data: json.data as T, count: json.count, message: json.message };
}

// Uploads straight to S3 with a presigned URL, so the file never passes through our servers. Catalog photos are public.
export async function upload(file: File, folder: "catalog" = "catalog"): Promise<string> {
  const { data } = await api<{ uploadUrl: string; fileUrl: string }>("uploads/presign", {
    method: "POST",
    body: { folder, contentType: file.type, size: file.size },
  });
  const put = await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
  if (!put.ok) throw new ApiError("The upload didn't finish. Try again.", put.status);
  return data.fileUrl;
}
