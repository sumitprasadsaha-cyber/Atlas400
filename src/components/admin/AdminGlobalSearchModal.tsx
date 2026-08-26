import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Users,
  BookOpen,
  Award,
  Clock,
  Bell,
  X,
  ArrowRight,
  Sparkles,
  IndianRupee
} from "lucide-react";
import { Student, ClassNote } from "../../types";

interface AdminGlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  allNotes: ClassNote[];
  onNavigateTab: (tab: string, extraState?: any) => void;
  onSelectStudent: (studentId: string) => void;
}

export const AdminGlobalSearchModal: React.FC<AdminGlobalSearchModalProps> = ({
  isOpen,
  onClose,
  students,
  allNotes,
  onNavigateTab,
  onSelectStudent,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger open via parent
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = searchQuery.toLowerCase().trim();

  // Matched Students
  const matchedStudents = q
    ? students.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          String(s.rollNo || "").toLowerCase().includes(q) ||
          (s.classGrade && s.classGrade.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q))
      ).slice(0, 5)
    : [];

  // Matched Notes
  const matchedNotes = q
    ? allNotes.filter(
        (n) =>
          n.chapterName.toLowerCase().includes(q) ||
          n.subject.toLowerCase().includes(q) ||
          n.classGrade.toLowerCase().includes(q)
      ).slice(0, 5)
    : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-16 sm:pt-24">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search students, notes, test banks, homework, fees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none font-medium"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Area */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {!q ? (
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Quick Navigation
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onNavigateTab("students");
                    onClose();
                  }}
                  className="p-3 text-left bg-slate-50 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Students Directory</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigateTab("notes");
                    onClose();
                  }}
                  className="p-3 text-left bg-slate-50 dark:bg-slate-800/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <span>Study Material</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigateTab("fees");
                    onClose();
                  }}
                  className="p-3 text-left bg-slate-50 dark:bg-slate-800/40 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <IndianRupee className="w-4 h-4 text-amber-600" />
                    <span>Fee Management</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigateTab("feature_flags");
                    onClose();
                  }}
                  className="p-3 text-left bg-slate-50 dark:bg-slate-800/40 hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <span>Feature Flags</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Students Section */}
              {matchedStudents.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Students ({matchedStudents.length})
                  </span>
                  <div className="space-y-1">
                    {matchedStudents.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          onSelectStudent(s.id);
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="w-4 h-4 text-blue-600" />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {s.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {s.classGrade} • Roll: {s.rollNo || "N/A"}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes Section */}
              {matchedNotes.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Study Notes ({matchedNotes.length})
                  </span>
                  <div className="space-y-1">
                    {matchedNotes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          onNavigateTab("notes");
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {n.chapterName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {n.classGrade} • {n.subject}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchedStudents.length === 0 && matchedNotes.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No matching records found for "{searchQuery}".
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Press ESC to close</span>
          <span>Atlas 2.0 Global Index</span>
        </div>
      </div>
    </div>
  );
};
