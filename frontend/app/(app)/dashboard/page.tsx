"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getTokens, setTokens } from "@/lib/api";
import type { JobOut, ResumeOut } from "@/lib/types";
import { Sparkles, FileText, ClipboardList, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [jobs, setJobs] = useState<JobOut[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const refreshResumes = useCallback(async () => {
    try {
      setResumes((await api.listResumes()) as ResumeOut[]);
    } catch (e: any) {
      if (e.status === 401) logout();
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      setJobs((await api.listJobs()) as JobOut[]);
    } catch (e: any) {
      if (e.status === 401) logout();
    }
  }, []);

  useEffect(() => {
    if (!getTokens()) {
      router.replace("/login");
      return;
    }
    Promise.all([refreshResumes(), refreshJobs()]).finally(() => {
      setInitialLoading(false);
    });
  }, [router, refreshResumes, refreshJobs]);

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

  const structuredResume = resumes.find((r) => r.parse_status === "structured");



  return (
    <>
      {initialLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Paste a job description to score it against your resume in seconds.
              </p>
            </div>
            <Link
              href="/add-job"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4" />
              Paste Job Description
            </Link>
          </div>

          {err && <p className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">{err}</p>}
          {msg && <p className="rounded-md bg-success/10 text-success px-4 py-3 text-sm">{msg}</p>}

          {/* Top Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Resume Card */}
            <div className="rounded-xl border bg-card p-5">
              {structuredResume ? (
                <div className="flex items-center gap-3 rounded-lg bg-green-50 text-green-900 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium">Resume is ready</p>
                    <p className="text-sm text-green-700">{structuredResume.filename}</p>
                  </div>
                  <Link
                    href="/resume"
                    className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                  >
                    View
                  </Link>
                </div>
              ) : resumes.length > 0 ? (
                <div className="flex items-center gap-3 rounded-lg bg-yellow-50 text-yellow-900 px-4 py-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div className="flex-1">
                    <p className="font-medium">Processing resume…</p>
                    <p className="text-sm text-yellow-700">{resumes[0].filename}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-dashed bg-background px-4 py-6">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-muted-foreground">No resume uploaded</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload a resume to start tailoring to jobs
                    </p>
                  </div>
                  <Link
                    href="/resume"
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Upload
                  </Link>
                </div>
              )}
            </div>

            {/* Profile Completeness */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Profile completeness</span>
                <span className="ml-auto text-sm font-semibold text-primary">71%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "71%" }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Add: preferred roles, LinkedIn</p>
              <Link href="/settings" className="text-xs text-primary font-medium hover:underline mt-2 inline-block">
                Update profile →
              </Link>
            </div>
          </div>



          {/* Recent Jobs */}
          {jobs.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-4 w-4 flex items-center justify-center">
                  <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold tracking-tight">RECENT JOBS</h2>
              </div>

              <div className="space-y-2">
                {jobs.slice(0, 3).map((job) => {
                  return (
                    <div key={job.id} className="rounded-xl border bg-card p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{job.title || "Untitled job"}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                          {job.company && <span>{job.company}</span>}
                          {job.company && job.location && <span>·</span>}
                          {job.location && <span>{job.location}</span>}
                        </div>
                      </div>
                      <Link href={`/tailor?jobId=${job.id}`} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                        Tailor Resume
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


        </div>
      )}
    </>
  );
}
