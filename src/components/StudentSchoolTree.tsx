import React, { useState, useMemo } from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  BookOpen, 
  Folder, 
  FolderOpen,
  FileText, 
  Image as ImageIcon,
  CheckCircle2, 
  Circle, 
  Search, 
  X, 
  Eye, 
  FileCheck,
  Sparkles,
  Layers,
  AlertCircle
} from "lucide-react";
import { Student, ClassNote, ChapterNote } from "../types";
import { StudentSchoolSubject, StudentSchoolModule, StudentSchoolTopicNote } from "../utils/studentSchoolHierarchyHelper";
import { getTopicPracticeTest } from "../utils/assessmentParser";
import { getStudentTestAttempts } from "../utils/assessmentParser";
import { getScoreButtonStyles } from "../lib/practiceTestService";

interface StudentSchoolTreeProps {
  className: string;
  subjects: StudentSchoolSubject[];
  student: Student;
  onPreviewNote: (note: ClassNote | ChapterNote) => void;
  onToggleTopicCompletion?: (note: ClassNote | ChapterNote, subject: string, isCompleted: boolean) => void;
  onOpenPracticeTest?: (testTarget: {
    classGrade: string;
    subject: string;
    chapterNo: number;
    chapterName: string;
    topicName: string;
    testType: "topic" | "full_chapter";
  }) => void;
  openingNoteId?: string | null;
  isAdmin?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function StudentSchoolTree({
  className,
  subjects,
  student,
  onPreviewNote,
  onToggleTopicCompletion,
  onOpenPracticeTest,
  openingNoteId,
  isAdmin = false,
}: StudentSchoolTreeProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const toggleSubject = (subjectKey: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectKey]: !(prev[subjectKey] ?? true), // default expanded
    }));
  };

  const toggleModule = (moduleKey: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleKey]: !(prev[moduleKey] ?? true), // default expanded
    }));
  };

  const cleanQuery = searchQuery.trim().toLowerCase();

  // Filter and compute auto-expansion on search
  const filteredSubjects = useMemo(() => {
    if (!cleanQuery) return subjects;

    return subjects
      .map((subj) => {
        const subjMatch = subj.subject.toLowerCase().includes(cleanQuery);

        const matchedModules = subj.modules
          .map((mod) => {
            const modMatch =
              mod.moduleName.toLowerCase().includes(cleanQuery) ||
              mod.moduleTitle.toLowerCase().includes(cleanQuery);

            const matchedTopics = mod.topics.filter((top) => {
              const topNameMatch = top.topicName.toLowerCase().includes(cleanQuery);
              const topLabelMatch = top.topicLabel.toLowerCase().includes(cleanQuery);
              const fileMatch = (top.fileName || "").toLowerCase().includes(cleanQuery);
              return topNameMatch || topLabelMatch || fileMatch;
            });

            if (modMatch || matchedTopics.length > 0) {
              return {
                ...mod,
                topics: modMatch ? mod.topics : matchedTopics,
              };
            }
            return null;
          })
          .filter(Boolean) as StudentSchoolModule[];

        if (subjMatch || matchedModules.length > 0) {
          return {
            ...subj,
            modules: subjMatch ? subj.modules : matchedModules,
          };
        }
        return null;
      })
      .filter(Boolean) as StudentSchoolSubject[];
  }, [subjects, cleanQuery]);

  const allAttempts = useMemo(() => {
    return getStudentTestAttempts(student.id || student.name || "");
  }, [student.id, student.name]);

  const handleExpandAll = () => {
    const nextSubjs: Record<string, boolean> = {};
    const nextMods: Record<string, boolean> = {};
    subjects.forEach((s) => {
      nextSubjs[s.subjectKey] = true;
      s.modules.forEach((m) => {
        nextMods[`${s.subjectKey}_${m.moduleKey}`] = true;
      });
    });
    setExpandedSubjects(nextSubjs);
    setExpandedModules(nextMods);
  };

  const handleCollapseAll = () => {
    const nextSubjs: Record<string, boolean> = {};
    const nextMods: Record<string, boolean> = {};
    subjects.forEach((s) => {
      nextSubjs[s.subjectKey] = false;
      s.modules.forEach((m) => {
        nextMods[`${s.subjectKey}_${m.moduleKey}`] = false;
      });
    });
    setExpandedSubjects(nextSubjs);
    setExpandedModules(nextMods);
  };

  return (
    <div className="flex flex-col gap-3.5 h-full overflow-hidden" id="student-school-tree-container">
      {/* Search Input Bar & Controls */}
      <div className="flex items-center gap-2 shrink-0" id="school-search-bar-row">
        <div className="relative flex-1" id="school-paper-search">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search across subjects, chapters, topic notes, and files...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Expand / Collapse All Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleExpandAll}
            className="px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
            title="Expand All"
          >
            Expand
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
            title="Collapse All"
          >
            Collapse
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 scrollbar-thin" id="school-tree-scroll-area">
        {filteredSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl mb-3">
              <BookOpen className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {cleanQuery ? "No matching modules or topic notes found." : "No subjects or modules available."}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {cleanQuery ? "Try searching for a different keyword." : `Study materials uploaded by your tutor will appear here in real time.`}
            </p>
          </div>
        ) : (
          filteredSubjects.map((subj) => {
            const isSubjExpanded = cleanQuery ? true : (expandedSubjects[subj.subjectKey] ?? true);

            return (
              <div 
                key={subj.subjectKey}
                className="border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs transition-all"
                id={`school-subject-${subj.subjectKey}`}
              >
                {/* Level 2: Subject Header (Collapsible) */}
                <div
                  onClick={() => toggleSubject(subj.subjectKey)}
                  className="flex items-center justify-between px-4 py-3.5 bg-slate-50/90 dark:bg-slate-850/70 hover:bg-slate-100/80 dark:hover:bg-slate-800 cursor-pointer select-none transition-colors border-b border-slate-200/80 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                      {isSubjExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                        {subj.subject}
                      </h4>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {subj.totalModules} {subj.totalModules === 1 ? "Chapter" : "Chapters"} • {subj.totalTopics} {subj.totalTopics === 1 ? "Topic Note" : "Topic Notes"}
                      </p>
                    </div>
                  </div>

                  {/* Subject Progress Pill */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {subj.completedTopics}/{subj.totalTopics} Done
                      </span>
                    </div>
                    <div className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                      subj.progressPercent === 100
                        ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300"
                        : subj.progressPercent > 0
                        ? "bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}>
                      {subj.progressPercent}%
                    </div>
                  </div>
                </div>

                {/* Level 3: Chapters Container */}
                {isSubjExpanded && (
                  <div className="p-3.5 space-y-3 bg-slate-50/30 dark:bg-slate-950/30">
                    {subj.modules.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                        No chapters created for this subject yet.
                      </div>
                    ) : (
                      subj.modules.map((mod) => {
                        const modKey = `${subj.subjectKey}_${mod.moduleKey}`;
                        const isModExpanded = cleanQuery ? true : (expandedModules[modKey] ?? true);

                        return (
                          <div
                            key={mod.moduleKey}
                            className="border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs"
                            id={`school-chapter-${modKey}`}
                          >
                            {/* Chapter Header (Collapsible) */}
                            <div
                              onClick={() => toggleModule(modKey)}
                              className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/60 dark:bg-slate-850/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer select-none transition-colors border-b border-slate-100 dark:border-slate-800/60"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className="text-slate-400 shrink-0">
                                  {isModExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </div>
                                <div className="text-indigo-500 dark:text-indigo-400 shrink-0">
                                  {isModExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {mod.moduleTitle}
                                  </h5>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                  {mod.completedTopics}/{mod.totalTopics} Topics
                                </span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                                  mod.progressPercent === 100
                                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50"
                                    : mod.progressPercent > 0
                                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                }`}>
                                  {mod.progressPercent}%
                                </span>
                              </div>
                            </div>

                            {/* Level 4: Topic Notes List */}
                            {isModExpanded && (
                              <div className="p-2 space-y-1.5 bg-white dark:bg-slate-900">
                                {mod.topics.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-slate-400 italic">
                                    No topic notes uploaded in this chapter yet.
                                  </div>
                                ) : (
                                  mod.topics.map((topic) => {
                                    const isOpening = openingNoteId === topic.id;

                                    // Practice Test lookup
                                    const practiceTest = getTopicPracticeTest(
                                      className,
                                      subj.subject,
                                      mod.moduleNo,
                                      topic.topicName
                                    );
                                    const hasTest = !!(practiceTest && practiceTest.questions && practiceTest.questions.length > 0);

                                    // Check student test attempt status
                                    const matchingAttempt = allAttempts.find((a) => {
                                      if (a.testType !== "topic") return false;
                                      if (a.subject.toLowerCase() !== subj.subject.toLowerCase()) return false;
                                      if (a.chapterNo !== mod.moduleNo) return false;
                                      const topNorm = topic.topicName.toLowerCase().replace(/[^a-z0-9]/g, "");
                                      const aNorm = a.topicName.toLowerCase().replace(/[^a-z0-9]/g, "");
                                      return aNorm === topNorm || aNorm.includes(topNorm) || topNorm.includes(aNorm);
                                    });
                                    const isAttempted = !!matchingAttempt;
                                    const pct = matchingAttempt ? matchingAttempt.percentage : null;
                                    const btnStyles = getScoreButtonStyles(isAttempted, pct);

                                    return (
                                      <div
                                        key={topic.id}
                                        className={`group flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl border transition-all gap-2 ${
                                          topic.isCompleted
                                            ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40"
                                            : "bg-slate-50/60 dark:bg-slate-850/40 border-slate-200/60 dark:border-slate-800/60 hover:border-blue-300 dark:hover:border-blue-700"
                                        }`}
                                        id={`school-topic-${topic.id}`}
                                      >
                                        {/* Topic Info & Completion Toggle */}
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                          {/* Completion Checkbox */}
                                          {onToggleTopicCompletion && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleTopicCompletion(topic.note, subj.subject, !topic.isCompleted);
                                              }}
                                              className={`shrink-0 transition-transform active:scale-90 p-0.5 cursor-pointer ${
                                                topic.isCompleted
                                                  ? "text-emerald-600 dark:text-emerald-400"
                                                  : "text-slate-300 dark:text-slate-600 hover:text-blue-500"
                                              }`}
                                              title={topic.isCompleted ? "Mark incomplete" : "Mark as completed"}
                                            >
                                              {topic.isCompleted ? (
                                                <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
                                              ) : (
                                                <Circle className="w-4 h-4" />
                                              )}
                                            </button>
                                          )}

                                          {/* Topic Number Tag */}
                                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 shrink-0">
                                            {typeof topic.topicNo === "number" ? `T${topic.topicNo}` : topic.topicNo}
                                          </span>

                                          {/* File icon */}
                                          {topic.fileType === "image" ? (
                                            <ImageIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                          ) : (
                                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                          )}

                                          {/* Topic Name & File Details */}
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                              <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">
                                                {topic.topicName}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                                              {topic.fileName && <span className="truncate max-w-[140px] sm:max-w-[200px]">{topic.fileName}</span>}
                                              {topic.fileSize ? <span>• {formatBytes(topic.fileSize)}</span> : null}
                                              {topic.createdAt ? <span>• {formatDate(topic.createdAt)}</span> : null}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Action Buttons: Preview & Practice Test */}
                                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                          {/* Practice Test Button */}
                                          {hasTest && onOpenPracticeTest && (
                                            <button
                                              onClick={() => {
                                                onOpenPracticeTest({
                                                  classGrade: className,
                                                  subject: subj.subject,
                                                  chapterNo: mod.moduleNo,
                                                  chapterName: mod.moduleName,
                                                  topicName: topic.topicName,
                                                  testType: "topic",
                                                });
                                              }}
                                              className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs ${btnStyles.container}`}
                                              title={matchingAttempt ? `Best score: ${matchingAttempt.score}/${matchingAttempt.totalQuestions} (${matchingAttempt.percentage}%)` : "Take Practice Test"}
                                            >
                                              <FileCheck className={`w-3.5 h-3.5 ${btnStyles.icon}`} />
                                              {isAttempted ? (
                                                <span>{matchingAttempt?.score}/{matchingAttempt?.totalQuestions} Test</span>
                                              ) : (
                                                <span>Practice Test</span>
                                              )}
                                            </button>
                                          )}

                                          {/* View Note Button */}
                                          <button
                                            onClick={() => onPreviewNote(topic.note)}
                                            disabled={isOpening}
                                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 flex items-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-50"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>{isOpening ? "Opening..." : "View"}</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
