import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Layers, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  MoreVertical, 
  FileText, 
  Search, 
  X,
  BookOpen,
  School,
  GraduationCap,
  Upload,
  Edit2,
  FolderOpen,
  ChevronsDown,
  ChevronsUp,
  Sparkles
} from "lucide-react";
import { ClassNote } from "../../types";
import TopicCard from "./TopicCard";

interface ChapterItem {
  number: number;
  name: string;
}

interface NotesMainPanelProps {
  type: "school" | "upsc";
  selectedSubject: string;
  selectedParentName: string; // e.g. "Class 10" or "GS Paper 1"
  chapters: ChapterItem[];
  chapterNotesMap: Map<number, ClassNote[]>;
  selectedChapterNo: number;
  selectedTopicNoteId: string | null;
  expandedChapters: Record<number, boolean>;
  onToggleExpand: (chapterNo: number) => void;
  onSelectChapter: (chapterNo: number, chapterName: string) => void;
  onSelectTopic: (note: ClassNote, chapterNo: number, chapterName: string) => void;
  onAddChapter: () => void;
  onAddTopic: (chapterNo: number, chapterName: string) => void;
  onRenameChapter: (chapterNo: number, chapterName: string) => void;
  onDeleteChapter: (chapterNo: number, chapterName: string) => void;
  onRenameTopic: (note: ClassNote) => void;
  onDeleteTopic: (note: ClassNote) => void;
  onPreviewTopic: (note: ClassNote) => void;
  onReplaceTopic: (note: ClassNote) => void;
  onOpenPracticeTest: (note: ClassNote) => void;
  checkIfTopicHasPracticeTest: (note: ClassNote) => boolean;
}

