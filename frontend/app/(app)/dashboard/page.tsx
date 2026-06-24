"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getTokens, setTokens } from "@/lib/api";
import type { JobOut, ResumeOut, TailorRunDetail } from "@/lib/types";
import { Sparkles, FileText, ClipboardList, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [jobs, setJobs] = useState<JobOut[]>([]);
  const [run, setRun] = useState<TailorRunDetail | null>(null);
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

  // --- polling for the active run ---
  useEffect(() => {
    if (!run || run.status === "done" || run.status === "failed") return;
    const t = setInterval(async () => {
      try {
        const updated = (await api.getTailorRun(run.id)) as TailorRunDetail;
        setRun(updated);
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [run]);

  async function downloadFile(variantId: string, format: "docx" | "pdf") {
    await guard(async () => {
      const { download_url } = await api.exportVariant(variantId, format);
      const res = await fetch(`${api.url}${download_url}`, {
        headers: { Authorization: `Bearer ${getTokens()?.access_token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Mock data for UI
  const mockRecentMatches = [
    {
      id: 1,
      title: "Data Scientist",
      company: "Wisemork",
      score: 14,
      status: "Weak match"
    },
    {
      id: 2,
      title: "Data Analyst / ML Engineer",
      company: "v4c.ai",
      location: "Bengaluru",
      score: 25,
      status: "Weak match"
    }
  ];

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

          {/* Applications */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold tracking-tight">APPLICATIONS</h2>
              </div>
              <span className="text-xs text-muted-foreground">0 total</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "Saved", count: 0, color: "bg-gray-100 text-gray-700" },
                { label: "Ready to Apply", count: 0, color: "bg-blue-50 text-blue-700" },
                { label: "Applied", count: 0, color: "bg-blue-50 text-blue-700" },
                { label: "Recruiter Contacted", count: 0, color: "bg-purple-50 text-purple-700" },
                { label: "Interview", count: 0, color: "bg-yellow-50 text-yellow-700" },
                { label: "Rejected", count: 0, color: "bg-red-50 text-red-700" },
                { label: "Offer", count: 0, color: "bg-green-50 text-green-700" },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border bg-card p-4 text-center">
                  <p className="text-2xl font-semibold">{item.count}</p>
                  <p className={`text-xs rounded-full px-2 py-0.5 mt-2 inline-block ${item.color}`}>{item.label}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-muted-foreground text-sm mt-6">
              No applications tracked yet. Save a job from a match analysis to start.
            </p>
          </div>

          {/* Recent Matches */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-4 w-4 flex items-center justify-center">
                <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold tracking-tight">RECENT MATCHES</h2>
            </div>

            <div className="space-y-2">
              {mockRecentMatches.map((match) => (
                <div key={match.id} className="rounded-xl border bg-card p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{match.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                      {match.company && <span>{match.company}</span>}
                      {match.company && match.location && <span>·</span>}
                      {match.location && <span>{match.location}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-red-500">{match.score}</p>
                    <p className="text-xs text-muted-foreground">{match.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tailor Section */}
          {structuredResume && jobs.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Tailor & score</h2>
              <TailorSection
                structuredResume={structuredResume}
                jobs={jobs}
                run={run}
                setRun={setRun}
                guard={guard}
                busy={busy}
                onDownload={downloadFile}
                resumes={resumes}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ConsentAndUpload({ resumes, structuredResume, onChange, guard, busy }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [consented, setConsented] = useState(false);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h3 className="text-lg font-semibold">Your resume</h3>
      <p className="text-muted-foreground">
        Your resume is processed by AI models to tailor it.
      </p>
      
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="rounded border-gray-300 text-primary focus:ring-primary"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
        />
        I consent to AI processing of my resume.
      </label>
      
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-4 file:rounded-md file:border file:border-gray-300 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:hover:bg-secondary/80"
        />
        <button
          disabled={busy || !file || !consented}
          onClick={() =>
            guard(async () => {
              await api.grantConsent();
              await api.uploadResume(file!);
              await onChange();
            })
          }
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Upload & parse
        </button>
      </div>
    </div>
  );
}

function JobIntake({ jobs, setJobs, guard, busy }: any) {
  const [tab, setTab] = useState<"paste" | "discover">("paste");
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h3 className="text-lg font-semibold">The job</h3>
      
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
          Discover
        </button>
      </div>

      {tab === "paste" ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Job title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Job description</label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Paste the full job description…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[150px]"
            />
          </div>
          <button
            disabled={busy || raw.trim().length < 20}
            onClick={() =>
              guard(async () => {
                const job = await api.pasteJD(raw, title || undefined);
                setJobs((prev: JobOut[]) => [job as JobOut, ...prev]);
                setRaw("");
              })
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Add job
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
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
          <button
            disabled={busy || query.trim().length < 2}
            onClick={() =>
              guard(async () => {
                const res = await api.discover(query, location || undefined, 5);
                setJobs((prev: JobOut[]) => [...(res.jobs as JobOut[]), ...prev]);
              })
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Find top 5
          </button>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Added jobs</h4>
          <div className="space-y-2">
            {jobs.map((j: JobOut) => (
              <div key={j.id} className="flex items-center justify-between rounded-lg border bg-background px-4 py-2">
                <div>
                  <p className="font-medium text-sm">{j.title || "(untitled)"}</p>
                  <p className="text-xs text-muted-foreground">{j.company || "—"}</p>
                </div>
                <span className="text-xs text-muted-foreground">{j.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TailorSection({ structuredResume, jobs, run, setRun, guard, busy, onDownload }: any) {
  const [jobId, setJobId] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobOut | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

  const fetchJob = useCallback(async (id: string) => {
    if (!id) {
      setSelectedJob(null);
      return;
    }
    setLoadingJob(true);
    try {
      const job = (await api.getJob(id)) as JobOut;
      setSelectedJob(job);
    } catch (e: any) {
      console.error("Failed to fetch job", e);
    } finally {
      setLoadingJob(false);
    }
  }, []);

  useEffect(() => {
    fetchJob(jobId);
  }, [jobId, fetchJob]);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h3 className="text-lg font-semibold">Tailor & score</h3>
      
      <div>
        <label className="block text-sm font-medium mb-1">Target job</label>
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select a job…</option>
          {jobs.map((j: JobOut) => (
            <option key={j.id} value={j.id}>
              {(j.title || "Untitled") + (j.company ? ` — ${j.company}` : "")}
            </option>
          ))}
        </select>
      </div>

      {loadingJob && <p className="text-sm text-muted-foreground">Loading job description…</p>}
      
      {selectedJob?.description?.raw_text && (
        <div>
          <label className="block text-sm font-medium mb-1">Job description</label>
          <textarea
            value={selectedJob.description.raw_text}
            readOnly
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-48"
          />
        </div>
      )}

      <button
        disabled={busy || !structuredResume || !jobId}
        onClick={() =>
          guard(async () => {
            const created = await api.createTailorRun(structuredResume.id, jobId);
            setRun({
              id: created.id,
              resume_id: structuredResume.id,
              job_id: jobId,
              status: "queued",
              error: null,
              variants: [],
              scores: [],
            });
          })
        }
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Generate tailored resumes
      </button>

      {run && <RunResult 
        run={run} 
        selectedVariantIndex={selectedVariantIndex}
        setSelectedVariantIndex={setSelectedVariantIndex}
        onDownload={onDownload} 
      />}
    </div>
  );
}

function ResumeVariantDisplay({ variant, score, onDownload }: { variant: any; score: any; onDownload: any }) {
  const sanitizeText = (text: string) => {
    if (!text) return text;
    return text
      .replace(/[\u2014\u2013]/g, "-") // Replace em/en dashes with hyphens
      .replace(/[\u2018\u2019]/g, "'") // Replace smart single quotes
      .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
      .replace(/[\u2026]/g, "...") // Replace ellipsis
      .replace(/[\u00A0]/g, " ") // Replace non-breaking spaces
  };

  return (
    <div className="space-y-4 mt-4 pt-4 border-t">
      {score && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">ATS-style score</h4>
            <strong className="text-2xl">{score.overall}/100</strong>
          </div>
          
          <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${score.overall}%` }} />
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(score.breakdown).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
                <span className="font-medium">{v as number}</span>
              </div>
            ))}
          </div>

          {score.missing_keywords.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Missing keywords:</p>
              <div className="flex flex-wrap gap-2">
                {score.missing_keywords.map((kw: string, i: number) => (
                  <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                    {sanitizeText(kw)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {score.warnings.map((w: string, i: number) => (
            <p key={i} className="text-sm bg-yellow-50 text-yellow-900 px-3 py-2 rounded-md">
              ⚠ {sanitizeText(w)}
            </p>
          ))}
        </div>
      )}

      {variant?.content_json && (
        <div className="space-y-4">
          <h4 className="font-medium">Tailored resume</h4>
          
          {variant.content_json.contact && (
            <div className="space-y-1">
              <h5 className="text-sm font-medium text-muted-foreground">Contact</h5>
              <div className="flex flex-wrap gap-4 text-sm">
                {variant.content_json.contact.name && <span><strong>Name:</strong> {sanitizeText(variant.content_json.contact.name)}</span>}
                {variant.content_json.contact.email && <span><strong>Email:</strong> {sanitizeText(variant.content_json.contact.email)}</span>}
                {variant.content_json.contact.phone && <span><strong>Phone:</strong> {sanitizeText(variant.content_json.contact.phone)}</span>}
                {variant.content_json.contact.location && <span><strong>Location:</strong> {sanitizeText(variant.content_json.contact.location)}</span>}
                {variant.content_json.contact.links?.length > 0 && (
                  <div>
                    <strong>Links:</strong>
                    <ul className="list-disc ml-5 mt-1">
                      {variant.content_json.contact.links.map((link: string, i: number) => (
                        <li key={i}><a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{sanitizeText(link)}</a></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {variant.content_json.summary && (
            <div>
              <h5 className="text-sm font-medium text-muted-foreground">Summary</h5>
              <p className="text-sm mt-1">
                {sanitizeText(
                  typeof variant.content_json.summary === "object" 
                    ? variant.content_json.summary.text || JSON.stringify(variant.content_json.summary) 
                    : variant.content_json.summary
                )}
              </p>
            </div>
          )}

          {variant.content_json.skills?.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-muted-foreground">Skills</h5>
              <div className="flex flex-wrap gap-2 mt-1">
                {variant.content_json.skills.map((skill: string, i: number) => (
                  <span key={i} className="text-xs bg-secondary px-2 py-1 rounded-full">{sanitizeText(skill)}</span>
                ))}
              </div>
            </div>
          )}

          {variant.content_json.experience?.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-muted-foreground">Experience</h5>
              {variant.content_json.experience.map((exp: any, i: number) => (
                <div key={i} className="rounded-lg border bg-background p-3">
                  <div className="font-medium">
                    {sanitizeText(exp.title)} · {sanitizeText(exp.company)}
                  </div>
                  {(exp.location || exp.start || exp.end) && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {[sanitizeText(exp.location), sanitizeText(exp.start), sanitizeText(exp.end)].filter(Boolean).join(" • ")}
                    </div>
                  )}
                  {exp.bullets?.length > 0 && (
                    <ul className="list-disc ml-5 mt-2 text-sm space-y-1">
                      {exp.bullets.map((b: any, j: number) => (
                        <li key={j}>
                          {sanitizeText(
                            typeof b === "object" ? b.text || JSON.stringify(b) : b
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {variant.content_json.education?.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-muted-foreground">Education</h5>
              {variant.content_json.education.map((edu: any, i: number) => (
                <div key={i} className="text-sm">
                  <div className="font-medium">{sanitizeText(edu.degree)}</div>
                  <div className="text-muted-foreground">{sanitizeText(edu.institution)}{edu.year ? ` · ${edu.year}` : ""}</div>
                </div>
              ))}
            </div>
          )}

          {variant.content_json.certifications?.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-muted-foreground">Certifications</h5>
              <ul className="list-disc ml-5 mt-1 text-sm">
                {variant.content_json.certifications.map((cert: string, i: number) => (
                  <li key={i}>{sanitizeText(cert)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {variant && (
        <div className="flex gap-2">
          <button onClick={() => onDownload(variant.id, "docx")} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Download DOCX
          </button>
          <button onClick={() => onDownload(variant.id, "pdf")} className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary">
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
}

function RunResult({ run, selectedVariantIndex, setSelectedVariantIndex, onDownload }: { run: TailorRunDetail; selectedVariantIndex: number; setSelectedVariantIndex: any; onDownload: any }) {
  const inProgress = !["done", "failed"].includes(run.status);
  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      <div className="flex items-center gap-3">
        <span className="font-medium">Status:</span>
        <span className="text-sm bg-secondary px-2 py-1 rounded-full">{run.status}</span>
        {inProgress && <span className="text-sm text-muted-foreground">working…</span>}
      </div>
      {run.error && <p className="text-sm text-destructive">{run.error}</p>}

      {run.variants?.length > 0 && (
        <>
          <div className="flex gap-2">
            {run.variants.map((variant, idx) => {
              const type = variant.provenance_json?.type || "variant";
              const label = type === "technical" ? "Technical Focus" : type === "experience" ? "Experience Focus" : `Variant ${idx + 1}`;
              return (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariantIndex(idx)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    selectedVariantIndex === idx ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          
          <ResumeVariantDisplay
            variant={run.variants[selectedVariantIndex]}
            score={run.scores[selectedVariantIndex]}
            onDownload={onDownload}
          />
        </>
      )}
    </div>
  );
}
