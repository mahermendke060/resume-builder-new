"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Download, Eye } from "lucide-react";
import { api, getTokens } from "@/lib/api";
import type { TailorRunDetail, JobOut } from "@/lib/types";

export default function HistoryPage() {
  const [runs, setRuns] = useState<TailorRunDetail[]>([]);
  const [jobs, setJobs] = useState<Map<string, JobOut>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [runsData, jobsData] = await Promise.all([
          api.listTailorRuns(),
          api.listJobs(),
        ]);

        const jobMap = new Map<string, JobOut>();
        jobsData.forEach(job => jobMap.set(job.id, job));

        setRuns(runsData);
        setJobs(jobMap);
      } catch (e) {
        console.error("Failed to load history data", e);
      } finally {
        setLoading(false);
      }
    }

    if (getTokens()) {
      loadData();
    }
  }, []);

  async function downloadFile(variantId: string, format: "docx" | "pdf", openInNewTab = false) {
    setBusy(variantId + format);
    try {
      const { download_url } = await api.exportVariant(variantId, format);
      const res = await fetch(`${api.url}${download_url}`, {
        headers: { Authorization: `Bearer ${getTokens()?.access_token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      if (openInNewTab) {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `tailored-resume.${format}`;
        a.click();
      }
      
      setTimeout(() => URL.revokeObjectURL(url), 10000); // Clean up after 10 seconds
    } finally {
      setBusy(null);
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-1">
          Your library of all tailored resumes
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background p-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No history yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to Tailor & Score to create your first tailored resume
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map(run => {
            const job = jobs.get(run.job_id);
            return (
              <div
                key={run.id}
                className="rounded-xl border bg-card p-6 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {job?.title || "Untitled Job"}
                      {job?.company && ` — ${job.company}`}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(run.created_at || run.completed_at || "")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {run.variants.map((variant, index) => {
                    const score = run.scores[index];
                    const type = variant.provenance_json?.type || "variant";
                    const label = type === "technical" ? "Technical Focus" : type === "experience" ? "Experience Focus" : `Variant ${index + 1}`;

                    return (
                      <div
                        key={variant.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-background"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-secondary text-sm font-medium">
                              {label}
                            </span>
                            {score && (
                              <span className="text-sm font-semibold">
                                ATS {Math.round(score.overall)}/100
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadFile(variant.id, "pdf", true)}
                            disabled={busy === variant.id + "pdf"}
                            className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </button>
                          <button
                            onClick={() => downloadFile(variant.id, "docx")}
                            disabled={busy === variant.id + "docx"}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                            DOCX
                          </button>
                          <button
                            onClick={() => downloadFile(variant.id, "pdf")}
                            disabled={busy === variant.id + "pdf"}
                            className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
