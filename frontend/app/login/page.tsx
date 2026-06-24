"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, setTokens, API_URL } from "@/lib/api";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/utils/constants";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    console.log("API URL:", API_URL);
  }, []);
  const [mode, setMode] = useState<"login" | "register">(() => {
    const modeParam = searchParams.get("mode");
    return modeParam === "register" ? "register" : "login";
  });

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "register") {
      setMode("register");
    }
  }, [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      console.log("Attempting to submit to", API_URL);
      if (mode === "register") {
        await api.register(email, password, name || undefined);
      }
      const tokens = await api.login(email, password);
      console.log("Login successful", tokens);
      setTokens(tokens);
      router.replace("/dashboard");
    } catch (err: any) {
      console.error("Login error", err);
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-lg">{APP_NAME}</span>
          </Link>
        </div>

        <div className="border rounded-xl bg-card p-6">
          <h1 className="text-2xl font-semibold">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {mode === "login"
              ? "Log in to continue to your dashboard."
              : "Local-first. Your resume stays on your machine."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Aanya Sharma"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {mode === "register" && (
                <p className="text-xs text-muted-foreground mt-1">
                  At least 8 characters with a letter and a number.
                </p>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="pt-2">
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy
                  ? "Please wait…"
                  : mode === "login"
                  ? "Log in"
                  : "Create account"}
              </button>
            </div>
          </form>

          <div className="text-center mt-6 text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="text-primary font-medium hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-primary font-medium hover:underline"
                >
                  Log in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
