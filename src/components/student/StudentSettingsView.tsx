import React, { useState, useEffect } from "react";
import {
  Settings,
  Moon,
  Sun,
  Laptop,
  Bell,
  HardDrive,
  Trash2,
  RefreshCw,
  Info,
  Shield,
  HelpCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { studentPortalService } from "../../lib/studentPortalService";
import { formatBytes } from "../../utils/studentFormatters";

interface StudentSettingsViewProps {
  onRefresh?: () => void;
}

export const StudentSettingsView: React.FC<StudentSettingsViewProps> = ({ onRefresh }) => {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    return (localStorage.getItem("atlas_theme_pref") as any) || "system";
  });

  const [cacheStats, setCacheStats] = useState({ itemsCount: 0, sizeBytes: 0, lastSync: "" });
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheClearedMsg, setCacheClearedMsg] = useState(false);

  // Notification toggles
  const [notifPrefs, setNotifPrefs] = useState(() => {
    const saved = localStorage.getItem("atlas_notif_prefs");
    return saved
      ? JSON.parse(saved)
      : {
          homework: true,
          practiceTests: true,
          fees: true,
          attendance: true,
          announcements: true,
        };
  });

  useEffect(() => {
    setCacheStats(studentPortalService.getCacheStats());
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("atlas_theme_pref", newTheme);

    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
    } else if (newTheme === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const handleToggleNotif = (key: string) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    localStorage.setItem("atlas_notif_prefs", JSON.stringify(updated));
  };

  const handleClearCache = () => {
    setIsClearingCache(true);
    studentPortalService.clearOfflineCache();
    setTimeout(() => {
      setCacheStats(studentPortalService.getCacheStats());
      setIsClearingCache(false);
      setCacheClearedMsg(true);
      setTimeout(() => setCacheClearedMsg(false), 2500);
      if (onRefresh) onRefresh();
    }, 500);
  };

  return (
    <div id="student-settings-view" className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Portal Settings & Preferences
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Personalize theme appearance, notification alerts, and offline caching
        </p>
      </div>

      {/* 1. Theme Appearance */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Sun className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Appearance & Interface Theme
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            className={`p-4 rounded-2xl border text-center transition space-y-2 cursor-pointer ${
              theme === "light"
                ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
            }`}
          >
            <Sun className="w-6 h-6 mx-auto text-amber-500" />
            <div className="text-xs font-bold">Light Mode</div>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            className={`p-4 rounded-2xl border text-center transition space-y-2 cursor-pointer ${
              theme === "dark"
                ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
            }`}
          >
            <Moon className="w-6 h-6 mx-auto text-indigo-500" />
            <div className="text-xs font-bold">Dark Mode</div>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("system")}
            className={`p-4 rounded-2xl border text-center transition space-y-2 cursor-pointer ${
              theme === "system"
                ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
            }`}
          >
            <Laptop className="w-6 h-6 mx-auto text-slate-500" />
            <div className="text-xs font-bold">System Default</div>
          </button>
        </div>
      </div>

      {/* 2. Notification Preferences */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Notification Alerts
          </h2>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {[
            { id: "homework", label: "Homework Deadlines & Reminders", desc: "Receive alerts for due dates" },
            { id: "practiceTests", label: "Practice Tests & Results", desc: "New assessments released" },
            { id: "fees", label: "Fee Payment Notices", desc: "Monthly tuition updates" },
            { id: "attendance", label: "Attendance Activity Alerts", desc: "Daily participation logs" },
            { id: "announcements", label: "Tuition Announcements", desc: "General batch notifications" },
          ].map((item) => {
            const isEnabled = notifPrefs[item.id] !== false;
            return (
              <div key={item.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{item.label}</div>
                  <div className="text-slate-500 dark:text-slate-400">{item.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleNotif(item.id)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                    isEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Offline Cache Management */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <HardDrive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Offline Storage & Cache
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Atlas caches study materials, test metadata, and your profile locally for fast instant loading and offline review.
        </p>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs space-y-1">
            <div className="font-bold text-slate-900 dark:text-white">
              Cached Items: {cacheStats.itemsCount} records ({formatBytes(cacheStats.sizeBytes)})
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Synced with Cloudflare R2 & Firestore
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearCache}
            disabled={isClearingCache}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition border border-rose-200 dark:border-rose-900/40 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isClearingCache ? "Clearing..." : "Clear Cache"}</span>
          </button>
        </div>

        {cacheClearedMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Local cache purged successfully.</span>
          </div>
        )}
      </div>

      {/* 4. Application Info */}
      <div className="p-6 bg-slate-100 dark:bg-slate-800/60 rounded-3xl text-center space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Atlas 2.0 Student Portal
        </div>
        <div className="text-[11px] text-slate-500">
          Version 2.4.0 • Enterprise Tuition Platform • R2 Storage + Firebase Cloud
        </div>
        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold pt-1">
          Support & Assistance: support@atlas.edu
        </div>
      </div>
    </div>
  );
};
