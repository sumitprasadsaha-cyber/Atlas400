import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Award,
  FileText,
  CalendarCheck,
  CreditCard,
  Bell,
  User,
  Settings,
  Search,
  Clock,
  LogOut,
  WifiOff,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  RefreshCw,
} from "lucide-react";
import { Student, ClassNote } from "../../types";
import { PracticeTest } from "../../../shared/types/practice-tests.types";
import {
  studentPortalService,
  StudentHomeworkItem,
  StudentNotification,
  StudentPortalFeatureFlags,
  PortalMaintenanceConfig,
} from "../../lib/studentPortalService";
import { StudentDashboardView } from "./StudentDashboardView";
import { StudentNotesView } from "./StudentNotesView";
import { StudentPracticeTestsView } from "./StudentPracticeTestsView";
import { StudentHomeworkView } from "./StudentHomeworkView";
import { StudentAttendanceView } from "./StudentAttendanceView";
import { StudentFeesView } from "./StudentFeesView";
import { StudentNotificationsView } from "./StudentNotificationsView";
import { StudentProfileView } from "./StudentProfileView";
import { StudentSettingsView } from "./StudentSettingsView";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { MaintenanceModeView } from "./MaintenanceModeView";
import StudyTimerModal from "../StudyTimerModal";
import ProfilePictureModal from "../ProfilePictureModal";

interface StudentPortalLayoutProps {
  student: Student;
  allNotes: ClassNote[];
  allPracticeTests: PracticeTest[];
  onLogout: () => void;
  onUpdateStudentAvatar?: (avatarUrl: string) => Promise<void>;
  onRefreshData?: () => void;
}

