import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  BookOpen,
  Award,
  FileText,
  Bell,
  X,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { ClassNote } from "../../types";
import { PracticeTest } from "../../../shared/types/practice-tests.types";
import { StudentHomeworkItem, StudentNotification } from "../../lib/studentPortalService";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: ClassNote[];
  practiceTests: PracticeTest[];
  homework: StudentHomeworkItem[];
  notifications: StudentNotification[];
  onNavigate: (tabKey: string, payload?: any) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  notes,
  practiceTests,
  homework,
  notifications,
  onNavigate,
}) => {
  const [query, setQuery] = useState("");

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return { notes: [], tests: [], homework: [], notifications: [] };
    const q = query.toLowerCase().trim();

    const matchedNotes = notes
      .filter(
        (n) =>
          n.chapterName.toLowerCase().includes(q) ||
          (n.topicName && n.topicName.toLowerCase().includes(q)) ||
          n.subject.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const matchedTests = practiceTests
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          (t.chapter && t.chapter.toLowerCase().includes(q))
      )
      .slice(0, 4);

    const matchedHomework = homework
      .filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.subject.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const matchedNotifs = notifications
      .filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .slice(0, 4);

    return {
      notes: matchedNotes,
      tests: matchedTests,
      homework: matchedHomework,
      notifications: matchedNotifs,
    };
  }, [query, notes, practiceTests, homework, notifications]);

  const totalResults =
    searchResults.notes.length +
    searchResults.tests.length +
    searchResults.homework.length +
    searchResults.notifications.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden space-y-0">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across notes, tests, homework, and announcements..."
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 dark:text-white focus:outline-none placeholder-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-xs font-bold"
          >
            ESC
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {!query.trim() ? (
            <div className="text-center py-10 text-xs text-slate-400">
              Type keywords to search curriculum notes, practice tests, homework assignments, and alerts.
            </div>
          ) : totalResults === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              No matching records found for "{query}".
            </div>
          ) : (
            <div className="space-y-4">
              {/* Notes */}
              {searchResults.notes.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Study Notes ({searchResults.notes.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {searchResults.notes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          onNavigate("notes", { selectedSubject: n.subject });
                          onClose();
                        }}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 rounded-xl flex items-center justify-between cursor-pointer transition text-xs group"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {n.chapterName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {n.subject} {n.topicName ? `• ${n.topicName}` : ""}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Practice Tests */}
              {searchResults.tests.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <Award className="w-3.5 h-3.5 text-purple-500" />
                    <span>Practice Tests ({searchResults.tests.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {searchResults.tests.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          onNavigate("practice-tests", { testId: t.id });
                          onClose();
                        }}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-purple-50/50 dark:hover:bg-purple-950/40 rounded-xl flex items-center justify-between cursor-pointer transition text-xs group"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                            {t.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {t.subject} • {t.duration} mins
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Homework */}
              {searchResults.homework.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                    <span>Homework Assignments ({searchResults.homework.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {searchResults.homework.map((h) => (
                      <div
                        key={h.id}
                        onClick={() => {
                          onNavigate("homework");
                          onClose();
                        }}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50/50 dark:hover:bg-amber-950/40 rounded-xl flex items-center justify-between cursor-pointer transition text-xs group"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                            {h.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {h.subject} • Status: {h.status}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notifications */}
              {searchResults.notifications.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <Bell className="w-3.5 h-3.5 text-rose-500" />
                    <span>Announcements ({searchResults.notifications.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {searchResults.notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          onNavigate("notifications");
                          onClose();
                        }}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-rose-50/50 dark:hover:bg-rose-950/40 rounded-xl flex items-center justify-between cursor-pointer transition text-xs group"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400">
                            {n.title}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {n.body}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
