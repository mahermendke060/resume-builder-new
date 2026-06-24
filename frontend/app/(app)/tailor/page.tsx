"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, getTokens, setTokens } from "@/lib/api";
import type { JobOut, ResumeOut, TailorRunDetail } from "@/lib/types";
import { Sparkles, CheckCircle2, AlertCircle, ArrowLeft, FileText, Loader2 } from "lucide-react";

export default function TailorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("jobId");
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [jobs, setJobs] = useState<JobOut[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [run, setRun] = useState<TailorRunDetail | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

  const refreshResumes = useCallback(async () => {
    try {
      const allResumes = (await api.listResumes()) as ResumeOut[];
      setResumes(allResumes);
      if (allResumes.length > 0) {
        const activeResume = allResumes.find(r => r.active);
        if (activeResume) {
          setSelectedResumeId(activeResume.id);
        } else {
          setSelectedResumeId(allResumes[0].id);
        }
      }
    } catch (e: any) {
      if (e.status === 401) logout();
    }
  }, []);

  const loadJobs = useCallback(async () => {
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
    Promise.all([refreshResumes(), loadJobs()]).finally(() => {
      setLoading(false);
    });
  }, [router, refreshResumes, loadJobs]);

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

  const selectedResume = resumes.find(r => r.id === selectedResumeId);
  const structuredResume = selectedResume?.parse_status === "structured" ? selectedResume : null;

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Tailor & score</h1>
        <p className="text-muted-foreground mt-1">
          Select a job to tailor your resume and get an ATS score.
        </p>
      </div>

      {err && <p className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">{err}</p>}
      {msg && <p className="rounded-md bg-green-100 text-green-700 px-4 py-3 text-sm">{msg}</p>}

      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : structuredResume && jobs.length > 0 ? (
        <TailorSection
          structuredResume={structuredResume}
          jobs={jobs}
          initialJobId={initialJobId}
          run={run}
          setRun={setRun}
          guard={guard}
          busy={busy}
          onDownload={downloadFile}
          selectedVariantIndex={selectedVariantIndex}
          setSelectedVariantIndex={setSelectedVariantIndex}
        />
      ) : (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-muted-foreground">Please upload a resume and add a job to tailor!</p>
        </div>
      )}
    </div>
  );
}

function TailorSection({
  structuredResume,
  jobs,
  initialJobId,
  run,
  setRun,
  guard,
  busy,
  onDownload,
  selectedVariantIndex,
  setSelectedVariantIndex,
}: any) {
  const [jobId, setJobId] = useState<string>(initialJobId || "");
  const [selectedJob, setSelectedJob] = useState<JobOut | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchJob = useCallback(async (id: string) => {
    if (!id) {
      setSelectedJob(null);
      return;
    }
    setLoadingJob(true);
    try {
      // Always fetch from backend to get the full job with description
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

  // Hide JD when run starts
  const showJD = !run || ["done", "failed"].includes(run.status);

  return (
    <div className="rounded-xl border bg-card p-6 space-y-6">
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

      {showJD && selectedJob?.description?.raw_text && (
        <div>
          <h4 className="block text-sm font-medium mb-1">Job description</h4>
          <div
            className="rounded-md border bg-background p-3 overflow-y-auto relative resize-y max-h-96"
            style={{ resize: 'vertical', minHeight: '100px', height: '200px' }}
          >
            <p className="text-sm whitespace-pre-wrap">
              {selectedJob.description.raw_text}
            </p>
            {/* Resize handle indicator */}
            <div className="absolute bottom-1 right-1 w-3 h-3 border-t-2 border-l-2 border-muted-foreground/30 transform rotate-45" />
          </div>
        </div>
      )}

      {/* Only show generate button if job is selected and not already running */}
      {jobId && !run && (
        <div className="flex justify-end gap-2">
          <button
            disabled={busy || !structuredResume}
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
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Generate tailored resume
          </button>
        </div>
      )}

      {run && (
        <RunResult
          run={run}
          selectedVariantIndex={selectedVariantIndex}
          setSelectedVariantIndex={setSelectedVariantIndex}
          onDownload={onDownload}
        />
      )}
    </div>
  );
}

function RunResult({
  run,
  selectedVariantIndex,
  setSelectedVariantIndex,
  onDownload,
}: {
  run: TailorRunDetail;
  selectedVariantIndex: number;
  setSelectedVariantIndex: any;
  onDownload: any;
}) {
  const sanitizeText = (text: string) => {
    if (!text) return text;
    return text
      .replace(/[\u2014\u2013]/g, "-") // Replace em/en dashes with hyphens
      .replace(/[\u2018\u2019]/g, "'") // Replace smart single quotes
      .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
      .replace(/[\u2026]/g, "...") // Replace ellipsis
      .replace(/[\u00A0]/g, " "); // Replace non-breaking spaces
  };

  const inProgress = !["done", "failed"].includes(run.status);
  const currentScore = run.scores?.[selectedVariantIndex];
  const variantLabels = ["Technical-focused", "Experience-focused"];

  return (
    <div className="pt-6 border-t border-border space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">Status:</span>
        <span className="text-sm bg-secondary px-3 py-1.5 rounded-full font-medium">{run.status}</span>
        {inProgress && <span className="text-sm text-muted-foreground">working…</span>}
      </div>
      {run.error && <p className="text-sm text-destructive">{run.error}</p>}

      {/* Variant selection */}
      {run.variants?.length > 0 && (
        <div className="flex gap-2">
          {run.variants.map((variant, index) => (
            <button
              key={variant.id}
              onClick={() => setSelectedVariantIndex(index)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedVariantIndex === index
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {variantLabels[index] || `Variant ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      {currentScore && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold">ATS-style score</h4>
            <strong className="text-2xl font-bold">{currentScore.overall}/100</strong>
          </div>

          <div className="h-4 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-500"
              style={{ 
                width: `${currentScore.overall}%`,
                background: `linear-gradient(to right, hsl(239 84% 60%), hsl(150 60% 50%))`
              }}
            />
          </div>

          <div className="space-y-3">
            {Object.entries(currentScore.breakdown).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center py-2 border-b border-border">
                <span className="capitalize text-sm">{k.replace(/_/g, " ")}</span>
                <span className="text-sm font-medium">{v as number}</span>
              </div>
            ))}
          </div>

          {currentScore.missing_keywords.length > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Missing keywords:</span> {currentScore.missing_keywords.map(sanitizeText).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Tailored resume display */}
      {run.variants?.[selectedVariantIndex]?.content_json && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold">Tailored resume</h4>
          
          {(() => {
            const variant = run.variants[selectedVariantIndex];
            return (
              <div className="space-y-4">
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
            );
          })()}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button 
          onClick={() => onDownload(run.variants?.[selectedVariantIndex]?.id, "docx")}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Download DOCX
        </button>
        <button 
          onClick={() => onDownload(run.variants?.[selectedVariantIndex]?.id, "pdf")}
          className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}