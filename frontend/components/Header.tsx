"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Sparkles, User, Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/utils/constants";
import { getTokens, setTokens, api } from "@/lib/api";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getTokens()) {
      router.replace("/login");
      return;
    }

    async function fetchUser() {
      try {
        const userData = await api.me();
        setUser(userData);
      } catch (e: any) {
        if (e.status === 401) {
          setTokens(null);
          router.replace("/login");
        }
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  function logout() {
    setTokens(null);
    router.replace("/login");
  }

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";
  const displayName = user?.name || user?.email || "User";

  if (loading) {
    return (
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between h-16 px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold md:hidden">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>{APP_NAME}</span>
          </Link>
          
          <div className="flex items-center gap-4 ml-auto">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b bg-background sticky top-0 z-10">
      <div className="flex items-center justify-between h-16 px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold md:hidden">
          <Sparkles className="h-5 w-5 text-primary" />
          <span>{APP_NAME}</span>
        </Link>
        
        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
              {initials}
            </div>
            <span className="text-sm font-medium hidden sm:block">{displayName}</span>
          </div>
          <button
            onClick={logout}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
