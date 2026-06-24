"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTokens, setTokens } from "@/lib/api";
import { ClipboardList, BriefcaseBusiness, Sparkles } from "lucide-react";

export default function ApplicationsPage() {
  const router = useRouter();

  function logout() {
    setTokens(null);
    router.replace("/login");
  }

  // Mock data
  const applications = [
    {
      id: 1,
      title: "Data Scientist",
      company: "Wisemork",
      status: "Saved",
      score: 14,
      date: "2026-06-20"
    },
    {
      id: 2,
      title: "Data Analyst / ML Engineer",
      company: "v4c.ai",
      location: "Bengaluru",
      status: "Ready to Apply",
      score: 25,
      date: "2026-06-18"
    },
  ];

  const statusCounts = {
    Saved: 2,
    ReadyToApply: 1,
    Applied: 0,
    RecruiterContacted: 0,
    Interview: 0,
    Rejected: 0,
    Offer: 0
  };

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
          { label: "Saved", count: statusCounts.Saved, color: "bg-gray-100 text-gray-700" },
          { label: "Ready to Apply", count: statusCounts.ReadyToApply, color: "bg-blue-50 text-blue-700" },
          { label: "Applied", count: statusCounts.Applied, color: "bg-blue-50 text-blue-700" },
          { label: "Recruiter Contacted", count: statusCounts.RecruiterContacted, color: "bg-purple-50 text-purple-700" },
          { label: "Interview", count: statusCounts.Interview, color: "bg-yellow-50 text-yellow-700" },
          { label: "Rejected", count: statusCounts.Rejected, color: "bg-red-50 text-red-700" },
          { label: "Offer", count: statusCounts.Offer, color: "bg-green-50 text-green-700" },
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

        {applications.length > 0 ? (
          <div className="divide-y">
            {applications.map((app) => (
              <div key={app.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-secondary">
                    <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{app.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                      {app.company && <span>{app.company}</span>}
                      {app.company && app.location && <span>·</span>}
                      {app.location && <span>{app.location}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-semibold text-red-500">{app.score}</p>
                    <p className="text-xs text-muted-foreground">{app.status}</p>
                  </div>
                  <button className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                    View
                  </button>
                </div>
              </div>
            ))}
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
