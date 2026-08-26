import React, { useMemo } from "react";
import {
  BookOpen,
  CalendarCheck,
  Award,
  CreditCard,
  Bell,
  Clock,
  ArrowRight,
  TrendingUp,
  Flame,
  CheckCircle2,
  AlertCircle,
  FileText,
  Play,
  Download,
  ExternalLink,
  ChevronRight,
  Layers,
  Sparkles,
  UserCheck,
  Zap,
} from "lucide-react";
import { Student, ClassNote } from "../../types";
import { StudentHomeworkItem, StudentNotification } from "../../lib/studentPortalService";
import { PracticeTest } from "../../../shared/types/practice-tests.types";
import { formatDisplayDate, formatCurrency } from "../../utils/studentFormatters";

interface StudentDashboardViewProps {
  student: Student;
  allNotes: ClassNote[];
  homework: StudentHomeworkItem[];
  notifications: StudentNotification[];
  practiceTests: PracticeTest[];
  onNavigateToTab: (tabKey: string, payload?: any) => void;
  onOpenStudyTimer?: () => void;
  onOpenAvatarModal?: () => void;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  student,
  allNotes,
  homework,
  notifications,
  practiceTests,
  onNavigateToTab,
  onOpenStudyTimer,
  onOpenAvatarModal,
}) => {
  // Attendance calculations
  const attendanceStats = useMemo(() => {
    if (!student.attendance) return { present: 0, absent: 0, total: 0, percentage: 100, streak: 0 };
    const entries = Object.entries(student.attendance).filter(([_, val]) => val !== "na");
    const total = entries.length;
    if (total === 0) return { present: 0, absent: 0, total: 0, percentage: 100, streak: 0 };

    const present = entries.filter(([_, val]) => val === true).length;
    const absent = total - present;
    const percentage = Math.round((present / total) * 100);

    // Calculate streak
    const sortedDates = Object.keys(student.attendance).sort().reverse();
    let streak = 0;
    for (const d of sortedDates) {
      if (student.attendance[d] === true) {
        streak++;
      } else if (student.attendance[d] === false) {
        break;
      }
    }

    return { present, absent, total, percentage, streak };
  }, [student.attendance]);

  // Homework calculations
  const pendingHomework = useMemo(() => {
    return homework.filter((h) => h.status === "pending");
  }, [homework]);

  // Fee calculation for current month
  const feeStatus = useMemo(() => {
    const currentMonthYear = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const feeMonthStatus = student.feeMonths?.[currentMonthYear] || (student.feePaidThisMonth ? "paid" : "unpaid");
    const isPaid = feeMonthStatus === "paid";
    return {
      month: currentMonthYear,
      isPaid,
      monthlyFee: student.monthlyFee || 0,
      statusLabel: isPaid ? "Paid Up to Date" : "Pending Payment",
    };
  }, [student.feeMonths, student.feePaidThisMonth, student.monthlyFee]);

  // Enrolled subject notes
  const studentNotes = useMemo(() => {
    const enrolledSet = new Set((student.enrolledSubjects || []).map((s) => s.toLowerCase().trim()));
    return allNotes
      .filter((n) => {
        if (!n.classGrade || n.classGrade === student.classGrade || n.classGrade === "all") {
          if (enrolledSet.size === 0) return true;
          return enrolledSet.has(n.subject.toLowerCase().trim());
        }
        return false;
      })
      .slice(0, 4);
  }, [allNotes, student.classGrade, student.enrolledSubjects]);

  // Unread notifications count
  const unreadNotifs = useMemo(() => {
    return notifications.filter((n) => !n.read);
  }, [notifications]);

  // Today's greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  return (
    <div id="student-dashboard-view" className="space-y-6 max-w-7xl mx-auto pb-6">
      {/* 1. HERO WELCOME BANNER */}
      <div
        id="student-hero-banner"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-800/40"
      >
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center space-x-4 sm:space-x-5">
            <div
              onClick={onOpenAvatarModal}
              className="relative group cursor-pointer shrink-0"
              title="Click to update avatar photo"
            >
              {student.avatarUrl ? (
                <img
                  src={student.avatarUrl}
                  alt={student.name}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg group-hover:scale-105 transition duration-200"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-400 flex items-center justify-center text-white text-xl sm:text-2xl font-black border-2 border-white/20 shadow-lg group-hover:scale-105 transition duration-200">
                  {student.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-slate-900 shadow">
                ONLINE
              </span>
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
                  {greeting},
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-indigo-200 border border-white/10">
                  {student.classGrade || "Student"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white truncate">
                {student.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-indigo-200/80">
                <span>Roll: {student.rollNo || student.id.slice(-5)}</span>
                <span>•</span>
                <span>Enrolled: {student.enrolledSubjects?.length || 0} Subjects</span>
                {attendanceStats.streak > 1 && (
                  <span className="inline-flex items-center space-x-1 text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full text-[11px] border border-amber-500/30">
                    <Flame className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{attendanceStats.streak} Day Streak</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions in Hero */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenStudyTimer && (
              <button
                id="hero-study-timer-btn"
                onClick={onOpenStudyTimer}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/15 backdrop-blur-sm cursor-pointer shadow-sm active:scale-95"
              >
                <Clock className="w-4 h-4 text-indigo-300" />
                <span>Study Timer</span>
              </button>
            )}
            <button
              id="hero-browse-notes-btn"
              onClick={() => onNavigateToTab("notes")}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition shadow-md cursor-pointer active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
              <span>Browse Notes</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. REAL-TIME METRIC CARDS GRID */}
      <div id="student-metrics-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Attendance Card */}
        <div
          id="metric-card-attendance"
          onClick={() => onNavigateToTab("attendance")}
          className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition cursor-pointer flex flex-col justify-between group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Attendance
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {attendanceStats.percentage}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                ({attendanceStats.present}/{attendanceStats.total} days)
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  attendanceStats.percentage >= 85
                    ? "bg-emerald-500"
                    : attendanceStats.percentage >= 75
                    ? "bg-blue-500"
                    : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, attendanceStats.percentage)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <span>View Calendar</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Pending Homework Card */}
        <div
          id="metric-card-homework"
          onClick={() => onNavigateToTab("homework")}
          className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition cursor-pointer flex flex-col justify-between group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Homework
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-900/50">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {pendingHomework.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                pending tasks
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
              {pendingHomework.length > 0
                ? `Next due: ${formatDisplayDate(pendingHomework[0].dueDate)}`
                : "All assignments completed!"}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <span>Submit Tasks</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Practice Tests Card */}
        <div
          id="metric-card-practice-tests"
          onClick={() => onNavigateToTab("practice-tests")}
          className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition cursor-pointer flex flex-col justify-between group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Practice Tests
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-100 dark:border-purple-900/50">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {practiceTests.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                active tests
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
              R2 question bank ready
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <span>Start Practice</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Fee Status Card */}
        <div
          id="metric-card-fees"
          onClick={() => onNavigateToTab("fees")}
          className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-teal-300 dark:hover:border-teal-700 transition cursor-pointer flex flex-col justify-between group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Fee Status
            </span>
            <div className="p-2 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-xl border border-teal-100 dark:border-teal-900/50">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span
                className={`text-lg sm:text-xl font-extrabold ${
                  feeStatus.isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {feeStatus.statusLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
              {feeStatus.isPaid ? "Month cleared" : `${formatCurrency(feeStatus.monthlyFee)} due`}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-teal-600 dark:text-teal-400 group-hover:translate-x-0.5 transition pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <span>View Ledger</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 3. MAIN DASHBOARD CONTENT (2 COLUMN LAYOUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Latest Study Notes & Practice Tests */}
        <div className="lg:col-span-2 space-y-6">
          {/* Latest Notes Section */}
          <div
            id="dashboard-latest-notes-card"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Latest Study Notes
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Uploaded materials for your enrolled subjects
                  </p>
                </div>
              </div>
              <button
                id="view-all-notes-link-btn"
                onClick={() => onNavigateToTab("notes")}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center space-x-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {studentNotes.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 text-xs">
                No new notes uploaded yet for your batch.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {studentNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => onNavigateToTab("notes", { selectedSubject: note.subject })}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/20 transition cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 truncate max-w-[120px]">
                        {note.subject}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDisplayDate(note.createdAt || note.uploadedAt)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-1">
                        {note.chapterName || `Chapter ${note.chapterNo}`}
                      </h4>
                      {note.topicName && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          Topic: {note.topicName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 pt-1">
                      <span>Open Note</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Practice Tests Strip */}
          <div
            id="dashboard-practice-tests-card"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Available Practice Tests
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Timed assessments with instant evaluation
                  </p>
                </div>
              </div>
              <button
                id="view-all-tests-link-btn"
                onClick={() => onNavigateToTab("practice-tests")}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center space-x-1"
              >
                <span>View All Tests</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {practiceTests.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 text-xs">
                No active practice tests currently scheduled.
              </div>
            ) : (
              <div className="space-y-2.5">
                {practiceTests.slice(0, 3).map((test) => (
                  <div
                    key={test.id}
                    onClick={() => onNavigateToTab("practice-tests", { testId: test.id })}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded-xl hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/20 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div className="space-y-1 min-w-0 pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 truncate max-w-[100px]">
                          {test.subject}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {test.duration} mins
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {test.title}
                      </h4>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 inline-flex items-center space-x-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>Take Test</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Broadcast Alerts & Upcoming Homework */}
        <div className="space-y-6">
          {/* Broadcasts & Notifications */}
          <div
            id="dashboard-notifications-card"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-lg">
                  <Bell className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Announcements
                </h3>
              </div>
              {unreadNotifs.length > 0 && (
                <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-extrabold rounded-full animate-pulse">
                  {unreadNotifs.length} new
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                No recent announcements.
              </p>
            ) : (
              <div className="space-y-2.5">
                {notifications.slice(0, 3).map((n) => (
                  <div
                    key={n.id}
                    onClick={() => onNavigateToTab("notifications")}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                      !n.read
                        ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                      <span className="truncate max-w-[150px]">{n.title}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {formatDisplayDate(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">
                      {n.body}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => onNavigateToTab("notifications")}
              className="w-full py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              View Notification Center
            </button>
          </div>

          {/* Quick Enrolled Subjects Palette */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Enrolled Curriculum
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(student.enrolledSubjects || []).map((sub) => (
                <span
                  key={sub}
                  onClick={() => onNavigateToTab("notes", { selectedSubject: sub })}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                >
                  {sub}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
