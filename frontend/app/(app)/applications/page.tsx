"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, getTokens, setTokens } from "@/lib/api";
import type { JobOut, TailorRunDetail } from "@/lib/types";
import { ClipboardList, BriefcaseBusiness, Sparkles, Loader2 } from "lucide-react";

export default function ApplicationsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobOut[]>([]);
  const [tailorRuns, setTailorRuns] = useState<TailorRunDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getTokens()) {
      router.replace("/login");
      return;
    }

    async function loadData() {
      try {
        const [jobsData, runsData] = await Promise.all([
          api.listJobs(),
          api.listTailorRuns(),
        ]);
        setJobs(jobsData as JobOut[]);
        setTailorRuns(runsData as TailorRunDetail[]);
      } catch (e: any) {
        if (e.status === 401) {
          setTokens(null);
          router.replace("/login");
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  // Helper to get the latest score for a job
  const getJobScore = (jobId: string) => {
    const runsForJob = tailorRuns.filter((run) => run.job_id === jobId && run.scores.length > 0);
    if (runsForJob.length > 0) {
      const latestRun = runsForJob[runsForJob.length - 1];
      return Math.round(latestRun.scores[0].overall);
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate status counts (all are "Saved" for now since there's no status field in backend)
  const savedCount = jobs.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
        <p className="text-muted-foreground mt-1">
          Track all your job applications in one place.
        </p>
      </div>

      {/* Status Counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Saved", count: savedCount, color: "bg-gray-100 text-gray-700" },
          { label: "Ready to Apply", count: 0, color: "bg-blue-50 text-blue-700" },
          { label: "Applied", count: 0, color: "bg-blue-50 text-blue-700" },
          { label: "Recruiter Contacted", count: 0, color: "bg-purple-50 text-purple-700" },
          { label: "Interview", count: 0, color: "bg-yellow-50 text-yellow-700" },
          { label: "Rejected", count: 0, color: "bg-red-50 text-red-700" },
          { label: "Offer", count: 0, color: "bg-green-50 text-green-700" },
        ].map((item, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-semibold">{item.count}</p>
            <p className={`text-xs rounded-full px-2 py-0.5 mt-2 inline-block ${item.color}`}>
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {/* Applications List */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-tight">ALL APPLICATIONS</h2>
            </div>
            <Link
              href="/add-job"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Add job
            </Link>
          </div>
        </div>

        {jobs.length > 0 ? (
          <div className="divide-y">
            {jobs.map((job) => {
              const score = getJobScore(job.id);
              const scoreColor = score && score >= 70 ? "text-green-500" : score && score >= 50 ? "text-yellow-500" : "text-red-500";
              
              return (
                <div key={job.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-secondary">
                      <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{job.title || "Untitled job"}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                        {job.company && <span>{job.company}</span>}
                        {job.company && job.location && <span>·</span>}
                        {job.location && <span>{job.location}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {score !== null && (
                        <p className={`text-lg font-semibold ${scoreColor}`}>{score}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Saved</p>
                    </div>
                    <Link href={`/tailor?jobId=${job.id}`} className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-muted-foreground text-sm">
              No applications yet. Add a job to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