export const StudentPortalLayout: React.FC<StudentPortalLayoutProps> = ({
  student,
  allNotes,
  allPracticeTests,
  onLogout,
  onUpdateStudentAvatar,
  onRefreshData,
}) => {
  // Active Tab state
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [tabPayload, setTabPayload] = useState<any>(null);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  // Feature Flags & Maintenance
  const [featureFlags, setFeatureFlags] = useState<StudentPortalFeatureFlags>({
    dashboard: true,
    notes: true,
    practice_tests: true,
    homework: true,
    attendance: true,
    fees: true,
    notifications: true,
    profile: true,
    settings: true,
    study_timer: true,
    global_search: true,
  });

  const [maintenanceConfig, setMaintenanceConfig] = useState<PortalMaintenanceConfig>({
    isMaintenanceMode: false,
  });

  // Homework & Notifications Data
  const [homeworkList, setHomeworkList] = useState<StudentHomeworkItem[]>([]);
  const [notificationsList, setNotificationsList] = useState<StudentNotification[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Subscriptions for Feature Flags & Maintenance
  useEffect(() => {
    const unsubFlags = studentPortalService.subscribeToFeatureFlags((flags) => {
      setFeatureFlags(flags);
    });

    const unsubMaint = studentPortalService.subscribeToMaintenanceConfig((maint) => {
      setMaintenanceConfig(maint);
    });

    return () => {
      unsubFlags();
      unsubMaint();
    };
  }, []);

  // Realtime Subscriptions for Homework & Notifications
  useEffect(() => {
    const unsubHw = studentPortalService.subscribeToStudentHomework(
      student.id,
      student.classGrade,
      (items) => {
        setHomeworkList(items);
      }
    );

    const unsubNotifs = studentPortalService.subscribeToStudentNotifications(
      student.id,
      student.classGrade,
      (items) => {
        setNotificationsList(items);
      }
    );

    return () => {
      unsubHw();
      unsubNotifs();
    };
  }, [student.id, student.classGrade]);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Global Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Counts for Badges
  const pendingHomeworkCount = useMemo(() => {
    return homeworkList.filter((h) => h.status === "pending").length;
  }, [homeworkList]);

  const unreadNotifCount = useMemo(() => {
    return notificationsList.filter((n) => !n.read).length;
  }, [notificationsList]);

  // Navigation Items with Feature Flag Filtering
  const navItems = useMemo(() => {
    const items = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: featureFlags.dashboard },
      { id: "notes", label: "Notes", icon: BookOpen, enabled: featureFlags.notes },
      { id: "practice-tests", label: "Practice Tests", icon: Award, badge: allPracticeTests.length, enabled: featureFlags.practice_tests },
      { id: "homework", label: "Homework", icon: FileText, badge: pendingHomeworkCount, enabled: featureFlags.homework },
      { id: "attendance", label: "Attendance", icon: CalendarCheck, enabled: featureFlags.attendance },
      { id: "fees", label: "Fees", icon: CreditCard, enabled: featureFlags.fees },
      { id: "notifications", label: "Notifications", icon: Bell, badge: unreadNotifCount, enabled: featureFlags.notifications },
      { id: "profile", label: "Profile", icon: User, enabled: featureFlags.profile },
      { id: "settings", label: "Settings", icon: Settings, enabled: featureFlags.settings },
    ];
    return items.filter((item) => item.enabled !== false);
  }, [featureFlags, allPracticeTests.length, pendingHomeworkCount, unreadNotifCount]);

  // Handle Tab Switch
  const handleNavigateToTab = (tabKey: string, payload?: any) => {
    setActiveTab(tabKey);
    setTabPayload(payload || null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // If maintenance mode is active for students
  if (maintenanceConfig.isMaintenanceMode && (!maintenanceConfig.affectedRoles || maintenanceConfig.affectedRoles.includes("student"))) {
    return (
      <MaintenanceModeView
        config={maintenanceConfig}
        onRetry={() => {
          if (onRefreshData) onRefreshData();
          studentPortalService.getMaintenanceConfig().then(setMaintenanceConfig);
        }}
        onLogout={onLogout}
      />
    );
  }

  return (
    <div id="student-portal-root" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors">
      {/* 1. FLOATING OFFLINE NOTIFICATION */}
      {!isOnline && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center space-x-2 animate-bounce">
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode: Using cached study notes and profile</span>
        </div>
      )}

      {/* 2. DESKTOP SIDEBAR NAVIGATION */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 space-y-6 sticky top-0 h-screen overflow-y-auto">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3 px-2 pt-2">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center space-x-1.5">
              <span>Atlas</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-md">
                2.0
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-semibold">Student Workspace</div>
          </div>
        </div>

        {/* Global Search Button */}
        {featureFlags.global_search !== false && (
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer shadow-xs"
          >
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4" />
              <span>Search portal...</span>
            </div>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-400">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Navigation Items List */}
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigateToTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Mini Profile & Logout */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-2.5 min-w-0">
              {student.avatarUrl ? (
                <img
                  src={student.avatarUrl}
                  alt={student.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                  {student.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {student.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {student.classGrade || "Student"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 3. MAIN PORTAL CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top App Bar (Mobile & Tablet) */}
        <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900 dark:text-white">Atlas 2.0</div>
              <div className="text-[10px] text-slate-400">{student.name}</div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {featureFlags.global_search !== false && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-slate-500 hover:text-indigo-600 rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
            {featureFlags.study_timer !== false && (
              <button
                onClick={() => setIsTimerOpen(true)}
                className="p-2 text-slate-500 hover:text-indigo-600 rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                <Clock className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-rose-600 rounded-xl bg-slate-100 dark:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Tab Content Router */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
          {activeTab === "dashboard" && (
            <StudentDashboardView
              student={student}
              allNotes={allNotes}
              homework={homeworkList}
              notifications={notificationsList}
              practiceTests={allPracticeTests}
              onNavigateToTab={handleNavigateToTab}
              onOpenStudyTimer={() => setIsTimerOpen(true)}
              onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
            />
          )}

          {activeTab === "notes" && (
            <StudentNotesView
              student={student}
              allNotes={allNotes}
              initialSubject={tabPayload?.selectedSubject}
              onRefresh={onRefreshData}
            />
          )}

          {activeTab === "practice-tests" && (
            <StudentPracticeTestsView
              student={student}
              allTests={allPracticeTests}
              initialTestId={tabPayload?.testId}
              onRefresh={onRefreshData}
            />
          )}

          {activeTab === "homework" && (
            <StudentHomeworkView
              student={student}
              homework={homeworkList}
              onRefresh={onRefreshData}
            />
          )}

          {activeTab === "attendance" && (
            <StudentAttendanceView student={student} />
          )}

          {activeTab === "fees" && (
            <StudentFeesView student={student} />
          )}

          {activeTab === "notifications" && (
            <StudentNotificationsView
              student={student}
              notifications={notificationsList}
              onNavigateToTab={handleNavigateToTab}
              onRefresh={onRefreshData}
            />
          )}

          {activeTab === "profile" && (
            <StudentProfileView
              student={student}
              onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
              onRefresh={onRefreshData}
            />
          )}

          {activeTab === "settings" && (
            <StudentSettingsView onRefresh={onRefreshData} />
          )}
        </main>

        {/* 4. MOBILE / TABLET BOTTOM NAVIGATION BAR */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around">
          {[
            { id: "dashboard", label: "Home", icon: LayoutDashboard },
            { id: "notes", label: "Notes", icon: BookOpen },
            { id: "practice-tests", label: "Tests", icon: Award, badge: allPracticeTests.length },
            { id: "homework", label: "Homework", icon: FileText, badge: pendingHomeworkCount },
            { id: "attendance", label: "Attendance", icon: CalendarCheck },
            { id: "fees", label: "Fees", icon: CreditCard },
            { id: "profile", label: "Profile", icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleNavigateToTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400 font-bold"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {typeof tab.badge === "number" && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        notes={allNotes}
        practiceTests={allPracticeTests}
        homework={homeworkList}
        notifications={notificationsList}
        onNavigate={handleNavigateToTab}
      />

      {/* Study Timer Modal */}
      {isTimerOpen && (
        <StudyTimerModal
          isOpen={isTimerOpen}
          onClose={() => setIsTimerOpen(false)}
        />
      )}

      {/* Avatar Selector / Upload Modal */}
      {isAvatarModalOpen && onUpdateStudentAvatar && (
        <ProfilePictureModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          existingPhoto={student.avatarUrl}
          onSelectPhoto={async (url) => {
            await onUpdateStudentAvatar(url);
            setIsAvatarModalOpen(false);
          }}
          onRemovePhoto={async () => {
            await onUpdateStudentAvatar("");
            setIsAvatarModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
