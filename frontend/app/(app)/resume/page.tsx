"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getTokens, setTokens } from "@/lib/api";
import type { ResumeOut } from "@/lib/types";
import { FileText, Upload, ArrowLeft, Loader2 } from "lucide-react";

export default function ResumePage() {
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // Track which button is busy
  const [view, setView] = useState<"list" | "upload">("list");
  const [initialLoading, setInitialLoading] = useState(true);

  const refreshResumes = useCallback(async () => {
    try {
      setResumes((await api.listResumes()) as ResumeOut[]);
    } catch (e: any) {
      if (e.status === 401) logout();
    }
  }, []);

  useEffect(() => {
    if (!getTokens()) {
      router.replace("/login");
      return;
    }
    refreshResumes().finally(() => {
      setInitialLoading(false);
    });
  }, [router, refreshResumes]);

  function logout() {
    setTokens(null);
    router.replace("/login");
  }

  async function setPrimaryResume(id: string) {
    setErr("");
    setMsg("");
    setBusy(id);
    try {
      await api.setActiveResume(id);
      await refreshResumes();
      setMsg("Primary resume updated!");
    } catch (e: any) {
      setErr(e.message || "Error");
    } finally {
      setBusy(null);
    }
  }

  // Helper to format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (view === "upload") {
    return <UploadView onBack={() => setView("list")} refresh={refreshResumes} setBusy={setBusy} busy={busy !== null} />;
  }

  return (
    <>
      {initialLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Resumes</h1>
              <p className="text-muted-foreground mt-1">{resumes.length} uploaded</p>
            </div>
            <button
              onClick={() => setView("upload")}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" />
              Upload new
            </button>
          </div>

          {err && <p className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">{err}</p>}
          {msg && <p className="rounded-md bg-green-100 text-green-700 px-4 py-3 text-sm">{msg}</p>}

          <div className="space-y-3">
            {resumes.length > 0 ? (
              resumes.map((r) => (
                <div key={r.id} className="rounded-xl border bg-card p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-secondary">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{r.filename || "Untitled resume"}</p>
                        {r.active && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        uploaded {formatDate(r.created_at)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center cursor-pointer ${(busy !== null || r.active) ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => {
                        if (!busy && !r.active) {
                          setPrimaryResume(r.id);
                        }
                      }}
                    >
                      <div className="relative">
                        <div className={`w-10 h-5 rounded-full transition-colors ${
                          r.active ? "bg-primary" : "bg-gray-300"
                        }`}>
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            r.active ? "translate-x-5" : "translate-x-0"
                          }`} />
                        </div>
                      </div>
                    </div>
                    <Link
                      href="/dashboard"
                      className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed bg-background p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No resumes uploaded yet</p>
                <button
                  onClick={() => setView("upload")}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Upload your first resume
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function UploadView({ onBack, refresh, setBusy, busy }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [useAsPrimary, setUseAsPrimary] = useState(true);

  async function handleUpload() {
    setBusy("upload");
    try {
      await api.grantConsent();
      await api.uploadResume(file!);
      await refresh();
      onBack();
    } catch (e: any) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Upload your resume</h1>
        <p className="text-muted-foreground mt-1">
          PDF or DOCX, up to 5MB. We'll extract the text locally and parse it into a structured profile you can review.
        </p>
      </div>

      <div className="rounded-xl border border-dashed bg-background p-8 text-center">
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
          id="resume-upload"
        />
        <label htmlFor="resume-upload" className="cursor-pointer">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Upload className="h-6 w-6" />
          </div>
          <p className="font-medium">Drag & drop or click to select</p>
          <p className="text-xs text-muted-foreground mt-1">Accepted: pdf, docx</p>
        </label>
        {file && (
          <p className="mt-4 text-sm font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useAsPrimary}
            onChange={(e) => setUseAsPrimary(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium">Use as primary resume</span>
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          The primary resume is used for default match scoring and recommendations.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Tips for best results</span>
        </div>
        <ul className="text-xs text-muted-foreground ml-6 space-y-1 list-disc">
          <li>Use a text-based PDF (image-only PDFs cannot be parsed).</li>
          <li>Avoid columns, icons, and tables — they confuse ATS systems too.</li>
          <li>Include dates as <code className="bg-secondary px-1 rounded">Jan 2022 - Present</code> or <code className="bg-secondary px-1 rounded">2022-2024</code>.</li>
        </ul>
      </div>

      <button
        disabled={busy || !file}
        onClick={handleUpload}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload & parse"}
      </button>
    </div>
  );
}
