import React, { useState, useRef, useEffect } from "react";
import { 
  Layers, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  MoreVertical, 
  FileText, 
  FileCheck, 
  Search, 
  X,
  BookOpen
} from "lucide-react";
import { ClassNote } from "../../types";

interface ChapterItem {
  number: number;
  name: string;
}

interface NotesMiddlePanelProps {
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
  checkIfTopicHasPracticeTest: (note: ClassNote) => boolean;
}

export default function NotesMiddlePanel({
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
  checkIfTopicHasPracticeTest,
}: NotesMiddlePanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeKebab, setActiveKebab] = useState<string | null>(null);
  const kebabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setActiveKebab(null);
      }
    }
    if (activeKebab) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeKebab]);

  const isSchool = type === "school";
  const itemLabel = isSchool ? "Chapter" : "Module";

  // Filter chapters/topics based on search query
  const filteredChapters = chapters.filter((ch) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const chMatch = `${itemLabel} ${ch.number} ${ch.name}`.toLowerCase().includes(q);
    if (chMatch) return true;
    const notes = chapterNotesMap.get(ch.number) || [];
    return notes.some((n) => {
      const title = (n as any).topicTitle || (n as any).topicName || n.partLabel || "";
      const no = (n as any).topicNumber ?? n.topicNo ?? "";
      return `topic ${no} ${title} ${n.fileName || ""}`.toLowerCase().includes(q);
    });
  });

  return (
    <div className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 shrink-0 overflow-hidden" id="notes-middle-panel">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="min-w-0">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{selectedSubject ? `${selectedSubject}` : `Select Subject`}</span>
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {selectedParentName ? `${selectedParentName} • ` : ""}{chapters.length} {itemLabel}{chapters.length === 1 ? "" : "s"}
            </p>
          </div>

          {selectedSubject && (
            <button
              type="button"
              onClick={onAddChapter}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 transition-all shrink-0 cursor-pointer"
              title={`Add ${itemLabel}`}
              id="add-chapter-middle-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ {itemLabel}</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${itemLabel.toLowerCase()}s or topics...`}
            className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500"
            id="middle-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Chapters & Collapsible Topics List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5 scrollbar-thin overscroll-contain" id="chapters-accordion-scroll">
        {!selectedSubject ? (
          <div className="p-6 text-center text-slate-400">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-medium">Select a class & subject from the left panel to view chapters</p>
          </div>
        ) : filteredChapters.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
            <Layers className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No {itemLabel.toLowerCase()}s created</p>
            <p className="text-[11px] text-slate-400 mt-1">Create your first {itemLabel.toLowerCase()} to organize topic notes.</p>
            <button
              type="button"
              onClick={onAddChapter}
              className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add {itemLabel}</span>
            </button>
          </div>
        ) : (
          filteredChapters.map((ch) => {
            const isExpanded = expandedChapters[ch.number] ?? (ch.number === selectedChapterNo);
            const isSelected = selectedChapterNo === ch.number;
            const notes = chapterNotesMap.get(ch.number) || [];
            const kebabKey = `ch-${ch.number}`;

            return (
              <div 
                key={ch.number}
                className={`rounded-2xl border transition-all ${
                  isSelected 
                    ? "border-blue-300/90 dark:border-blue-700/90 bg-blue-50/30 dark:bg-blue-950/20" 
                    : "border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900"
                }`}
                id={`accordion-chapter-${ch.number}`}
              >
                {/* Chapter Row / Accordion Header */}
                <div 
                  className={`px-3 py-2.5 rounded-2xl flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-100/50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100"
                      : "hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200"
                  }`}
                  onClick={() => {
                    onSelectChapter(ch.number, ch.name);
                    onToggleExpand(ch.number);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(ch.number);
                      }}
                      className="p-1 -ml-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-colors"
                      title={isExpanded ? "Collapse topics" : "Expand topics"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs truncate">
                          {itemLabel} {ch.number}: {ch.name}
                        </span>
                        {notes.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold shrink-0">
                            {notes.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Chapter Actions: Kebab (Rename) & Delete */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Delete Icon (🗑️) */}
                    <button
                      type="button"
                      onClick={() => onDeleteChapter(ch.number, ch.name)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      title={`Delete ${itemLabel} ${ch.number}`}
                      id={`delete-ch-btn-${ch.number}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* 3-dots Kebab for Rename */}
                    <div className="relative" ref={activeKebab === kebabKey ? kebabRef : null}>
                      <button
                        type="button"
                        onClick={() => setActiveKebab(activeKebab === kebabKey ? null : kebabKey)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Chapter options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeKebab === kebabKey && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-850 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-30 animate-fadeIn">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveKebab(null);
                              onRenameChapter(ch.number, ch.name);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Rename {itemLabel}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nested Collapsible Topics List */}
                {isExpanded && (
                  <div className="pl-6 pr-2 py-1.5 border-t border-slate-100 dark:border-slate-800/80 space-y-1 bg-slate-50/40 dark:bg-slate-950/30 rounded-b-2xl">
                    {notes.length === 0 ? (
                      <div className="py-2.5 px-2 text-slate-400 text-left">
                        <p className="text-[11px] italic">No topic notes yet</p>
                      </div>
                    ) : (
                      notes.map((note) => {
                        const noteId = note.id;
                        const isTopicSelected = selectedTopicNoteId === noteId;
                        const topicNo = (note as any).topicNumber ?? note.topicNo ?? 1;
                        const topicTitle = (note as any).topicTitle || (note as any).topicName || note.partLabel || `Topic ${topicNo}`;
                        const hasTest = checkIfTopicHasPracticeTest(note);
                        const topicKebabKey = `topic-${noteId}`;

                        return (
                          <div
                            key={noteId}
                            onClick={() => onSelectTopic(note, ch.number, ch.name)}
                            className={`group/t flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer border ${
                              isTopicSelected
                                ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                                : "hover:bg-white dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                            }`}
                            id={`nested-topic-${noteId}`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className={`text-[10px] font-bold ${isTopicSelected ? "text-blue-200" : "text-slate-400"}`}>
                                •
                              </span>
                              <span className="font-semibold truncate">
                                Topic {topicNo}: {topicTitle}
                              </span>
                              {hasTest && (
                                <span className={`text-[9px] px-1 py-0.2 rounded font-extrabold shrink-0 ${
                                  isTopicSelected 
                                    ? "bg-blue-700 text-blue-100" 
                                    : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                                }`}>
                                  Test
                                </span>
                              )}
                            </div>

                            {/* Topic Actions */}
                            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => onDeleteTopic(note)}
                                className={`p-1 rounded-md transition-colors ${
                                  isTopicSelected
                                    ? "text-blue-100 hover:text-white hover:bg-blue-700"
                                    : "text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                }`}
                                title="Delete topic note"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>

                              {/* 3-dots Kebab for Topic Rename */}
                              <div className="relative" ref={activeKebab === topicKebabKey ? kebabRef : null}>
                                <button
                                  type="button"
                                  onClick={() => setActiveKebab(activeKebab === topicKebabKey ? null : topicKebabKey)}
                                  className={`p-1 rounded-md transition-colors ${
                                    isTopicSelected
                                      ? "text-blue-100 hover:text-white hover:bg-blue-700"
                                      : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
                                  }`}
                                  title="Topic options"
                                >
                                  <MoreVertical className="w-3 h-3" />
                                </button>

                                {activeKebab === topicKebabKey && (
                                  <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-850 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-30 animate-fadeIn">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveKebab(null);
                                        onRenameTopic(note);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                      Rename Topic
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* + Add Topic Button under Chapter */}
                    <button
                      type="button"
                      onClick={() => onAddTopic(ch.number, ch.name)}
                      className="w-full mt-1 py-1 px-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      id={`add-topic-btn-ch-${ch.number}`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Add Topic Note</span>
                    </button>
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
