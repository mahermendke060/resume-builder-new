"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getTokens, setTokens } from "@/lib/api";
import type { JobOut, JobStub } from "@/lib/types";
import { Sparkles, ArrowLeft, BriefcaseBusiness, Check, Plus, Trash2, Loader2 } from "lucide-react";

export default function AddJobPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"paste" | "discover" | "saved">("paste");
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [discoveredJobs, setDiscoveredJobs] = useState<JobStub[]>([]);
  const [savedJobs, setSavedJobs] = useState<JobOut[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [addedJobKeys, setAddedJobKeys] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);

  function logout() {
    setTokens(null);
    router.replace("/login");
  }

  async function guard(fn: () => Promise<void>) {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setErr(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSavedJobs() {
    try {
      console.log("Refreshing saved jobs...");
      const jobs = (await api.listJobs()) as JobOut[];
      console.log("Fetched jobs:", jobs);
      setSavedJobs(jobs);
      setSavedJobIds(new Set(jobs.map(j => j.id)));
    } catch (e: any) {
      console.error("Error fetching saved jobs:", e);
      if (e.status === 401) logout();
    }
  }

  useEffect(() => {
    console.log("Tab changed to:", tab);
    if (tab === "saved") {
      console.log("Refreshing saved jobs for saved tab...");
      refreshSavedJobs();
    }
  }, [tab]);

  // Load saved jobs on mount to get savedJobIds
  useEffect(() => {
    refreshSavedJobs().finally(() => {
      setInitialLoading(false);
    });
  }, []);

  return (
    <>
      {initialLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Jobs</h1>
            <p className="text-muted-foreground mt-1">
              Paste a job description, discover roles from job boards, or use your saved jobs.
            </p>
          </div>

          {err && <p className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">{err}</p>}
          {msg && <p className="rounded-md bg-green-100 text-green-700 px-4 py-3 text-sm">{msg}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => setTab("paste")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === "paste" ? "bg-secondary" : "hover:bg-secondary/50"
              }`}
            >
              Paste JD
            </button>
            <button
              onClick={() => setTab("discover")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === "discover" ? "bg-secondary" : "hover:bg-secondary/50"
              }`}
            >
              Discover via SerpApi
            </button>
            <button
              onClick={() => setTab("saved")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === "saved" ? "bg-secondary" : "hover:bg-secondary/50"
              }`}
            >
              Saved jobs
            </button>
          </div>

          {tab === "paste" ? (
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Job title (optional)</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Senior Data Scientist"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Job description</label>
                <textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder="Paste the full job description here…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[300px]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Link href="/dashboard" className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary">
                  Cancel
                </Link>
                <button
                  disabled={busy || raw.trim().length < 20}
                  onClick={() =>
                    guard(async () => {
                      await api.pasteJD(raw, title || undefined);
                      await refreshSavedJobs();
                      setMsg("Job added successfully!");
                      setTab("saved");
                      setRaw("");
                      setTitle("");
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add job
                </button>
              </div>
            </div>
          ) : tab === "discover" ? (
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Role / keywords</label>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Senior Python Engineer"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Link href="/dashboard" className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary">
                  Cancel
                </Link>
                <button
                  disabled={busy || query.trim().length < 2}
                  onClick={() =>
                    guard(async () => {
                      const result = await api.discover(query, location || undefined, 5);
                      console.log("Discover result:", result);
                      setDiscoveredJobs(result.jobs || []);
                      setAddedJobKeys(new Set());
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Find jobs
                </button>
              </div>

              {discoveredJobs.length > 0 && (
                <div className="mt-6 border-t pt-6 space-y-6">
                  <h3 className="font-semibold text-sm">Found jobs</h3>
                  {discoveredJobs.map((job, idx) => {
                    const key = `${job.title}-${job.company}-${job.location}-${idx}`;
                    // Check if already added by clicking the button in this session
                    const isAlreadySaved = addedJobKeys.has(key);
                    
                    return (
                      <div key={key} className="flex items-center justify-between p-4 rounded-lg border bg-background">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-secondary">
                            <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{job.title || "Untitled job"}</p>
                            <p className="text-xs text-muted-foreground">
                              {[job.company, job.location].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </div>
                        {isAlreadySaved ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Added</span>
                            <Check className="h-5 w-5 text-green-600" />
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              guard(async () => {
                                console.log("Adding job:", job);
                                // Check if already saved in backend (to avoid duplicates)
                                const isSavedInBackend = savedJobs.some(
                                  (j) => j.title === job.title && j.company === job.company
                                );
                                if (!isSavedInBackend) {
                                  // Use pasteJD to save the job to the backend with the snippet as description
                                  const savedJob = await api.pasteJD(
                                    job.snippet || "No description available",
                                    job.title,
                                    job.company
                                  );
                                  console.log("Saved job to backend:", savedJob);
                                  // Refresh saved jobs
                                  await refreshSavedJobs();
                                }
                                // Mark this job as added in the UI
                                setAddedJobKeys(prev => new Set([...prev, key]));
                                setMsg("Job added successfully!");
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h3 className="font-semibold text-sm">Saved jobs</h3>
              {savedJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">You haven't saved any jobs yet.</p>
              ) : (
                <div className="space-y-3">
                  {savedJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-background"
                    >
                      <Link
                        href={`/tailor?jobId=${job.id}`}
                        className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
                      >
                        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-secondary">
                          <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{job.title || "Untitled job"}</p>
                          <p className="text-xs text-muted-foreground">
                            {[job.company, job.location].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            guard(async () => {
                              await api.deleteJob(job.id);
                              await refreshSavedJobs();
                              setMsg("Job removed successfully!");
                            });
                          }}
                          className="p-2 rounded-md hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors"
                          title="Remove job"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                        <Check className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
