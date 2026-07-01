import type { Tokens, JobOut, DiscoverResponse, TailorRunDetail } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "rb_tokens";

// Cache for requests to prevent duplicates
const pendingRequests = new Map<string, Promise<any>>();
const responseCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

export function getTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export function setTokens(tokens: Tokens | null) {
  if (typeof window === "undefined") return;
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKEN_KEY);
  // Clear cache when tokens change
  responseCache.clear();
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function getCacheKey(path: string, opts: RequestInit, auth: boolean): string {
  return `${auth}-${path}-${JSON.stringify({
    method: opts.method,
    body: opts.body instanceof FormData ? null : opts.body,
  })}`;
}

async function request<T>(path: string, opts: RequestInit = {}, auth = true): Promise<T> {
  const url = `${API_URL}${path}`;
  const cacheKey = getCacheKey(path, opts, auth);
  
  // Check if we have a cached response
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("Returning cached response for:", url);
    return cached.data as T;
  }
  
  // Check if a request is already in flight
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    console.log("Deduplicating request for:", url);
    return pending as Promise<T>;
  }

  console.log("Making request to:", url);
  
  const headers = new Headers(opts.headers);
  if (auth) {
    const tokens = getTokens();
    if (tokens) headers.set("Authorization", `Bearer ${tokens.access_token}`);
  }
  if (opts.body && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const requestPromise = (async () => {
    try {
      console.log("Sending request with options:", { ...opts, headers: Object.fromEntries(headers) });
      const res = await fetch(url, { ...opts, headers, cache: "no-store" });
      console.log("Got response:", res.status, res.statusText);
      
      if (!res.ok) {
        let detail = { code: "error", message: res.statusText };
        try {
          const body = await res.json();
          if (body?.error) detail = body.error;
          else if (body?.detail) detail = { code: "error", message: JSON.stringify(body.detail) };
        } catch {
          /* non-JSON error */
        }
        throw new ApiError(detail.message, detail.code, res.status);
      }
      if (res.status === 204) return undefined as T;
      const data = await res.json();
      console.log("Got response data:", data);
      
      // Cache the response for GET requests only
      if (!opts.method || opts.method === "GET") {
        responseCache.set(cacheKey, { data, timestamp: Date.now() });
      }
      
      return data as T;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();
  
  pendingRequests.set(cacheKey, requestPromise);
  
  return requestPromise;
}

export const api = {
  url: API_URL,
  register: (email: string, password: string, name?: string) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }, false),
  login: (email: string, password: string) =>
    request<Tokens>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  changePassword: (currentPassword: string, newPassword: string) =>
    request("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }),
  updateProfile: (name: string | null) => {
    // Clear cache for /auth/me when profile is updated
    const meCacheKey = getCacheKey("/auth/me", {}, true);
    responseCache.delete(meCacheKey);
    return request("/auth/profile", { method: "PUT", body: JSON.stringify({ name }) });
  },
  me: () => request<any>("/auth/me"),
  grantConsent: () => request("/consents", { method: "POST" }),
  listResumes: () => request<any[]>("/resumes"),
  listJobs: () => request<JobOut[]>("/jobs"),
  uploadResume: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    // Clear cache for resumes after upload
    const listResumesKey = getCacheKey("/resumes", {}, true);
    responseCache.delete(listResumesKey);
    return request("/resumes", { method: "POST", body: fd });
  },
  setActiveResume: (id: string) => {
    // Clear cache for resumes after setting active
    const listResumesKey = getCacheKey("/resumes", {}, true);
    responseCache.delete(listResumesKey);
    return request(`/resumes/${id}/active`, { method: "PUT" });
  },

  pasteJD: (raw_text: string, title?: string, company?: string) =>
    request("/jds/paste", { method: "POST", body: JSON.stringify({ raw_text, title, company }) }),
  discover: (query: string, location?: string, top_k = 5) =>
    request<DiscoverResponse>("/jobs/discover", {
      method: "POST",
      body: JSON.stringify({ query, location, top_k }),
    }),

  createTailorRun: (resume_id: string, job_id: string) =>
    request<{ id: string }>("/tailor-runs", {
      method: "POST",
      body: JSON.stringify({ resume_id, job_id }),
    }),
  getJob: (id: string) => request(`/jobs/${id}`),
  deleteJob: (id: string) => {
    const listJobsKey = getCacheKey("/jobs", {}, true);
    responseCache.delete(listJobsKey);
    return request(`/jobs/${id}`, { method: "DELETE" });
  },
  getTailorRun: (id: string) => request(`/tailor-runs/${id}`),
  listTailorRuns: () => request<TailorRunDetail[]>("/tailor-runs"),
  exportVariant: (variant_id: string, format: "docx" | "pdf") =>
    request<{ format: string; download_url: string }>(`/variants/${variant_id}/export`, {
      method: "POST",
      body: JSON.stringify({ format }),
    }),
};
