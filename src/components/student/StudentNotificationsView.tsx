import React, { useState, useMemo } from "react";
import {
  Bell,
  CheckCircle2,
  BookOpen,
  FileText,
  Award,
  CreditCard,
  CalendarCheck,
  CheckCheck,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Student } from "../../types";
import { StudentNotification, studentPortalService } from "../../lib/studentPortalService";
import { formatDisplayDate } from "../../utils/studentFormatters";

interface StudentNotificationsViewProps {
  student: Student;
  notifications: StudentNotification[];
  onNavigateToTab: (tabKey: string, payload?: any) => void;
  onRefresh?: () => void;
}

export const StudentNotificationsView: React.FC<StudentNotificationsViewProps> = ({
  student,
  notifications,
  onNavigateToTab,
  onRefresh,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (selectedCategory === "all") return notifications;
    if (selectedCategory === "unread") return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.category === selectedCategory);
  }, [notifications, selectedCategory]);

  const handleMarkAsRead = async (notif: StudentNotification) => {
    if (notif.read) return;
    await studentPortalService.markNotificationAsRead(student.id, notif.id);
    if (onRefresh) onRefresh();
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await studentPortalService.markAllNotificationsAsRead(student.id, unreadIds);
    if (onRefresh) onRefresh();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "notes":
        return <BookOpen className="w-4 h-4 text-indigo-500" />;
      case "homework":
        return <FileText className="w-4 h-4 text-amber-500" />;
      case "tests":
        return <Award className="w-4 h-4 text-purple-500" />;
      case "fees":
        return <CreditCard className="w-4 h-4 text-teal-500" />;
      case "attendance":
        return <CalendarCheck className="w-4 h-4 text-emerald-500" />;
      default:
        return <Bell className="w-4 h-4 text-rose-500" />;
    }
  };

  return (
    <div id="student-notifications-view" className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
                <Bell className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Notification Center
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Class announcements, study material releases, assessment alerts, and fee updates
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-indigo-500" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-2 border-t border-slate-100 dark:border-slate-800 scrollbar-none">
          {[
            { id: "all", label: "All Alerts" },
            { id: "unread", label: `Unread (${unreadCount})` },
            { id: "notes", label: "Notes" },
            { id: "homework", label: "Homework" },
            { id: "tests", label: "Tests" },
            { id: "fees", label: "Fees" },
            { id: "attendance", label: "Attendance" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 space-y-3">
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            No Notifications
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            You're all caught up with your tuition broadcasts and announcements.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                handleMarkAsRead(notif);
                if (notif.linkTab) onNavigateToTab(notif.linkTab, { targetId: notif.targetId });
              }}
              className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group ${
                !notif.read
                  ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 shadow-xs"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-start space-x-3.5 min-w-0">
                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5">
                  {getCategoryIcon(notif.category)}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {notif.title}
                    </h3>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {notif.body}
                  </p>
                  <div className="text-[10px] text-slate-400 flex items-center space-x-2 pt-1">
                    <span>{formatDisplayDate(notif.createdAt)}</span>
                    <span>•</span>
                    <span className="capitalize">{notif.category}</span>
                  </div>
                </div>
              </div>

              {notif.linkTab && (
                <div className="flex items-center space-x-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:translate-x-0.5 transition">
                  <span>View Details</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
