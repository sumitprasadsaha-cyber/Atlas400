import React, { useState } from "react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Award,
  Clock,
  CalendarCheck,
  IndianRupee,
  Megaphone,
  Sliders,
  ShieldCheck,
  History,
  HardDrive,
  Settings,
  Search,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronRight,
  Bell,
  RefreshCw,
  Plus
} from "lucide-react";
import { Student, ClassNote, StudentHomeworkItem } from "../../types";
import { AdminDashboardView } from "./AdminDashboardView";
import { AdminStudentsView } from "./AdminStudentsView";
import { AdminAcademicsView } from "./AdminAcademicsView";
import { AdminHomeworkManagementView } from "./AdminHomeworkManagementView";
import { AdminAttendanceManagementView } from "./AdminAttendanceManagementView";
import { AdminFeesManagementView } from "./AdminFeesManagementView";
import { AdminAnnouncementsView } from "./AdminAnnouncementsView";
import { AdminFeatureFlagsView } from "./AdminFeatureFlagsView";
import { AdminRolesView } from "./AdminRolesView";
import { AdminAuditLogsView } from "./AdminAuditLogsView";
import { AdminStorageManagerView } from "./AdminStorageManagerView";
import { AdminGlobalSearchModal } from "./AdminGlobalSearchModal";

interface AdminPortalLayoutProps {
  students: Student[];
  allNotes: ClassNote[];
  onSelectStudent: (studentId: string) => void;
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onUpdateStudentsList: (students: Student[]) => void;
  onToggleAttendance: (studentId: string, date: string, isPresent: boolean | "na") => void;
  onUploadNote: () => void;
  onOpenNotesManager?: () => void;
  onOpenTestsManager?: () => void;
  onOpenAvatarModal?: (student: Student) => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onRefreshData: () => Promise<void>;
  isRefreshing?: boolean;
}

export type AdminPortalTab =
  | "dashboard"
  | "students"
  | "academics"
  | "notes"
  | "tests"
  | "homework"
  | "attendance"
  | "fees"
  | "announcements"
  | "feature_flags"
  | "roles"
  | "audit_logs"
  | "storage"
  | "settings";

