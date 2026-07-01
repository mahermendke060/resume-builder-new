"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTokens, setTokens, api } from "@/lib/api";
import { Settings, User, KeyRound, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyPassword, setBusyPassword] = useState(false);
  const [busyProfile, setBusyProfile] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!getTokens()) {
      router.replace("/login");
      return;
    }

    async function loadUser() {
      try {
        const user = await api.me();
        setName(user.name || "");
        setEmail(user.email || "");
      } catch (e: any) {
        if (e.status === 401) {
          setTokens(null);
          router.replace("/login");
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  function logout() {
    setTokens(null);
    router.replace("/login");
  }

  async function handleSaveProfile() {
    setBusyProfile(true);
    try {
      await api.updateProfile(name);
      setMessage({ text: "Profile saved successfully!", type: "success" });
      setTimeout(() => setMessage(null), 5000);
    } catch (e: any) {
      setMessage({ text: e.message || "Failed to save profile.", type: "error" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setBusyProfile(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setMessage({ text: "New passwords do not match.", type: "error" });
      return;
    }

    setBusyPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setMessage({ text: "Password changed successfully!", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setMessage(null), 5000);
    } catch (e: any) {
      setMessage({ text: e.message || "Failed to change password.", type: "error" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setBusyPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-md px-4 py-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-destructive/10 text-destructive"}`}>
          {message.text}
        </div>
      )}

      {/* Profile */}
      <div className="rounded-xl border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">PROFILE</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveProfile}
            disabled={busyProfile}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {busyProfile && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">CHANGE PASSWORD</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter your current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter your new password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Confirm your new password"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleChangePassword}
            disabled={busyPassword || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {busyPassword && <Loader2 className="h-4 w-4 animate-spin" />}
            {busyPassword ? "Changing..." : "Change password"}
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">ACCOUNT</h2>
        </div>

        <div className="flex justify-between items-center">
          <div>
          <p className="font-medium text-sm">Sign out</p>
          <p className="text-xs text-muted-foreground">Sign out of your current session.</p>
          </div>
          <button onClick={logout} className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
