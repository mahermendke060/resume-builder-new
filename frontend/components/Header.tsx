"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, User } from "lucide-react";
import { APP_NAME } from "@/lib/utils/constants";
import { getTokens, setTokens } from "@/lib/api";

export default function Header() {
  const router = useRouter();

  function logout() {
    setTokens(null);
    router.replace("/login");
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
              MM
            </div>
            <span className="text-sm font-medium hidden sm:block">Maherunnisa Jalaluddin Mendke</span>
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