export const AdminPortalLayout: React.FC<AdminPortalLayoutProps> = ({
  students,
  allNotes,
  onSelectStudent,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onUpdateStudentsList,
  onToggleAttendance,
  onUploadNote,
  onOpenNotesManager,
  onOpenTestsManager,
  onOpenAvatarModal,
  onLogout,
  darkMode,
  onToggleDarkMode,
  onRefreshData,
  isRefreshing = false,
}) => {
  const [currentTab, setCurrentTab] = useState<AdminPortalTab>("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedStudentForFees, setSelectedStudentForFees] = useState<string | undefined>();

  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "students", label: "Students", icon: Users },
    { id: "academics", label: "Academics", icon: GraduationCap },
    { id: "notes", label: "Notes & R2", icon: BookOpen },
    { id: "tests", label: "Practice Tests", icon: Award },
    { id: "homework", label: "Homework", icon: Clock },
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "fees", label: "Fees & Ledger", icon: IndianRupee },
    { id: "announcements", label: "Announcements", icon: Megaphone },
    { id: "feature_flags", label: "Feature Flags", icon: Sliders },
    { id: "roles", label: "RBAC Roles", icon: ShieldCheck },
    { id: "audit_logs", label: "Audit Logs", icon: History },
    { id: "storage", label: "R2 Storage", icon: HardDrive },
  ];

  const handleNavigateTab = (tab: string, extraState?: any) => {
    setCurrentTab(tab as AdminPortalTab);
    setIsMobileSidebarOpen(false);
    if (tab === "fees" && extraState?.selectedStudentId) {
      setSelectedStudentForFees(extraState.selectedStudentId);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors">
      {/* Top Fixed Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand & Mobile Menu Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-md shadow-blue-600/30">
                A2
              </div>
              <div>
                <div className="font-black text-slate-900 dark:text-white text-base leading-tight tracking-tight flex items-center gap-1.5">
                  <span>Atlas 2.0</span>
                  <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold">
                    Admin
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                  Tuition OS
                </div>
              </div>
            </div>
          </div>

          {/* Center: Global Search Bar */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="hidden sm:flex items-center justify-between w-72 lg:w-96 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-400 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Search className="w-3.5 h-3.5" />
              <span>Search everything...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white dark:bg-slate-900 text-slate-500 rounded border border-slate-200 dark:border-slate-700">
              Ctrl+K
            </kbd>
          </button>

          {/* Right: Actions, Theme & User */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="sm:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center border border-blue-600/20">
                AD
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex gap-6">
        {/* Left Sidebar (Desktop) */}
        <aside className="hidden lg:block w-60 flex-shrink-0 space-y-1">
          <div className="sticky top-24 space-y-1">
            <div className="px-3 pb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Management Modules
            </div>

            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigateTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              onClick={() => setIsMobileSidebarOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
                <div className="font-black text-slate-900 dark:text-white text-base">
                  Atlas 2.0 Admin
                </div>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1 flex-1 overflow-y-auto">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigateTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-150 dark:border-slate-800">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of Admin</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Center Main Viewport */}
        <main className="flex-1 min-w-0">
          {currentTab === "dashboard" && (
            <AdminDashboardView
              students={students}
              allNotes={allNotes}
              onNavigateTab={handleNavigateTab}
              onQuickCreateStudent={onAddStudent}
              onQuickUploadNote={onUploadNote}
              onQuickCreateTest={() => {
                if (onOpenTestsManager) onOpenTestsManager();
                else handleNavigateTab("tests");
              }}
              onQuickCreateHomework={() => handleNavigateTab("homework")}
              onQuickSendAnnouncement={() => handleNavigateTab("announcements")}
              onRefresh={onRefreshData}
              isRefreshing={isRefreshing}
            />
          )}

          {currentTab === "students" && (
            <AdminStudentsView
              students={students}
              onSelectStudent={onSelectStudent}
              onAddStudent={onAddStudent}
              onEditStudent={onEditStudent}
              onDeleteStudent={onDeleteStudent}
              onUpdateStudentsList={onUpdateStudentsList}
              onOpenAvatarModal={onOpenAvatarModal}
            />
          )}

          {currentTab === "academics" && (
            <AdminAcademicsView
              students={students}
              allNotes={allNotes}
            />
          )}

          {currentTab === "notes" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <h1 className="text-xl font-black text-slate-900 dark:text-white">
                    Study Notes & Cloudflare R2 Materials
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Upload syllabus chapters, synchronize PDFs with Cloudflare R2, and assign student access
                  </p>
                </div>
                <button
                  onClick={onUploadNote}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload PDF Notes</span>
                </button>
              </div>

              {onOpenNotesManager && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={onOpenNotesManager}
                    className="w-full py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl hover:bg-indigo-100 transition-all cursor-pointer"
                  >
                    Open Full Notes Management Studio ({allNotes.length} Chapters Active)
                  </button>
                </div>
              )}
            </div>
          )}

          {currentTab === "tests" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <h1 className="text-xl font-black text-slate-900 dark:text-white">
                    Practice Test Series & Quiz Banks
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Create question papers, set duration & negative marks, publish quizzes, and review results
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (onOpenTestsManager) onOpenTestsManager();
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Practice Test</span>
                </button>
              </div>

              {onOpenTestsManager && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={onOpenTestsManager}
                    className="w-full py-4 text-sm font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 rounded-xl hover:bg-purple-100 transition-all cursor-pointer"
                  >
                    Launch Interactive Test Authoring Suite & Results Viewer
                  </button>
                </div>
              )}
            </div>
          )}

          {currentTab === "homework" && (
            <AdminHomeworkManagementView students={students} />
          )}

          {currentTab === "attendance" && (
            <AdminAttendanceManagementView
              students={students}
              onToggleAttendance={onToggleAttendance}
              onUpdateStudentsList={onUpdateStudentsList}
            />
          )}

          {currentTab === "fees" && (
            <AdminFeesManagementView
              students={students}
              onUpdateStudentsList={onUpdateStudentsList}
              initialSelectedStudentId={selectedStudentForFees}
            />
          )}

          {currentTab === "announcements" && (
            <AdminAnnouncementsView />
          )}

          {currentTab === "feature_flags" && (
            <AdminFeatureFlagsView />
          )}

          {currentTab === "roles" && (
            <AdminRolesView />
          )}

          {currentTab === "audit_logs" && (
            <AdminAuditLogsView />
          )}

          {currentTab === "storage" && (
            <AdminStorageManagerView allNotes={allNotes} />
          )}
        </main>
      </div>

      {/* Global Search Modal (Ctrl+K) */}
      <AdminGlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        students={students}
        allNotes={allNotes}
        onNavigateTab={handleNavigateTab}
        onSelectStudent={onSelectStudent}
      />
    </div>
  );
};
