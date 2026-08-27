import React, { useState, useRef, useEffect } from "react";
import { 
  FileText, 
  Image as ImageIcon, 
  MoreVertical, 
  Eye, 
  RefreshCw, 
  Pencil, 
  Trash2, 
  Download, 
  Link as LinkIcon, 
  Check, 
  FileCheck, 
  Sparkles,
  Calendar,
  HardDrive,
  Loader2,
  Play
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
  onDownload?: (note: ClassNote | ChapterNote) => void;
  onTakeTest?: (note: ClassNote | ChapterNote) => void;
  hasPracticeTest?: boolean;
  testScoreInfo?: {
    highestScore?: number;
    totalQuestions?: number;
    percentage?: number;
  } | null;
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
  isAdmin = false,
  onPreview,
  onReplace,
  onRename,
  onDelete,
  onDownload,
  onTakeTest,
  hasPracticeTest = false,
  testScoreInfo = null,
  isOpening = false,
  className = "",
}: TopicCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = note.pdfUrl || (note as any).publicUrl || (note as any).downloadUrl || window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setMenuOpen(false);
      }, 1500);
    }).catch(() => {});
  };

  const handleDirectDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (onDownload) {
      onDownload(note);
    } else {
      const url = note.pdfUrl || (note as any).publicUrl || "";
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = rawFilename;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  return (
    <div
      className={`group relative rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-700/60 flex flex-col justify-between gap-3.5 ${
        isOpening ? "ring-2 ring-blue-500/50 pointer-events-none opacity-90" : ""
      } ${className}`}
      id={`topic-card-${note.id}`}
    >
      {/* Top Row: Topic Badge + Menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {paddedNo ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/60">
              Topic {paddedNo}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Note
            </span>
          )}

          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
            isImg 
              ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40"
              : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40"
          }`}>
            {isImg ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
            {isImg ? "Image" : "PDF"}
          </span>

          {hasPracticeTest && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              <FileCheck className="w-3 h-3" /> Practice Test
            </span>
          )}
        </div>

        {/* Action Menu (Admin or Student) */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Topic options"
            id={`topic-menu-btn-${note.id}`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div 
              className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30 text-xs font-semibold text-slate-700 dark:text-slate-200 animate-fadeIn"
              id={`topic-dropdown-${note.id}`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onPreview(note);
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-blue-500" /> View / Preview
              </button>

              {isAdmin && onReplace && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onReplace(note);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-500" /> Replace File
                </button>
              )}

              {isAdmin && onRename && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onRename(note);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-amber-500" /> Rename / Edit
                </button>
              )}

              <button
                type="button"
                onClick={handleDirectDownload}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" /> Download
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3.5 h-3.5 text-slate-500" /> Copy Link
                  </>
                )}
              </button>

              {isAdmin && onDelete && (
                <div className="border-t border-slate-100 dark:border-slate-700 my-1 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete(note);
                    }}
                    className="w-full px-3 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Topic
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Body: Title & File info (Clickable to preview) */}
      <div 
        onClick={() => onPreview(note)}
        className="flex items-start gap-3 cursor-pointer group/title select-none"
        title="Click to preview note"
      >
        <div className={`p-2.5 rounded-xl shrink-0 transition-transform group-hover/title:scale-105 ${
          isImg 
            ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"
            : "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30"
        }`}>
          {isOpening ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : isImg ? (
            <ImageIcon className="w-5 h-5" />
          ) : (
            <FileText className="w-5 h-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug group-hover/title:text-blue-600 dark:group-hover/title:text-blue-400 transition-colors break-words">
            {displayTitle}
          </h4>
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5" title={rawFilename}>
            {rawFilename}
          </p>
        </div>
      </div>

      {/* Meta Footer & Optional Practice Test Action */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3 truncate">
          {fileSizeStr !== "--" && (
            <span className="flex items-center gap-1" title="File Size">
              <HardDrive className="w-3 h-3 text-slate-400" />
              {fileSizeStr}
            </span>
          )}
          {dateStr && (
            <span className="flex items-center gap-1" title="Upload Date">
              <Calendar className="w-3 h-3 text-slate-400" />
              {dateStr}
            </span>
          )}
        </div>

        {/* Practice test trigger */}
        {hasPracticeTest && onTakeTest && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTakeTest(note);
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800/80 transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
            id={`take-test-btn-${note.id}`}
          >
            <Play className="w-3 h-3 fill-current" />
            {testScoreInfo?.highestScore !== undefined ? (
              <span>Best: {testScoreInfo.highestScore}/{testScoreInfo.totalQuestions || "?"}</span>
            ) : (
              <span>Take Test</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
