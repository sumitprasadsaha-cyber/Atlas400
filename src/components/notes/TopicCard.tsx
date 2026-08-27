import React, { useState, useRef, useEffect } from "react";
import { 
  FileText, 
  Image as ImageIcon, 
  Eye, 
  RefreshCw, 
  Trash2, 
  FlaskConical,
  PlusCircle,
  HardDrive,
  Calendar,
  MoreVertical,
  FileCheck,
  Edit3
} from "lucide-react";
import { ClassNote, ChapterNote } from "../../types";
import { isImageFile } from "../../lib/nativePdfService";

interface TopicCardProps {
  note: ClassNote | ChapterNote;
  topicNumber?: number | string;
  topicTitle?: string;
  isAdmin?: boolean;
  onPreview: (note: ClassNote | ChapterNote) => void;
  onReplace?: (note: ClassNote | ChapterNote) => void;
  onRename?: (note: ClassNote | ChapterNote) => void;
  onDelete?: (note: ClassNote | ChapterNote) => void;
  onOpenPracticeTest?: (note: ClassNote | ChapterNote) => void;
  hasPracticeTest?: boolean;
  isOpening?: boolean;
  className?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "--";
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

export default function TopicCard({
  note,
  topicNumber,
  topicTitle,
  isAdmin = true,
  onPreview,
  onReplace,
  onRename,
  onDelete,
  onOpenPracticeTest,
  hasPracticeTest = false,
  isOpening = false,
  className = "",
}: TopicCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const rawFilename = note.fileName || note.pdfFileName || (note as any).originalFilename || "note.pdf";
  const isImg = isImageFile(rawFilename);

  // Topic display calculation
  const rawTopicNo = topicNumber ?? (note as any).topicNumber ?? (note as any).topicNo;
  const paddedNo = rawTopicNo !== undefined && rawTopicNo !== null && String(rawTopicNo).trim() !== ""
    ? String(rawTopicNo).padStart(2, "0")
    : null;

  const rawTopicName = topicTitle ?? (note as any).topicTitle ?? (note as any).topicName ?? note.partLabel ?? "";
  const displayTitle = rawTopicName || (paddedNo ? `Topic ${paddedNo}` : "Topic Note");
  const fileSizeStr = formatBytes((note as any).fileSize || (note as any).file_size);
  const dateStr = formatDate((note as any).createdAt || (note as any).uploadedAt);
  const fileExt = (rawFilename.split(".").pop() || "PDF").toUpperCase();

  return (
    <div
      className={`group relative rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 p-3.5 sm:p-4 transition-all duration-200 hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 ${
        isOpening ? "ring-2 ring-blue-500/50 pointer-events-none opacity-90" : ""
      } ${className}`}
      id={`topic-card-${note.id}`}
    >
      {/* Left Section: Topic Number badge, Icon, Title, and File info */}
      <div 
        onClick={() => onPreview(note)}
        className="flex items-start sm:items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
        title="Click to view document preview"
      >
        {/* Topic Number Pill with document icon */}
        <div className="shrink-0 flex items-center">
          <span className="inline-flex items-center gap-1 min-w-[4.25rem] px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/70 shadow-2xs">
            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Topic {paddedNo || "01"}</span>
          </span>
        </div>

        {/* Title & Metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors break-words leading-tight">
              {displayTitle}
            </h4>

            {hasPracticeTest && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70">
                <FileCheck className="w-3 h-3" /> Test Ready
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            {/* File format chip */}
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
              isImg
                ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300"
                : "bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-900/60"
            }`}>
              {fileExt}
            </span>

            {/* Original filename */}
            <span className="truncate max-w-[180px] sm:max-w-[240px] font-medium text-slate-600 dark:text-slate-300" title={rawFilename}>
              {rawFilename}
            </span>

            {/* Size */}
            {fileSizeStr !== "--" && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <HardDrive className="w-3 h-3" />
                {fileSizeStr}
              </span>
            )}

            {/* Uploaded date */}
            {dateStr && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Calendar className="w-3 h-3" />
                Uploaded {dateStr}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Section: Topic Card Action Buttons */}
      <div 
        className="flex items-center gap-1 sm:gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 justify-end flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. 👁 View */}
        <button
          type="button"
          onClick={() => onPreview(note)}
          className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all border border-slate-200/70 dark:border-slate-800/80 flex items-center gap-1 cursor-pointer"
          title="View document"
          aria-label="View document"
          id={`view-btn-${note.id}`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">View</span>
        </button>

        {/* 2. 🧪 / ➕ Practice Test */}
        {onOpenPracticeTest && (
          <button
            type="button"
            onClick={() => onOpenPracticeTest(note)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
              hasPracticeTest
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/70"
                : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
            title={hasPracticeTest ? "Edit Practice Test" : "Add Practice Test"}
            aria-label={hasPracticeTest ? "Edit Practice Test" : "Add Practice Test"}
            id={`practice-test-btn-${note.id}`}
          >
            {hasPracticeTest ? (
              <>
                <FlaskConical className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Edit Test</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>+ Test</span>
              </>
            )}
          </button>
        )}

        {/* 3. 🗑 Delete */}
        {isAdmin && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(note)}
            className="p-1.5 sm:px-2 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-all border border-transparent hover:border-rose-200/60 dark:hover:border-rose-900/60 flex items-center gap-1 cursor-pointer"
            title="Delete topic note"
            aria-label="Delete topic note"
            id={`delete-btn-${note.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Delete</span>
          </button>
        )}

        {/* 4. More actions (Kebab Context Menu for Rename & Replace) */}
        {isAdmin && (onRename || onReplace) && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent"
              title="More actions"
              aria-label="More actions"
              id={`more-btn-${note.id}`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-850 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-30 animate-fadeIn">
                {onRename && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onRename(note);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    Rename
                  </button>
                )}
                {onReplace && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onReplace(note);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    Replace File
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
