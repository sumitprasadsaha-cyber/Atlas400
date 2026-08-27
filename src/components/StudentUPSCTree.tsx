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
  GraduationCap,
  Sparkles,
  Layers,
  AlertCircle
} from "lucide-react";
import { Student, ClassNote, ChapterNote } from "../types";
import { StudentUPSCGSPaper, StudentUPSCSubject, StudentUPSCModule, StudentUPSCTopicNote } from "../utils/studentUPSCHierarchyHelper";
import { getTopicPracticeTest } from "../utils/assessmentParser";
import { getStudentTestAttempts } from "../utils/assessmentParser";
import { getScoreButtonStyles } from "../lib/practiceTestService";

interface StudentUPSCTreeProps {
  paper: StudentUPSCGSPaper;
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

export default function StudentUPSCTree({
  paper,
  student,
  onPreviewNote,
  onToggleTopicCompletion,
  onOpenPracticeTest,
  openingNoteId,
  isAdmin = false,
}: StudentUPSCTreeProps) {
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
    if (!cleanQuery) return paper.subjects;

    return paper.subjects
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
          .filter(Boolean) as StudentUPSCModule[];

        if (subjMatch || matchedModules.length > 0) {
          return {
            ...subj,
            modules: subjMatch ? subj.modules : matchedModules,
          };
        }
        return null;
      })
      .filter(Boolean) as StudentUPSCSubject[];
  }, [paper.subjects, cleanQuery]);

  return (
    <div className="flex flex-col gap-3.5 h-full overflow-hidden" id="student-upsc-tree-container">
      {/* Search Input Bar (Restricted strictly to selected paper) */}
      <div className="relative shrink-0" id="upsc-paper-search">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={`Search within ${paper.gsPaper} (subjects, modules, topics)...`}
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

      {/* Main Hierarchy Tree View */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin" id="upsc-tree-scroll-area">
        {paper.subjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 my-auto border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/20 dark:bg-slate-950/10">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 mb-3 shadow-xs">
              <BookOpen className="w-8 h-8 stroke-[1.2]" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              No subjects available in this paper.
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mt-1">
              Study notes for {paper.gsPaper} will appear here once uploaded.
            </p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 my-auto border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/20 dark:bg-slate-950/10">
            <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              No results found for &ldquo;{searchQuery}&rdquo;
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Try a different keyword or clear the search filter.
            </p>
          </div>
        ) : (
          filteredSubjects.map((subj) => {
            const isSubjExpanded = cleanQuery ? true : (expandedSubjects[subj.subjectKey] ?? true);
            const subjColorPalette = "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900";

            return (
              <div 
                key={`upsc-subj-${subj.subjectKey}`} 
                className={`rounded-2xl border ${subjColorPalette} overflow-hidden shadow-2xs transition-all`}
              >
                {/* Level 2 Header: Subject */}
                <div
                  onClick={() => toggleSubject(subj.subjectKey)}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-850/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors select-none border-b border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-transform">
                      {isSubjExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      )}
                    </span>
                    <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                      {subj.subject}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-750 text-slate-600 dark:text-slate-300">
                      {subj.modules.length} {subj.modules.length === 1 ? "Module" : "Modules"}
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      subj.progressPercent === 100
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                        : subj.progressPercent > 0
                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                        : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    }`}>
                      {subj.progressPercent}%
                    </span>
                  </div>
                </div>

                {/* Level 3: Modules */}
                {isSubjExpanded && (
                  <div className="p-3 space-y-2.5 bg-slate-50/30 dark:bg-slate-900/40">
                    {subj.modules.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-3 text-center">
                        No modules available in this subject.
                      </p>
                    ) : (
                      subj.modules.map((mod) => {
                        const modKey = `${subj.subjectKey}_${mod.moduleKey}`;
                        const isModExpanded = cleanQuery ? true : (expandedModules[modKey] ?? true);

                        return (
                          <div 
                            key={`upsc-mod-${modKey}`}
                            className="rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs"
                          >
                            {/* Module Header */}
                            <div
                              onClick={() => toggleModule(modKey)}
                              className="flex items-center justify-between px-3 py-2 bg-slate-50/50 dark:bg-slate-850/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 cursor-pointer transition-colors select-none"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="p-0.5 text-slate-400">
                                  {isModExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                  )}
                                </span>
                                {isModExpanded ? (
                                  <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                ) : (
                                  <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                )}
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {mod.moduleTitle}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {mod.completedTopics}/{mod.totalTopics} Notes
                                </span>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                                  mod.progressPercent === 100
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                    : mod.progressPercent > 0
                                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                    : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                }`}>
                                  {mod.progressPercent}%
                                </span>
                              </div>
                            </div>

                            {/* Level 4: Topic Notes */}
                            {isModExpanded && (
                              <div className="p-2.5 space-y-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/20 dark:bg-slate-950/20">
                                {mod.topics.length === 0 ? (
                                  <div className="py-3 text-center text-xs text-slate-400 italic">
                                    No Topic Notes have been uploaded yet.
                                  </div>
                                ) : (
                                  mod.topics.map((topic) => {
                                    const note = topic.note;
                                    const isOpening = openingNoteId === topic.id;
                                    const rawTopicName = topic.topicLabel || topic.topicName || `Topic ${topic.topicNo}`;
                                    
                                    // Check Practice Test availability
                                    const studentClass = student.classGrade || note.classGrade || "UPSC";
                                    const studentSubj = subj.subject || note.subject || "";
                                    const topicTest = getTopicPracticeTest(
                                      studentClass,
                                      studentSubj,
                                      mod.moduleNo,
                                      rawTopicName
                                    );
                                    const hasTest = !!(topicTest && topicTest.questions && topicTest.questions.length > 0);

                                    // Check test score attempts
                                    const allAttempts = getStudentTestAttempts(student.id || student.name || "");
                                    const normTopic = rawTopicName.toLowerCase().replace(/[^a-z0-9]/g, "");
                                    const attempts = allAttempts.filter((a) => {
                                      if (a.chapterNo !== mod.moduleNo) return false;
                                      const aNorm = (a.topicName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                                      return aNorm === normTopic || aNorm.includes(normTopic) || normTopic.includes(aNorm);
                                    });
                                    const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : null;
                                    const bestAttempt = attempts.find((a) => a.score === bestScore);
                                    const totalQ = bestAttempt?.totalQuestions || topicTest?.questions?.length || 0;
                                    const isAttempted = bestScore !== null;
                                    const pct = isAttempted && totalQ > 0 ? Math.round((bestScore / totalQ) * 100) : null;
                                    const btnStyles = getScoreButtonStyles(isAttempted, pct);

                                    const isImg = topic.fileType === "image";
                                    const fileSizeStr = formatBytes(topic.fileSize);
                                    const uploadDateStr = formatDate(topic.createdAt);

                                    return (
                                      <div
                                        key={`topic-item-${topic.id}`}
                                        className={`group rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 hover:border-blue-400/80 dark:hover:border-blue-600/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs ${
                                          isOpening ? "ring-2 ring-blue-500/50 pointer-events-none opacity-90" : ""
                                        }`}
                                      >
                                        {/* Left Info: Checkbox + Icon + Title + Metadata */}
                                        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                                          {/* Completion Status Checkbox / Indicator */}
                                          {onToggleTopicCompletion ? (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleTopicCompletion(note, subj.subject, !topic.isCompleted);
                                              }}
                                              className="mt-0.5 sm:mt-0 p-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                                              title={topic.isCompleted ? "Mark as Incomplete" : "Mark as Completed"}
                                            >
                                              {topic.isCompleted ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950/60" />
                                              ) : (
                                                <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-slate-400" />
                                              )}
                                            </button>
                                          ) : (
                                            <div className="mt-0.5 sm:mt-0 shrink-0">
                                              {topic.isCompleted ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950/60" />
                                              ) : (
                                                <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                              )}
                                            </div>
                                          )}

                                          {/* File Icon */}
                                          <div className={`p-1.5 rounded-lg shrink-0 ${
                                            isImg ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400" : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                                          }`}>
                                            {isImg ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                                          </div>

                                          {/* Title and Metadata */}
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                                {rawTopicName}
                                              </p>
                                              {isOpening && (
                                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                                                  Opening...
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                              <span className="uppercase font-mono text-[9px] bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded-xs font-bold text-slate-600 dark:text-slate-300">
                                                {isImg ? "IMG" : "PDF"}
                                              </span>
                                              {fileSizeStr && <span>{fileSizeStr}</span>}
                                              {uploadDateStr && <span>• {uploadDateStr}</span>}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Right Action Buttons: View + Practice Test */}
                                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                          {/* View Action */}
                                          <button
                                            type="button"
                                            onClick={() => onPreviewNote(note)}
                                            disabled={isOpening}
                                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                                            title="View Topic Note"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>View</span>
                                          </button>

                                          {/* Practice Test Action */}
                                          {hasTest && onOpenPracticeTest && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                onOpenPracticeTest({
                                                  classGrade: studentClass,
                                                  subject: studentSubj,
                                                  chapterNo: mod.moduleNo,
                                                  chapterName: mod.moduleName,
                                                  topicName: rawTopicName,
                                                  testType: "topic",
                                                });
                                              }}
                                              className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 text-xs font-bold active:scale-95 ${btnStyles.container}`}
                                              title={isAttempted ? `Highest Score: ${bestScore}/${totalQ}` : "Take Practice Test"}
                                            >
                                              <FileCheck className={`w-3.5 h-3.5 ${btnStyles.icon}`} />
                                              {isAttempted ? (
                                                <span>{bestScore}/{totalQ} Test</span>
                                              ) : (
                                                <span>Practice Test</span>
                                              )}
                                            </button>
                                          )}
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