export default function NotesMainPanel({
  type,
  selectedSubject,
  selectedParentName,
  chapters,
  chapterNotesMap,
  selectedChapterNo,
  selectedTopicNoteId,
  expandedChapters,
  onToggleExpand,
  onSelectChapter,
  onSelectTopic,
  onAddChapter,
  onAddTopic,
  onRenameChapter,
  onDeleteChapter,
  onRenameTopic,
  onDeleteTopic,
  onPreviewTopic,
  onReplaceTopic,
  onOpenPracticeTest,
  checkIfTopicHasPracticeTest,
}: NotesMainPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChapterKebab, setActiveChapterKebab] = useState<number | null>(null);
  const kebabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setActiveChapterKebab(null);
      }
    }
    if (activeChapterKebab !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeChapterKebab]);

  const isSchool = type === "school";
  const itemLabel = isSchool ? "Chapter" : "Module";

  // Total topics count across all chapters in selected subject
  const totalTopicsCount = useMemo(() => {
    let count = 0;
    chapterNotesMap.forEach((notes) => {
      count += notes.length;
    });
    return count;
  }, [chapterNotesMap]);

  // Filter chapters/topics based on search query
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const q = searchQuery.toLowerCase();

    return chapters.filter((ch) => {
      const chMatch = `${itemLabel} ${ch.number} : ${ch.name} ${ch.number}`.toLowerCase().includes(q);
      if (chMatch) return true;

      const notes = chapterNotesMap.get(ch.number) || [];
      return notes.some((n) => {
        const title = (n as any).topicTitle || (n as any).topicName || n.partLabel || "";
        const no = (n as any).topicNumber ?? n.topicNo ?? "";
        const fn = n.fileName || (n as any).pdfFileName || "";
        return `topic ${no} ${title} ${fn}`.toLowerCase().includes(q);
      });
    });
  }, [chapters, chapterNotesMap, searchQuery, itemLabel]);

  // Expand all / Collapse all helper
  const allExpanded = useMemo(() => {
    if (chapters.length === 0) return false;
    return chapters.every((ch) => expandedChapters[ch.number] ?? false);
  }, [chapters, expandedChapters]);

  const toggleAllExpand = () => {
    const targetState = !allExpanded;
    chapters.forEach((ch) => {
      if ((expandedChapters[ch.number] ?? false) !== targetState) {
        onToggleExpand(ch.number);
      }
    });
  };

  return (
    <main 
      className="w-full rounded-2xl md:rounded-none border md:border-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 md:bg-slate-50/60 md:dark:bg-slate-950/60 shadow-xs md:shadow-none flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden min-w-0" 
      id="notes-main-content-panel"
    >
      {/* 1. Header Bar: Breadcrumbs, Counts, Search, Add Chapter Button */}
      <header className="px-3.5 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 md:bg-white/80 md:dark:bg-slate-900/80 backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
              {isSchool ? <School className="w-3.5 h-3.5" /> : <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />}
              <span>{isSchool ? "School Notes" : "UPSC Notes"}</span>
            </span>

            {selectedParentName && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 font-bold truncate max-w-[140px] sm:max-w-none">
                  {selectedParentName}
                </span>
              </>
            )}

            {selectedSubject && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-900 dark:text-slate-100 font-extrabold flex items-center gap-1 truncate max-w-[160px] sm:max-w-none">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">{selectedSubject}</span>
                </span>
              </>
            )}
          </div>

          {selectedSubject && chapters.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                {chapters.length} {itemLabel}{chapters.length === 1 ? "" : "s"}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100/70 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 shrink-0">
                {totalTopicsCount} {totalTopicsCount === 1 ? "Topic Note" : "Topic Notes"}
              </span>
            </div>
          )}
        </div>

        {/* Right Header Controls: Search, Expand All, + Add Chapter/Module */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
          {selectedSubject && (
            <>
              {/* Search Box */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${itemLabel.toLowerCase()}s or topics...`}
                  className="w-full min-h-[38px] pl-8 pr-7 py-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900"
                  id="main-panel-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {/* Expand/Collapse All Button */}
                {chapters.length > 1 && (
                  <button
                    type="button"
                    onClick={toggleAllExpand}
                    className="min-h-[38px] px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1 transition-all cursor-pointer"
                    title={allExpanded ? "Collapse All Chapters" : "Expand All Chapters"}
                    id="toggle-all-expand-btn"
                  >
                    {allExpanded ? (
                      <>
                        <ChevronsUp className="w-3.5 h-3.5 text-slate-500" />
                        <span>Collapse All</span>
                      </>
                    ) : (
                      <>
                        <ChevronsDown className="w-3.5 h-3.5 text-slate-500" />
                        <span>Expand All</span>
                      </>
                    )}
                  </button>
                )}

                {/* + Add Chapter/Module Button */}
                <button
                  type="button"
                  onClick={onAddChapter}
                  className="min-h-[38px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all shrink-0 flex-1 sm:flex-initial justify-center cursor-pointer"
                  id="main-panel-add-chapter-btn"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add {itemLabel}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* 2. Main Content Scroll Area: Chapters & Topics Full Width */}
      <div 
        className="p-3.5 sm:p-5 md:p-6 space-y-4 md:flex-1 md:min-h-0 md:overflow-y-auto md:scrollbar-thin md:overscroll-contain" 
        id="notes-main-scroll"
      >
        {!selectedParentName ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 border border-blue-200/60 dark:border-blue-800/60 shadow-xs">
              {isSchool ? <School className="w-8 h-8" /> : <GraduationCap className="w-8 h-8" />}
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No {isSchool ? "Class" : "GS Paper"} Selected
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Please select or create a {isSchool ? "Class" : "GS Paper"} from the left sidebar to manage notes.
            </p>
          </div>
        ) : !selectedSubject ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Select a Subject in {selectedParentName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Choose a subject from the left panel or add a new subject to view and organize chapter notes.
            </p>
          </div>
        ) : filteredChapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-lg mx-auto border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/60 dark:bg-slate-900/40 p-8 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {searchQuery ? "No matching chapters found" : `No ${itemLabel.toLowerCase()}s created yet`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              {searchQuery 
                ? `No chapters or topics match "${searchQuery}". Try a different keyword.`
                : `Create your first ${itemLabel.toLowerCase()} to start uploading and organizing topic notes for ${selectedSubject}.`}
            </p>

            {!searchQuery && (
              <button
                type="button"
                onClick={onAddChapter}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 inline-flex items-center gap-1.5 transition-all cursor-pointer"
                id="empty-state-add-chapter-btn"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create {itemLabel} 1</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-w-6xl mx-auto" id="chapters-list-container">
            {filteredChapters.map((ch) => {
              const chNumber = ch.number;
              const chName = ch.name;
              const isExpanded = expandedChapters[chNumber] ?? true;
              const isSelected = selectedChapterNo === chNumber;
              const notes = chapterNotesMap.get(chNumber) || [];

              return (
                <article
                  key={chNumber}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                    isSelected
                      ? "border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-sm"
                      : "border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                  id={`chapter-card-${chNumber}`}
                >
                  {/* Chapter Header Bar */}
                  <div
                    className={`px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors select-none ${
                      isExpanded
                        ? "bg-slate-50/80 dark:bg-slate-850/80 border-b border-slate-200/80 dark:border-slate-800"
                        : "hover:bg-slate-50/60 dark:hover:bg-slate-850/50"
                    }`}
                    onClick={() => {
                      onSelectChapter(chNumber, chName);
                      onToggleExpand(chNumber);
                    }}
                  >
                    {/* Left: Accordion Chevron, Chapter Label & Name, Topic Count Badge */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpand(chNumber);
                        }}
                        className="p-1 -ml-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                        title={isExpanded ? "Collapse topics" : "Expand topics"}
                        id={`toggle-chapter-btn-${chNumber}`}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {/* Chapter Badge and Title (e.g. Chapter 1 : Real Numbers) */}
                      <div className="min-w-0 flex-1 flex items-center gap-2.5 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
                          <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{itemLabel} {chNumber}</span>
                        </span>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {chName ? `: ${chName}` : ""}
                        </h3>

                        {/* Topics Count Pill */}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          notes.length > 0
                            ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}>
                          {notes.length} {notes.length === 1 ? "Topic" : "Topics"}
                        </span>
                      </div>
                    </div>

                    {/* Right: Chapter Action Buttons (+ Upload Note, Rename, Delete) */}
                    <div 
                      className="flex items-center gap-2 shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800 justify-end w-full sm:w-auto flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* + Upload Note / Add Topic Button */}
                      <button
                        type="button"
                        onClick={() => onAddTopic(chNumber, chName)}
                        className="min-h-[36px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-initial justify-center"
                        title={`Upload note for ${itemLabel} ${chNumber}`}
                        id={`upload-topic-btn-ch-${chNumber}`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Note</span>
                      </button>

                      {/* Rename Chapter Button */}
                      <button
                        type="button"
                        onClick={() => onRenameChapter(chNumber, chName)}
                        className="min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-all flex items-center gap-1 cursor-pointer"
                        title={`Edit ${itemLabel} ${chNumber} number or name`}
                        id={`rename-ch-btn-${chNumber}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="inline">Edit</span>
                      </button>

                      {/* Delete Chapter Button */}
                      <button
                        type="button"
                        onClick={() => onDeleteChapter(chNumber, chName)}
                        className="min-h-[36px] p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/60 transition-all cursor-pointer flex items-center justify-center"
                        title={`Delete ${itemLabel} ${chNumber} and all its topics`}
                        id={`delete-ch-btn-${chNumber}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Chapter Collapsible Body: Topics Grid / List */}
                  {isExpanded && (
                    <div className="p-3 sm:p-4 md:p-5 bg-slate-50/40 dark:bg-slate-950/30 space-y-2.5 sm:space-y-3" id={`chapter-topics-body-${chNumber}`}>
                      {notes.length === 0 ? (
                        <div className="py-8 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl bg-white/70 dark:bg-slate-900/50">
                          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            No topic notes in {itemLabel} {chNumber}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Upload a PDF or document note for this {itemLabel.toLowerCase()} to make it accessible to students.
                          </p>
                          <button
                            type="button"
                            onClick={() => onAddTopic(chNumber, chName)}
                            className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                            id={`empty-upload-btn-${chNumber}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Upload Topic Note</span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2.5">
                          {notes.map((note) => {
                            const noteId = note.id;
                            const topicNo = (note as any).topicNumber ?? note.topicNo ?? 1;
                            const topicTitle = (note as any).topicTitle || (note as any).topicName || note.partLabel || `Topic ${topicNo}`;
                            const hasPracticeTest = checkIfTopicHasPracticeTest(note);

                            return (
                              <TopicCard
                                key={noteId}
                                note={note}
                                topicNumber={topicNo}
                                topicTitle={topicTitle}
                                isAdmin={true}
                                onPreview={() => onPreviewTopic(note)}
                                onReplace={() => onReplaceTopic(note)}
                                onRename={() => onRenameTopic(note)}
                                onDelete={() => onDeleteTopic(note)}
                                onOpenPracticeTest={() => onOpenPracticeTest(note)}
                                hasPracticeTest={hasPracticeTest}
                                className={selectedTopicNoteId === noteId ? "ring-2 ring-blue-500 border-blue-400" : ""}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
