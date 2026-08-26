import React, { useState, useEffect } from "react";
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sparkles,
  RefreshCw,
  Shield,
  Zap
} from "lucide-react";
import { StudentPortalFeatureFlags } from "../../types";
import { adminService } from "../../lib/adminService";

export const AdminFeatureFlagsView: React.FC = () => {
  const [flags, setFlags] = useState<StudentPortalFeatureFlags>({
    enableNotesTab: true,
    enablePracticeTests: true,
    enableHomeworkSubmissions: true,
    enableAttendanceView: true,
    enableFeeReceiptDownload: true,
    enableAnnouncementsBoard: true,
    enableLeaderboardRankings: true,
    enableAiTutorAssistant: true,
    enableProfilePhotoUploads: true,
    enableStudyTimer: true,
    enableNotes: true,
    enableHomework: true,
    enableAttendance: true,
    enableFeeStatus: true,
    enableNotifications: true,
    enableDashboard: true,
    enableAnalytics: true,
    enableProfile: true,
    maintenanceMode: false,
    maintenanceMessage: "Atlas 2.0 is undergoing scheduled maintenance. Please check back shortly.",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    const loadFlags = async () => {
      const current = await adminService.getFeatureFlags();
      if (active) setFlags(current);
    };
    loadFlags();
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = (key: keyof StudentPortalFeatureFlags) => {
    if (typeof flags[key] === "boolean") {
      setFlags((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await adminService.updateFeatureFlags(flags, "admin@atlas.tuition");
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const modules = [
    { key: "enableNotes" as const, title: "Notes & Study Material", desc: "Allow students to view and download Cloudflare R2 PDFs and syllabus notes" },
    { key: "enablePracticeTests" as const, title: "Practice Tests & Quizzes", desc: "Enable self-evaluation interactive test series with instant scoring" },
    { key: "enableHomework" as const, title: "Homework & Tasks", desc: "Display assigned exercises, submission upload portal, and tutor marks" },
    { key: "enableAttendance" as const, title: "Attendance History", desc: "Permit students and parents to inspect daily presence logs and rates" },
    { key: "enableFeeStatus" as const, title: "Fee Status & Receipts", desc: "Show monthly tuition dues, settlement receipts, and payment instructions" },
    { key: "enableNotifications" as const, title: "Alerts & Notifications", desc: "Deliver broadcast notices, reminders, and announcement alerts" },
    { key: "enableDashboard" as const, title: "Student Dashboard Overview", desc: "Show student home widgets, quick shortcuts, and performance summary" },
    { key: "enableAnalytics" as const, title: "Performance Analytics", desc: "Render progress trends, test score charts, and subject radar metrics" },
    { key: "enableProfile" as const, title: "Profile Management", desc: "Allow students to view profile information and update preferences" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-feature-flags-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Feature Flags & Maintenance Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Toggle portal modules in real-time or enable emergency maintenance mode across student portals
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/20"
        >
          {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          <span>{isSaving ? "Publishing Changes..." : "Save & Sync Flags"}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Feature flags updated and synchronized to Firestore successfully!</span>
        </div>
      )}

      {/* Emergency Maintenance Mode Banner */}
      <div className={`p-5 rounded-2xl border transition-all ${
        flags.maintenanceMode
          ? "bg-rose-50/80 border-rose-300 dark:bg-rose-950/30 dark:border-rose-800/80"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${flags.maintenanceMode ? "text-rose-600" : "text-slate-400"}`} />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Global Student Maintenance Mode
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              When activated, students will see a maintenance screen instead of their portal. Admins retain full access.
            </p>
          </div>

          <button
            onClick={() => handleToggle("maintenanceMode")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              flags.maintenanceMode
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            {flags.maintenanceMode ? "Maintenance ACTIVE" : "Maintenance Disabled"}
          </button>
        </div>

        {flags.maintenanceMode && (
          <div className="mt-4 pt-4 border-t border-rose-200 dark:border-rose-900/60">
            <label className="block text-[11px] font-bold text-rose-900 dark:text-rose-300 mb-1">
              Custom Maintenance Message Displayed to Students:
            </label>
            <input
              type="text"
              value={flags.maintenanceMessage || ""}
              onChange={(e) => setFlags({ ...flags, maintenanceMessage: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Module Toggles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const isEnabled = flags[mod.key] as boolean;
          return (
            <div
              key={mod.key}
              className={`p-5 bg-white dark:bg-slate-900 border rounded-2xl space-y-3 shadow-sm transition-all flex flex-col justify-between ${
                isEnabled
                  ? "border-slate-200 dark:border-slate-800"
                  : "border-slate-200/50 dark:border-slate-800/40 opacity-75 bg-slate-50/50 dark:bg-slate-900/40"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {mod.title}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isEnabled
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {isEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {mod.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Student Portal Access</span>
                <button
                  onClick={() => handleToggle(mod.key)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    isEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      isEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
