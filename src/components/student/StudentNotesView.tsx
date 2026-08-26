import React, { useState, useMemo, useEffect } from "react";
import {
  BookOpen,
  Search,
  Download,
  ExternalLink,
  Clock,
  Filter,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  X,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { Student, ClassNote, ChapterNote } from "../../types";
import { formatBytes, formatDisplayDate } from "../../utils/studentFormatters";
import { openPdfWithNativeViewer } from "../../lib/nativePdfService";

interface StudentNotesViewProps {
  student: Student;
  allNotes: ClassNote[];
  initialSubject?: string | null;
  onRefresh?: () => void;
}

export const StudentNotesView: React.FC<StudentNotesViewProps> = ({
  student,
  allNotes,
  initialSubject,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(initialSubject || null);
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});
  const [activeFilter, setActiveFilter] = useState<"all" | "recent" | "completed">("all");
  const [openingNoteId, setOpeningNoteId] = useState<string | null>(null);

  // Available subjects for student
  const availableSubjects = useMemo(() => {
    const subs = new Set<string>();
    (student.enrolledSubjects || []).forEach((s) => {
      if (s.trim()) subs.add(s.trim());
    });

    allNotes.forEach((n) => {
      if (!n.classGrade || n.classGrade === student.classGrade || n.classGrade === "all") {
        if (n.subject) subs.add(n.subject.trim());
      }
    });

    const list = Array.from(subs);
    return list.sort();
  }, [student.enrolledSubjects, student.classGrade, allNotes]);

  // Set default subject if not selected
  useEffect(() => {
    if (initialSubject && availableSubjects.includes(initialSubject)) {
      setSelectedSubject(initialSubject);
    } else if (!selectedSubject && availableSubjects.length > 0) {
      setSelectedSubject(availableSubjects[0]);
    }
  }, [initialSubject, availableSubjects, selectedSubject]);

  // Filter notes matching student's class and selected subject
  const studentNotes = useMemo(() => {
    let filtered = allNotes.filter((n) => {
      const classMatch = !n.classGrade || n.classGrade === student.classGrade || n.classGrade === "all";
      const subjectMatch = selectedSubject ? n.subject.toLowerCase().trim() === selectedSubject.toLowerCase().trim() : true;
      const accessMatch =
        !n.accessType ||
        n.accessType === "all" ||
        (Array.isArray(n.allowedStudentIds) && n.allowedStudentIds.includes(student.id));

      return classMatch && subjectMatch && accessMatch;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (n) =>
          n.chapterName.toLowerCase().includes(q) ||
          (n.topicName && n.topicName.toLowerCase().includes(q)) ||
          n.subject.toLowerCase().includes(q) ||
          (n.fileName && n.fileName.toLowerCase().includes(q))
      );
    }

    if (activeFilter === "recent") {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }

    return filtered;
  }, [allNotes, student.classGrade, student.id, selectedSubject, searchQuery, activeFilter]);

  // Group notes by Chapter
  const chapterGroups = useMemo(() => {
    const groups: Record<number, { chapterNo: number; chapterName: string; notes: ClassNote[] }> = {};

    studentNotes.forEach((n) => {
      const chNo = n.chapterNo || 1;
      if (!groups[chNo]) {
        groups[chNo] = {
          chapterNo: chNo,
          chapterName: n.chapterName || `Chapter ${chNo}`,
          notes: [],
        };
      }
      groups[chNo].notes.push(n);
    });

    return Object.values(groups).sort((a, b) => a.chapterNo - b.chapterNo);
  }, [studentNotes]);

  // Expand all chapters by default on subject change
  useEffect(() => {
    const initialExp: Record<number, boolean> = {};
    chapterGroups.forEach((g) => {
      initialExp[g.chapterNo] = true;
    });
    setExpandedChapters(initialExp);
  }, [selectedSubject, chapterGroups.length]);

  const toggleChapter = (chNo: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chNo]: !prev[chNo],
    }));
  };

  const handleOpenDocument = async (note: ClassNote) => {
    setOpeningNoteId(note.id);
    try {
      const directUrl = note.pdfUrl || (note as any).downloadUrl;
      const fileName = note.pdfFileName || (note as any).fileName || `${note.chapterName}.pdf`;

      if (directUrl || (note as any).storageKey) {
        await openPdfWithNativeViewer({
          noteId: note.id,
          url: directUrl,
          storageKey: (note as any).storageKey || (note as any).storagePath,
          fileName,
          title: note.chapterName,
          subject: note.subject,
        });
      } else {
        alert("Study material file URL is not available.");
      }
    } catch (e) {
      console.error("Failed to open note document:", e);
    } finally {
      setOpeningNoteId(null);
    }
  };

  return (
    <div id="student-notes-view" className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header & Subject Selector Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <BookOpen className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Study Materials & Notes
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Curriculum notes, chapter guides, and lecture references hosted on Cloudflare R2
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="student-notes-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chapters, topics..."
              className="w-full pl-10 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Subjects Tab Strip */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
          {availableSubjects.map((sub) => {
            const isSelected = selectedSubject?.toLowerCase() === sub.toLowerCase();
            return (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chapters & Notes List */}
      {chapterGroups.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 space-y-3">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            No Study Notes Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No chapters matched "${searchQuery}". Try a different search term.`
              : `No study notes uploaded yet for ${selectedSubject || "this subject"}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {chapterGroups.map((group) => {
            const isExpanded = Boolean(expandedChapters[group.chapterNo]);

            return (
              <div
                key={group.chapterNo}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Chapter Header Accordion */}
                <div
                  onClick={() => toggleChapter(group.chapterNo)}
                  className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition select-none"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black shrink-0">
                      Ch {group.chapterNo}
                    </span>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        {group.chapterName}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {group.notes.length} document{group.notes.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>

                {/* Chapter Notes Grid (Expanded) */}
                {isExpanded && (
                  <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20">
                    {group.notes.map((note) => {
                      const isPdf = (note.mimeType || "").includes("pdf") || (note.pdfFileName || "").endsWith(".pdf");
                      const isOpening = openingNoteId === note.id;

                      return (
                        <div
                          key={note.id}
                          className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-xl shadow-xs hover:border-indigo-300 dark:hover:border-indigo-600 transition flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5">
                                {isPdf ? (
                                  <FileText className="w-4 h-4 text-rose-500" />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                                )}
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {isPdf ? "PDF Document" : "Image Note"}
                                </span>
                              </div>
                              {note.topicNo && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  Topic #{note.topicNo}
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                              {note.topicName || note.chapterName}
                            </h4>

                            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                              {note.fileSize && <div>Size: {formatBytes(note.fileSize)}</div>}
                              <div>Added: {formatDisplayDate(note.createdAt || note.uploadedAt)}</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isOpening}
                            onClick={() => handleOpenDocument(note)}
                            className="w-full inline-flex items-center justify-center space-x-2 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            {isOpening ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Opening Document...</span>
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open in Native Viewer</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
