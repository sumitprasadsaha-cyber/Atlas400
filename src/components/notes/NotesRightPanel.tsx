import React from "react";
import { 
  School, 
  GraduationCap, 
  ChevronRight, 
  FileText, 
  Eye, 
  RefreshCw, 
  Trash2, 
  FlaskConical, 
  Plus, 
  HardDrive, 
  Calendar, 
  CheckCircle2, 
  FileCheck,
  ExternalLink,
  Layers,
  Image as ImageIcon
} from "lucide-react";
import { ClassNote } from "../../types";
import TopicCard from "./TopicCard";
import { isImageFile } from "../../lib/nativePdfService";

interface NotesRightPanelProps {
  type: "school" | "upsc";
  selectedClassName: string;
  selectedSubject: string;
  selectedChapterNo: number;
  selectedChapterName: string;
  selectedTopicNote: ClassNote | null;
  chapterTopics: ClassNote[];
  onOpenPreview: (note: ClassNote) => void;
  onOpenReplace: (note: ClassNote) => void;
  onOpenRename: (note: ClassNote) => void;
  onOpenDelete: (note: ClassNote) => void;
  onOpenPracticeTest: (note: ClassNote) => void;
  onUploadNewTopic: () => void;
  checkIfTopicHasPracticeTest: (note: ClassNote) => boolean;
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

export default function NotesRightPanel({
  type,
  selectedClassName,
  selectedSubject,
  selectedChapterNo,
  selectedChapterName,
  selectedTopicNote,
  chapterTopics,
  onOpenPreview,
  onOpenReplace,
  onOpenRename,
  onOpenDelete,
  onOpenPracticeTest,
  onUploadNewTopic,
  checkIfTopicHasPracticeTest,
}: NotesRightPanelProps) {
  const isSchool = type === "school";
  const itemLabel = isSchool ? "Chapter" : "Module";

  return (
    <section className="flex-1 min-h-0 flex flex-col min-w-0 bg-slate-50/60 dark:bg-slate-950/60 overflow-hidden" id="notes-right-panel">
      {/* 1. Breadcrumbs Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 flex-wrap min-w-0">
          <span className="text-slate-900 dark:text-slate-100 font-extrabold flex items-center gap-1">
            {isSchool ? <School className="w-3.5 h-3.5 text-blue-500" /> : <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />}
            {isSchool ? "School" : "UPSC"}
          </span>
          {selectedClassName && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{selectedClassName}</span>
            </>
          )}
          {selectedSubject && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{selectedSubject}</span>
            </>
          )}
          {selectedChapterNo > 0 && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-800 dark:text-slate-200 truncate">
                {itemLabel} {selectedChapterNo}: {selectedChapterName || "General"}
              </span>
            </>
          )}
        </div>

        {/* Quick Add Topic Button in Top Bar */}
        {selectedChapterNo > 0 && (
          <button
            type="button"
            onClick={onUploadNewTopic}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
            id="right-panel-add-topic-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Note</span>
          </button>
        )}
      </div>

      {/* 2. Main Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin overscroll-contain" id="notes-right-content-scroll">
        {!selectedClassName ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
              {isSchool ? <School className="w-7 h-7" /> : <GraduationCap className="w-7 h-7" />}
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No {isSchool ? "Class" : "GS Paper"} Selected
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select or create a {isSchool ? "Class" : "GS Paper"} in the left panel to begin.
            </p>
          </div>
        ) : !selectedSubject ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Select a Subject
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Choose a subject from the left panel to explore chapters and notes.
            </p>
          </div>
        ) : selectedChapterNo <= 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Select a {itemLabel}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Choose a {itemLabel.toLowerCase()} from the middle panel to view its topic notes.
            </p>
          </div>
        ) : selectedTopicNote ? (
          /* =========================================================================
             SELECTED TOPIC NOTE DETAILED VIEW
             ========================================================================= */
          <div className="space-y-4" id={`selected-topic-view-${selectedTopicNote.id}`}>
            {/* Topic Header Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Topic {(selectedTopicNote as any).topicNumber ?? selectedTopicNote.topicNo ?? 1}
                    </span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 truncate">
                      {(selectedTopicNote as any).topicTitle || (selectedTopicNote as any).topicName || selectedTopicNote.partLabel || "Topic Note"}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {selectedClassName} • {selectedSubject} • {itemLabel} {selectedChapterNo}: {selectedChapterName}
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onOpenPreview(selectedTopicNote)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    id="topic-view-fullscreen-btn"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Note</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenReplace(selectedTopicNote)}
                    className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    id="topic-replace-btn"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Replace</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenPracticeTest(selectedTopicNote)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      checkIfTopicHasPracticeTest(selectedTopicNote)
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                    }`}
                    id="topic-practice-test-btn"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>{checkIfTopicHasPracticeTest(selectedTopicNote) ? "Edit Test" : "+ Practice Test"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenDelete(selectedTopicNote)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-all cursor-pointer"
                    title="Delete topic note"
                    id="topic-delete-btn"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Metadata Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">File Format</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">
                    {(selectedTopicNote.fileName?.split(".").pop() || "PDF").toUpperCase()}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">File Size</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                    {formatBytes((selectedTopicNote as any).fileSize || (selectedTopicNote as any).file_size)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Storage</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Cloudflare R2
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Uploaded</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
                    {formatDate((selectedTopicNote as any).createdAt || (selectedTopicNote as any).uploadedAt) || "Recently"}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Viewer Frame */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>Document Quick Preview</span>
                </h4>
                <button
                  type="button"
                  onClick={() => onOpenPreview(selectedTopicNote)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                >
                  <span>Fullscreen Viewer</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {(selectedTopicNote as any).pdfDataUrl || (selectedTopicNote as any).downloadUrl || (selectedTopicNote as any).r2Url ? (
                <div className="h-96 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center relative group">
                  {isImageFile(selectedTopicNote.fileName || "doc.pdf") ? (
                    <img 
                      src={(selectedTopicNote as any).pdfDataUrl || (selectedTopicNote as any).downloadUrl || (selectedTopicNote as any).r2Url} 
                      alt="Note" 
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <iframe
                      src={`${(selectedTopicNote as any).pdfDataUrl || (selectedTopicNote as any).downloadUrl || (selectedTopicNote as any).r2Url}#toolbar=0`}
                      className="w-full h-full border-0"
                      title="PDF Preview"
                    />
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-850 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {selectedTopicNote.fileName || "Note Document"}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenPreview(selectedTopicNote)}
                    className="mt-2.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open in Document Viewer</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : chapterTopics.length === 0 ? (
          /* Empty Topics in Chapter */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto" id="empty-chapter-topics-state">
            <div 
              onClick={onUploadNewTopic}
              className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/60 border-2 border-dashed border-blue-400 dark:border-blue-700 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 cursor-pointer transition-transform hover:scale-110 shadow-sm"
              title="Upload Topic Note"
            >
              <Plus className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No topic notes in {itemLabel} {selectedChapterNo}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Click below to upload the first topic note for {selectedChapterName || `${itemLabel} ${selectedChapterNo}`}.
            </p>
            <button
              type="button"
              onClick={onUploadNewTopic}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Topic Note</span>
            </button>
          </div>
        ) : (
          /* Chapter Topics Overview Cards List */
          <div className="space-y-3" id="chapter-topics-cards-list">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {itemLabel} {selectedChapterNo} Topic Notes ({chapterTopics.length})
              </h3>
            </div>
            {chapterTopics.map((note) => (
              <TopicCard
                key={note.id}
                note={note}
                topicNumber={(note as any).topicNumber ?? note.topicNo}
                topicTitle={(note as any).topicTitle || (note as any).topicName || note.partLabel}
                isAdmin={true}
                hasPracticeTest={checkIfTopicHasPracticeTest(note)}
                onPreview={(n) => onOpenPreview(n as ClassNote)}
                onReplace={(n) => onOpenReplace(n as ClassNote)}
                onRename={(n) => onOpenRename(n as ClassNote)}
                onDelete={(n) => onOpenDelete(n as ClassNote)}
                onOpenPracticeTest={(n) => onOpenPracticeTest(n as ClassNote)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
