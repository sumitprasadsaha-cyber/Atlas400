import React, { useState } from "react";
import { 
  FileText, 
  Image as ImageIcon, 
  Eye, 
  RefreshCw, 
  Pencil, 
  Trash2, 
  FlaskConical,
  PlusCircle,
  HardDrive,
  Calendar,
  Loader2,
  FileCheck
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

  return (
    <div
      className={`group relative rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isOpening ? "ring-2 ring-blue-500/50 pointer-events-none opacity-90" : ""
      } ${className}`}
      id={`topic-card-${note.id}`}
    >
      {/* Left Section: Topic Number badge, Icon, Title, and File info */}
      <div 
        onClick={() => onPreview(note)}
        className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1 cursor-pointer select-none"
        title="Click to view document preview"
      >
        {/* Topic Number Pill */}
        <div className="shrink-0 flex flex-col items-center justify-center">
          {paddedNo ? (
            <span className="inline-flex items-center justify-center min-w-[3.25rem] px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/70">
              Topic {paddedNo}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center px-2 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Topic
            </span>
          )}
        </div>

        {/* File Type Icon */}
        <div className={`p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-105 ${
          isImg 
            ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40"
            : "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40"
        }`}>
          {isOpening ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : isImg ? (
            <ImageIcon className="w-5 h-5" />
          ) : (
            <FileText className="w-5 h-5" />
          )}
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

          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="truncate max-w-[220px] font-medium text-slate-600 dark:text-slate-300" title={rawFilename}>
              {rawFilename}
            </span>
            {fileSizeStr !== "--" && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <HardDrive className="w-3 h-3" />
                {fileSizeStr}
              </span>
            )}
            {dateStr && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Calendar className="w-3 h-3" />
                {dateStr}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Section: Topic Card Action Icons (View, Replace, Rename, Practice Test, Delete) */}
      <div 
        className="flex items-center gap-1.5 sm:gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. 👁 View */}
        <button
          type="button"
          onClick={() => onPreview(note)}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all border border-transparent hover:border-blue-200/60 dark:hover:border-blue-900/60"
          title="View document"
          aria-label="View document"
          id={`view-btn-${note.id}`}
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* 2. ✏ Replace */}
        {isAdmin && onReplace && (
          <button
            type="button"
            onClick={() => onReplace(note)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-all border border-transparent hover:border-indigo-200/60 dark:hover:border-indigo-900/60"
            title="Replace file"
            aria-label="Replace file"
            id={`replace-btn-${note.id}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* 3. 📝 Rename */}
        {isAdmin && onRename && (
          <button
            type="button"
            onClick={() => onRename(note)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-all border border-transparent hover:border-amber-200/60 dark:hover:border-amber-900/60"
            title="Rename topic"
            aria-label="Rename topic"
            id={`rename-btn-${note.id}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {/* 4. 🧪 / ➕ Practice Test */}
        {onOpenPracticeTest && (
          <button
            type="button"
            onClick={() => onOpenPracticeTest(note)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              hasPracticeTest
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/70"
                : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
            title={hasPracticeTest ? "Edit Practice Test" : "Add Practice Test"}
            aria-label={hasPracticeTest ? "Edit Practice Test" : "Add Practice Test"}
            id={`practice-test-btn-${note.id}`}
          >
            {hasPracticeTest ? (
              <>
                <FlaskConical className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden md:inline">Edit Test</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="hidden md:inline">Add Test</span>
              </>
            )}
          </button>
        )}

        {/* 5. 🗑 Delete */}
        {isAdmin && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(note)}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-all border border-transparent hover:border-rose-200/60 dark:hover:border-rose-900/60"
            title="Delete topic note"
            aria-label="Delete topic note"
            id={`delete-btn-${note.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
