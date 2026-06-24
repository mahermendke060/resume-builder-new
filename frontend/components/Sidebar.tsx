"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, FileText, BriefcaseBusiness, ClipboardList, Settings, History, ChevronLeft, ChevronRight, User, Sun, Moon } from "lucide-react";
import { APP_NAME } from "@/lib/utils/constants";
import { api, getTokens } from "@/lib/api";
import { useTheme } from "./ThemeProvider";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <Sparkles className="h-5 w-5" />
  },
  {
    label: "Resume",
    href: "/resume",
    icon: <FileText className="h-5 w-5" />
  },
  {
    label: "Jobs",
    href: "/add-job",
    icon: <BriefcaseBusiness className="h-5 w-5" />
  },
  {
    label: "Tailor Resume",
    href: "/tailor",
    icon: <Sparkles className="h-5 w-5" />
  },
  {
    label: "History",
    href: "/history",
    icon: <History className="h-5 w-5" />
  },
  {
    label: "Applications",
    href: "/applications",
    icon: <ClipboardList className="h-5 w-5" />
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Settings className="h-5 w-5" />
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    async function fetchUser() {
      if (getTokens()) {
        try {
          const userData = await api.me();
          setUser(userData);
        } catch (e) {
          console.error("Failed to fetch user:", e);
        }
      }
    }
    fetchUser();
  }, []);

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  return (
    <aside className={`border-r bg-background h-screen sticky top-0 hidden md:flex flex-col transition-all duration-300 ${collapsed ? "w-20" : "w-64"}`}>
      <div className="p-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          <Sparkles className="h-6 w-6 text-primary" />
          {!collapsed && <span className="text-lg">{APP_NAME}</span>}
        </Link>
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md hover:bg-secondary transition-colors"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : ""}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }
                ${collapsed ? "justify-center" : ""}
              `}
            >
              {item.icon}
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-md hover:bg-secondary transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold">
              {initials}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.name || user?.email || "User"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-md hover:bg-secondary transition-colors shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
