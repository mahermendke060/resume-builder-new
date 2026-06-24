import Link from "next/link";
import {
  Cpu,
  FileCheck2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { APP_NAME } from "@/lib/utils/constants";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              href="/login?mode=register"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="container py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
            India&apos;s AI copilot for job applications
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            Upload your resume, paste any job description, and get an honest ATS score,
            a tailored resume, recruiter messages, and a cover letter — without
            inventing skills you don&apos;t have.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/login?mode=register"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="rounded-md border bg-background px-5 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              I already have one
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t bg-secondary/30">
        <div className="container py-16">
          <h2 className="mx-auto max-w-2xl text-center text-2xl font-semibold tracking-tight md:text-3xl">
            What it does for every application
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Feature
              icon={<Target className="h-5 w-5" />}
              title="Honest ATS match score"
              description="0–100 across required skills, keywords, experience, role fit and semantic similarity. Auditable, not a black box."
            />
            <Feature
              icon={<FileCheck2 className="h-5 w-5" />}
              title="ATS-friendly tailored resume"
              description="Reorders and rewrites using only what's already in your resume. Missing skills become learning gaps, not fake claims."
            />
            <Feature
              icon={<MessageSquareText className="h-5 w-5" />}
              title="Recruiter outreach pack"
              description="LinkedIn note (under 300 chars), recruiter DM, email, and a 250–300 word cover letter — India-friendly tone."
            />
            <Feature
              icon={<ShieldCheck className="h-5 w-5" />}
              title="No fabrication, ever"
              description="If the JD wants a skill you don't have, we mark it as a gap. We never inject claims your resume can't support."
            />
            <Feature
              icon={<Cpu className="h-5 w-5" />}
              title="Local & private by design"
              description="All AI runs on Ollama on your machine — qwen3 for reasoning, mxbai-embed-large for semantic search. Nothing is sent to OpenAI."
            />
            <Feature
              icon={<Sparkles className="h-5 w-5" />}
              title="Application tracker built-in"
              description="Saved → Applied → Recruiter Contacted → Interview → Offer. With auto match-score and resume version on every entry."
            />
          </div>
        </div>
      </section>

      <section className="container py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
          How it works
        </h2>
        <ol className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
          <Step
            n={1}
            title="Upload your resume"
            text="PDF or DOCX. We extract the text and parse it into a structured profile you can edit and approve."
          />
          <Step
            n={2}
            title="Paste a job description"
            text="Add company, title, link. The job is parsed into required skills, keywords, and seniority."
          />
          <Step
            n={3}
            title="Review and apply"
            text="See the score, fix the gaps, generate a tailored resume and outreach. You approve everything before it leaves the app."
          />
        </ol>
      </section>

      <footer className="border-t">
        <div className="container flex h-14 items-center justify-between text-xs text-muted-foreground">
          <span>{APP_NAME}</span>
          <span>Local-first · No data leaves your machine</span>
        </div>
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="rounded-xl border bg-card p-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {n}
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </li>
  );
}
