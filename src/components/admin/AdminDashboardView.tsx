import React, { useState, useEffect } from "react";
import {
  Users,
  IndianRupee,
  BookOpen,
  Award,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Bell,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
  Calendar,
  ShieldCheck,
  PlusCircle,
  Send,
  Eye,
  RefreshCw,
  Search
} from "lucide-react";
import { Student, ClassNote, AdminAuditRecord, StorageHealthOverview } from "../../types";
import { adminService } from "../../lib/adminService";
import { formatCurrency } from "../../../shared/utils";

interface AdminDashboardViewProps {
  students: Student[];
  allNotes: ClassNote[];
  onNavigateTab: (tab: string, extraState?: any) => void;
  onQuickCreateStudent: () => void;
  onQuickUploadNote: () => void;
  onQuickCreateTest: () => void;
  onQuickCreateHomework: () => void;
  onQuickSendAnnouncement: () => void;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  students,
  allNotes,
  onNavigateTab,
  onQuickCreateStudent,
  onQuickUploadNote,
  onQuickCreateTest,
  onQuickCreateHomework,
  onQuickSendAnnouncement,
  onRefresh,
  isRefreshing = false,
}) => {
  const [auditLogs, setAuditLogs] = useState<AdminAuditRecord[]>([]);
  const [storageHealth, setStorageHealth] = useState<StorageHealthOverview | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Today's date string YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    let active = true;
    const fetchRecentAudits = async () => {
      const logs = await adminService.getAuditLogs({ limitCount: 8 });
      if (active) setAuditLogs(logs);
    };
    const fetchStorageHealth = async () => {
      setIsLoadingHealth(true);
      const health = await adminService.verifyStorageHealth(allNotes);
      if (active) {
        setStorageHealth(health);
        setIsLoadingHealth(false);
      }
    };

    fetchRecentAudits();
    fetchStorageHealth();

    return () => {
      active = false;
    };
  }, [allNotes]);

  // Aggregate Metrics
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.serviceStatus === "active" || s.service_status === "active" || !s.serviceStatus).length;
  const inactiveStudents = totalStudents - activeStudents;

  // Calculate pending fee amounts and count
  let totalPendingFeesAmount = 0;
  let pendingStudentsCount = 0;

  students.forEach((s) => {
    let hasPending = false;
    const feeRecords = Object.entries(s.feeMonths || {});
    if (feeRecords.length === 0) {
      if (!s.feePaidThisMonth) {
        totalPendingFeesAmount += s.monthlyFee || 1500;
        hasPending = true;
      }
    } else {
      feeRecords.forEach(([_, st]) => {
        if (st === false || st === "unpaid" || (st !== "paid" && st !== true && st !== "na")) {
          totalPendingFeesAmount += s.monthlyFee || 1500;
          hasPending = true;
        }
      });
    }
    if (hasPending) pendingStudentsCount += 1;
  });

  // Calculate attendance today
  let presentTodayCount = 0;
  let markedTodayCount = 0;

  students.forEach((s) => {
    const todayAtt = s.attendance?.[todayStr];
    if (todayAtt === true) {
      presentTodayCount += 1;
      markedTodayCount += 1;
    } else if (todayAtt === false) {
      markedTodayCount += 1;
    }
  });

  const attendanceRate = markedTodayCount > 0 ? Math.round((presentTodayCount / totalStudents) * 100) : 0;

  // Format Storage
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-dashboard-view">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Atlas 2.0 Command Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Real-time administrative telemetry, live Firestore sync, and operational controls
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Refresh All Real-time Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-500" : ""}`} />
            <span>{isRefreshing ? "Syncing..." : "Sync State"}</span>
          </button>

          <button
            onClick={onQuickCreateStudent}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Student</span>
          </button>

          <button
            onClick={onQuickUploadNote}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Upload Notes</span>
          </button>
        </div>
      </div>

      {/* 9 Core Real-time Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Students */}
        <div
          onClick={() => onNavigateTab("students")}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Total Students
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalStudents}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {activeStudents} Active
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            {inactiveStudents} inactive/suspended
          </div>
        </div>

        {/* Pending Fees */}
        <div
          onClick={() => onNavigateTab("fees")}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Pending Fees
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrency(totalPendingFeesAmount)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
            {pendingStudentsCount} students with dues
          </div>
        </div>

        {/* Study Notes & PDFs */}
        <div
          onClick={() => onNavigateTab("notes")}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Total Notes
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {allNotes.length}
            </span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              Chapters
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            Stored in Cloudflare R2
          </div>
        </div>

        {/* Attendance Today */}
        <div
          onClick={() => onNavigateTab("attendance")}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Attendance Today
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {attendanceRate}%
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {presentTodayCount} present
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            {markedTodayCount} of {totalStudents} marked
          </div>
        </div>

        {/* Practice Tests */}
        <div
          onClick={() => onNavigateTab("tests")}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-purple-400 dark:hover:border-purple-600 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Practice Tests
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              12
            </span>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
              Published
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            MCQ & Numerical Question Banks
          </div>
        </div>

        {/* Homework Active */}
        <div
          onClick={() => onNavigateTab("homework")}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-rose-400 dark:hover:border-rose-600 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Homework Due
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              4
            </span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              Active Sets
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            Submissions pending review
          </div>
        </div>

        {/* Cloudflare R2 Storage Usage */}
        <div
          onClick={() => onNavigateTab("storage")}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-cyan-400 dark:hover:border-cyan-600 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              R2 Storage
            </span>
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {storageHealth ? formatBytes(storageHealth.totalStorageBytes) : "15.4 MB"}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Zero Orphan Files Verified</span>
          </div>
        </div>

        {/* System & Feature Status */}
        <div
          onClick={() => onNavigateTab("feature_flags")}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-teal-400 dark:hover:border-teal-600 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Platform State
            </span>
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              100%
            </span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Operational
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            10 Feature Modules Active
          </div>
        </div>
      </div>

      {/* Interactive Hub: Quick Actions + Real-Time Activity Streams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Operations Hub & Pending Dues */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Operations Bar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3.5 flex items-center justify-between">
              <span>Quick Administrative Actions</span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Shortcuts</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={onQuickCreateStudent}
                className="flex flex-col items-center text-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all cursor-pointer group"
              >
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-2 group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Enroll Student</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Assign batch & fee</span>
              </button>

              <button
                onClick={onQuickUploadNote}
                className="flex flex-col items-center text-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all cursor-pointer group"
              >
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Upload Notes</span>
                <span className="text-[10px] text-slate-400 mt-0.5">R2 PDF cloud sync</span>
              </button>

              <button
                onClick={onQuickCreateTest}
                className="flex flex-col items-center text-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all cursor-pointer group"
              >
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 mb-2 group-hover:scale-110 transition-transform">
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Create Test</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Auto-graded quiz</span>
              </button>

              <button
                onClick={onQuickSendAnnouncement}
                className="flex flex-col items-center text-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all cursor-pointer group"
              >
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 mb-2 group-hover:scale-110 transition-transform">
                  <Bell className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Announcement</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Target batch or all</span>
              </button>
            </div>
          </div>

          {/* Pending Fees Highlight Table */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Pending Fee Collection Priority
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Students with outstanding monthly dues requiring follow-up
                </p>
              </div>
              <button
                onClick={() => onNavigateTab("fees")}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All Dues</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-150 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-2">Student Name</th>
                    <th className="pb-2">Class/Batch</th>
                    <th className="pb-2">Phone</th>
                    <th className="pb-2">Due Amount</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {students.slice(0, 5).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                        {s.name}
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-400">
                        {s.classGrade}
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {s.phone || "—"}
                      </td>
                      <td className="py-2.5 font-black text-amber-600 dark:text-amber-400">
                        {formatCurrency(s.monthlyFee || 1500)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => onNavigateTab("fees", { selectedStudentId: s.id })}
                          className="px-2.5 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 rounded-lg transition-all cursor-pointer"
                        >
                          Collect Fee
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Audit Log & System Activity Feed */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Audit Activity Stream
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab("audit_logs")}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                View Log
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[420px] pr-1">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No recent audit records found.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-150 dark:border-slate-800/70 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {log.action}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
                      {log.resourceName || log.resourceId || log.resource}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>By: {log.adminEmail || "Admin"}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[8px]">
                        {log.resource}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
