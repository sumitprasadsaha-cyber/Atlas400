import React, { useState, useMemo, useRef } from "react";
import { useNotes } from "../hooks/useNotes";
import {
  FileText,
  Download,
  ExternalLink,
  Clock,
  Search,
  Filter,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Edit3,
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Share2,
  Layers,
  Sparkles,
  Tag,
  ArrowUpDown,
} from "lucide-react";
import { formatBytes, formatDisplayDate } from "../../../shared/utils";
import { Note, NoteUploadPayload, NoteReplacePayload, NoteUpdateMetadataPayload } from "../../../shared/types/notes.types";
import { SUPPORTED_NOTE_EXTENSIONS, MAX_NOTE_FILE_SIZE_BYTES } from "../../../shared/validation/note.validator";

interface NotesContainerProps {
  currentUserId?: string;
  userRole?: "admin" | "student" | "teacher" | string;
  initialBatch?: string;
  initialSubject?: string;
  onBack?: () => void;
}

export const NotesContainer: React.FC<NotesContainerProps> = ({
  currentUserId = "current-user",
  userRole = "admin",
  initialBatch,
  initialSubject,
  onBack,
}) => {
  const isAdmin = userRole === "admin" || userRole === "super_admin";

  const {
    notes,
    isLoading,
    isUploading,
    isDeleting,
    isReplacing,
    error,
    filters,
    updateFilters,
    resetFilters,
    refresh,
    uploadNote,
    replaceNoteFile,
    updateMetadata,
    toggleVisibility,
    deleteNote,
    openNote,
  } = useNotes({
    initialFilters: {
      batch: initialBatch || "all",
      subject: initialSubject || "all",
      sortBy: "newest",
    },
    realtime: true,
  });

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || "all");
  const [selectedBatch, setSelectedBatch] = useState<string>(initialBatch || "all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "recentlyUpdated" | "downloads" | "title">("newest");

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [noteToReplace, setNoteToReplace] = useState<Note | null>(null);
  const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadSubject, setUploadSubject] = useState("Mathematics");
  const [customSubject, setCustomSubject] = useState("");
  const [uploadBatch, setUploadBatch] = useState("Class 10");
  const [customBatch, setCustomBatch] = useState("");
  const [uploadChapter, setUploadChapter] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Replace Form State
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replaceError, setReplaceError] = useState("");
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Edit Metadata State
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editChapter, setEditChapter] = useState("");
  const [editBatch, setEditBatch] = useState("");
  const [editTags, setEditTags] = useState("");

  // Extracted unique filter lists
  const availableSubjects = useMemo(() => {
    const subs = new Set<string>();
    subs.add("Mathematics");
    subs.add("Science");
    subs.add("Physics");
    subs.add("Chemistry");
    subs.add("Biology");
    subs.add("English");
    subs.add("Computer Science");
    subs.add("Social Science");
    subs.add("History");
    subs.add("Geography");
    subs.add("Polity");
    subs.add("Economy");
    notes.forEach((n) => {
      if (n.subject) subs.add(n.subject);
    });
    return Array.from(subs);
  }, [notes]);

  const availableBatches = useMemo(() => {
    const batches = new Set<string>();
    batches.add("All Batches");
    batches.add("Class 9");
    batches.add("Class 10");
    batches.add("Class 11");
    batches.add("Class 12");
    batches.add("UPSC GS Foundation");
    notes.forEach((n) => {
      if (n.batch) batches.add(n.batch);
    });
    return Array.from(batches);
  }, [notes]);

  // Sync search & filters to hook
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    updateFilters({ searchQuery: q });
  };

  const handleSubjectChange = (sub: string) => {
    setSelectedSubject(sub);
    updateFilters({ subject: sub });
  };

  const handleBatchChange = (bat: string) => {
    setSelectedBatch(bat);
    updateFilters({ batch: bat });
  };

  const handleSortChange = (sort: typeof sortBy) => {
    setSortBy(sort);
    updateFilters({ sortBy: sort });
  };

  // Upload handler
  const handlePerformUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");

    if (!uploadTitle.trim()) {
      setUploadError("Please provide a note title.");
      return;
    }

    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    const effectiveSubject = uploadSubject === "custom" ? customSubject.trim() : uploadSubject;
    if (!effectiveSubject) {
      setUploadError("Please specify a subject.");
      return;
    }

    const effectiveBatch = uploadBatch === "custom" ? customBatch.trim() : uploadBatch;

    try {
      const tagsArray = uploadTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: NoteUploadPayload = {
        title: uploadTitle.trim(),
        description: uploadDescription.trim(),
        subject: effectiveSubject,
        chapter: uploadChapter.trim(),
        batch: effectiveBatch,
        tags: tagsArray,
        file: selectedFile,
        originalFileName: selectedFile.name,
        mimeType: selectedFile.type,
      };

      await uploadNote(payload, currentUserId, userRole);

      setFeedbackMsg({ type: "success", text: `Note "${uploadTitle}" uploaded successfully to Cloudflare R2!` });
      setIsUploadModalOpen(false);
      resetUploadForm();
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload note.");
    }
  };

  const resetUploadForm = () => {
    setUploadTitle("");
    setUploadDescription("");
    setUploadChapter("");
    setUploadTags("");
    setSelectedFile(null);
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Replace handler
  const handlePerformReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteToReplace || !replacementFile) {
      setReplaceError("Please select a replacement file.");
      return;
    }

    try {
      const payload: NoteReplacePayload = {
        noteId: noteToReplace.id,
        file: replacementFile,
        originalFileName: replacementFile.name,
        mimeType: replacementFile.type,
      };

      await replaceNoteFile(payload, currentUserId, userRole);

      setFeedbackMsg({
        type: "success",
        text: `File for "${noteToReplace.title}" replaced successfully. Previous binary removed from R2.`,
      });
      setNoteToReplace(null);
      setReplacementFile(null);
      setReplaceError("");
    } catch (err: any) {
      setReplaceError(err.message || "Failed to replace note file.");
    }
  };

  // Edit metadata handler
  const handleOpenEdit = (note: Note) => {
    setNoteToEdit(note);
    setEditTitle(note.title);
    setEditDescription(note.description || "");
    setEditSubject(note.subject);
    setEditChapter(note.chapter || "");
    setEditBatch(note.batch || "");
    setEditTags(Array.isArray(note.tags) ? note.tags.join(", ") : "");
  };

  const handlePerformEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteToEdit || !editTitle.trim()) return;

    try {
      const tagsArray = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: NoteUpdateMetadataPayload = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        subject: editSubject.trim(),
        chapter: editChapter.trim(),
        batch: editBatch.trim(),
        tags: tagsArray,
      };

      await updateMetadata(noteToEdit.id, payload, currentUserId, userRole);

      setFeedbackMsg({ type: "success", text: `Metadata for "${editTitle}" updated successfully.` });
      setNoteToEdit(null);
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Failed to update metadata." });
    }
  };

  // Delete handler
  const handlePerformDelete = async () => {
    if (!noteToDelete) return;
    try {
      await deleteNote(noteToDelete.id, currentUserId, userRole);
      setFeedbackMsg({ type: "success", text: `Note "${noteToDelete.title}" and R2 object deleted permanently.` });
      setNoteToDelete(null);
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Failed to delete note." });
    }
  };

  // File icon helper
  const renderFileIcon = (ext: string, mime: string) => {
    const cleanExt = (ext || "").toLowerCase();
    if (cleanExt === "pdf" || mime?.includes("pdf")) {
      return <FileText className="w-5 h-5 text-rose-600" />;
    }
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(cleanExt) || mime?.startsWith("image/")) {
      return <ImageIcon className="w-5 h-5 text-emerald-600" />;
    }
    if (["doc", "docx"].includes(cleanExt) || mime?.includes("word")) {
      return <FileCode className="w-5 h-5 text-blue-600" />;
    }
    if (["xls", "xlsx"].includes(cleanExt) || mime?.includes("spreadsheet") || mime?.includes("excel")) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-700" />;
    }
    if (["zip", "rar", "7z"].includes(cleanExt) || mime?.includes("zip")) {
      return <FileArchive className="w-5 h-5 text-amber-600" />;
    }
    return <FileText className="w-5 h-5 text-indigo-600" />;
  };

  return (
    <div id="notes-module-root" className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          id="notes-feedback-toast"
          className={`flex items-center justify-between p-4 rounded-xl shadow-sm text-sm transition-all ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedbackMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            id="dismiss-feedback-toast-btn"
            onClick={() => setFeedbackMsg(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Controls Bar */}
      <div id="notes-header-bar" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              {onBack && (
                <button
                  id="notes-back-btn"
                  onClick={onBack}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                  title="Back"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Study Notes Repository</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Phase 3 • Cloudflare R2
              </span>
            </div>
            <p className="text-sm text-slate-500">
              High-speed, encrypted notes delivered via temporary signed URLs directly into native viewers.
            </p>
          </div>

          {/* Admin Upload Action */}
          <div className="flex items-center space-x-3">
            <button
              id="notes-refresh-btn"
              onClick={() => refresh()}
              disabled={isLoading}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-50"
              title="Refresh notes list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            {isAdmin && (
              <button
                id="notes-upload-modal-trigger-btn"
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition active:scale-[0.99] space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Upload New Note</span>
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          {/* Search Box */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="notes-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search title, chapter, tag, subject..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
            {searchQuery && (
              <button
                id="clear-notes-search-btn"
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subject Filter */}
          <div className="lg:col-span-3">
            <select
              id="notes-subject-filter-select"
              value={selectedSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="all">All Subjects</option>
              {availableSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div className="lg:col-span-3">
            <select
              id="notes-batch-filter-select"
              value={selectedBatch}
              onChange={(e) => handleBatchChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="all">All Batches / Classes</option>
              {availableBatches.map((bat) => (
                <option key={bat} value={bat}>
                  {bat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="lg:col-span-2">
            <select
              id="notes-sort-select"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="recentlyUpdated">Recently Updated</option>
              <option value="downloads">Most Downloaded</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && notes.length === 0 && (
        <div id="notes-loading-state" className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="text-sm font-medium">Synchronizing notes with Cloudflare R2...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div id="notes-error-banner" className="p-5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Notes sync notice</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Notes Grid */}
      {!isLoading && notes.length === 0 ? (
        <div id="notes-empty-state" className="text-center py-16 px-4 bg-white border border-dashed border-slate-300 rounded-2xl space-y-4">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-800">No notes found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedSubject !== "all" || selectedBatch !== "all"
                ? "No study notes match your active filters. Try adjusting search or clearing filters."
                : "No study notes have been cataloged yet. Admins can upload new notes at any time."}
            </p>
          </div>
          {(searchQuery || selectedSubject !== "all" || selectedBatch !== "all") && (
            <button
              id="clear-all-notes-filters-btn"
              onClick={() => {
                setSearchQuery("");
                setSelectedSubject("all");
                setSelectedBatch("all");
                resetFilters();
              }}
              className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div id="notes-grid-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => {
            const isNoteBusy = isDeleting === note.id || isReplacing === note.id;

            return (
              <div
                key={note.id}
                id={`note-card-${note.id}`}
                className={`bg-white border rounded-2xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between space-y-4 ${
                  !note.isVisible ? "border-amber-200 bg-amber-50/20" : "border-slate-200 hover:border-indigo-300"
                }`}
              >
                {/* Top Section */}
                <div className="space-y-3">
                  {/* Badges Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 truncate max-w-[130px]">
                        {note.subject}
                      </span>
                      {note.batch && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 truncate max-w-[110px]">
                          {note.batch}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      {note.version && note.version > 1 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          v{note.version}
                        </span>
                      )}
                      {!note.isVisible && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                          Hidden
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title and Icon */}
                  <div
                    onClick={() => openNote(note, currentUserId, userRole)}
                    className="flex items-start space-x-3 cursor-pointer group"
                  >
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl group-hover:bg-indigo-50 group-hover:border-indigo-100 transition shrink-0">
                      {renderFileIcon(note.extension, note.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition line-clamp-2">
                        {note.title}
                      </h3>
                      {note.chapter && (
                        <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                          Chapter: {note.chapter}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description if present */}
                  {note.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                      {note.description}
                    </p>
                  )}

                  {/* Tags */}
                  {Array.isArray(note.tags) && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {note.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600"
                        >
                          #{tag}
                        </span>
                      ))}
                      {note.tags.length > 3 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{note.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Metadata & Action Bar */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center space-x-2">
                      <span>{formatBytes(note.size || note.fileSize)}</span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDisplayDate(note.uploadedAt || (note as any).createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 text-slate-500 font-medium">
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>{note.downloadCount || 0}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Primary Open/Download Button */}
                    <button
                      id={`open-note-btn-${note.id}`}
                      type="button"
                      disabled={isNoteBusy}
                      onClick={() => openNote(note, currentUserId, userRole)}
                      className="flex-1 inline-flex items-center justify-center px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition space-x-1.5 disabled:opacity-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Native Viewer</span>
                    </button>

                    {/* Admin Action Menu */}
                    {isAdmin && (
                      <div className="flex items-center space-x-1">
                        {/* Replace File */}
                        <button
                          id={`replace-note-btn-${note.id}`}
                          type="button"
                          onClick={() => {
                            setNoteToReplace(note);
                            setReplaceError("");
                          }}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                          title="Replace binary file (Cloudflare R2)"
                        >
                          <UploadCloud className="w-4 h-4" />
                        </button>

                        {/* Edit Metadata */}
                        <button
                          id={`edit-note-btn-${note.id}`}
                          type="button"
                          onClick={() => handleOpenEdit(note)}
                          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                          title="Edit note metadata"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Toggle Visibility */}
                        <button
                          id={`toggle-visibility-btn-${note.id}`}
                          type="button"
                          onClick={() => toggleVisibility(note.id, !note.isVisible, currentUserId, userRole)}
                          className={`p-2 rounded-xl transition ${
                            note.isVisible
                              ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                              : "text-amber-600 bg-amber-50 hover:bg-amber-100"
                          }`}
                          title={note.isVisible ? "Hide from students" : "Publish to students"}
                        >
                          {note.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>

                        {/* Delete Note */}
                        <button
                          id={`delete-note-btn-${note.id}`}
                          type="button"
                          onClick={() => setNoteToDelete(note)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                          title="Delete note and R2 file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. UPLOAD NOTE MODAL                                      */}
      {/* ========================================================= */}
      {isUploadModalOpen && (
        <div id="upload-note-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Upload New Study Note</h2>
                  <p className="text-xs text-slate-500">Binary stored in Cloudflare R2 • Metadata in Firestore</p>
                </div>
              </div>
              <button
                id="close-upload-modal-btn"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  resetUploadForm();
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handlePerformUpload} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Document Title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="note-upload-title-input"
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Chapter 4: Quadratic Equations Comprehensive Notes"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Subject & Batch row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Subject <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="note-upload-subject-select"
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {availableSubjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                    <option value="custom">+ Custom Subject...</option>
                  </select>
                  {uploadSubject === "custom" && (
                    <input
                      id="note-upload-custom-subject-input"
                      type="text"
                      placeholder="Enter custom subject"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      className="mt-2 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Batch / Class
                  </label>
                  <select
                    id="note-upload-batch-select"
                    value={uploadBatch}
                    onChange={(e) => setUploadBatch(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {availableBatches.map((bat) => (
                      <option key={bat} value={bat}>
                        {bat}
                      </option>
                    ))}
                    <option value="custom">+ Custom Batch...</option>
                  </select>
                  {uploadBatch === "custom" && (
                    <input
                      id="note-upload-custom-batch-input"
                      type="text"
                      placeholder="Enter custom batch"
                      value={customBatch}
                      onChange={(e) => setCustomBatch(e.target.value)}
                      className="mt-2 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  )}
                </div>
              </div>

              {/* Chapter & Tags row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Chapter / Unit
                  </label>
                  <input
                    id="note-upload-chapter-input"
                    type="text"
                    value={uploadChapter}
                    onChange={(e) => setUploadChapter(e.target.value)}
                    placeholder="e.g., Chapter 4: Polynomials"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tags (Comma-separated)
                  </label>
                  <input
                    id="note-upload-tags-input"
                    type="text"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    placeholder="e.g., algebra, formulas, 2026-exam"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Summary / Instructions
                </label>
                <textarea
                  id="note-upload-description-input"
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Provide concise study instructions, key highlights, or page references..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Attachment File <span className="text-rose-500">*</span> (Max 50MB)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                    selectedFile
                      ? "border-indigo-400 bg-indigo-50/40"
                      : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
                  }`}
                >
                  <input
                    id="note-file-picker"
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-center space-x-2 text-indigo-700 font-semibold text-sm">
                        <FileText className="w-5 h-5" />
                        <span>{selectedFile.name}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatBytes(selectedFile.size)} • Click to replace file
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-sm font-medium text-slate-700">
                        Click to select or drag document here
                      </p>
                      <p className="text-xs text-slate-400">
                        PDF, Images (PNG, JPG, WEBP), Office Docs (Word, PPT, Excel), ZIP
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  id="cancel-upload-modal-btn"
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    resetUploadForm();
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  id="submit-note-upload-btn"
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50 space-x-2"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading to R2...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload Note</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. REPLACE NOTE FILE MODAL                                */}
      {/* ========================================================= */}
      {noteToReplace && (
        <div id="replace-note-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Replace Note Document</h2>
                  <p className="text-xs text-slate-500">Atomic swap in R2 • Auto-increments to v{(noteToReplace.version || 1) + 1}</p>
                </div>
              </div>
              <button
                id="close-replace-modal-btn"
                onClick={() => setNoteToReplace(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <p className="font-semibold text-slate-900">{noteToReplace.title}</p>
              <p className="text-slate-500">Current file: {noteToReplace.originalFileName || noteToReplace.fileName}</p>
              <p className="text-slate-500">Current R2 key: {noteToReplace.r2ObjectKey || noteToReplace.storageKey}</p>
            </div>

            {replaceError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{replaceError}</span>
              </div>
            )}

            <form onSubmit={handlePerformReplace} className="space-y-4">
              <div
                onClick={() => replaceInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  replacementFile
                    ? "border-purple-400 bg-purple-50/40"
                    : "border-slate-300 hover:border-purple-400 hover:bg-slate-50"
                }`}
              >
                <input
                  id="replace-file-picker"
                  type="file"
                  ref={replaceInputRef}
                  onChange={(e) => setReplacementFile(e.target.files?.[0] || null)}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                  className="hidden"
                />
                {replacementFile ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center space-x-2 text-purple-700 font-semibold text-sm">
                      <FileText className="w-5 h-5" />
                      <span>{replacementFile.name}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatBytes(replacementFile.size)} • Ready to swap
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm font-medium text-slate-700">Select replacement file</p>
                    <p className="text-xs text-slate-400">PDF, Images, Word, PPT, Excel, ZIP (Max 50MB)</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  id="cancel-replace-btn"
                  type="button"
                  disabled={isReplacing === noteToReplace.id}
                  onClick={() => setNoteToReplace(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  id="submit-note-replace-btn"
                  type="submit"
                  disabled={isReplacing === noteToReplace.id || !replacementFile}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50 space-x-2"
                >
                  {isReplacing === noteToReplace.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Swapping in R2...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Execute Safe Replacement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. EDIT NOTE METADATA MODAL                               */}
      {/* ========================================================= */}
      {noteToEdit && (
        <div id="edit-note-metadata-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Edit Note Metadata</h2>
                  <p className="text-xs text-slate-500">Update cataloging information in Firestore</p>
                </div>
              </div>
              <button
                id="close-edit-modal-btn"
                onClick={() => setNoteToEdit(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePerformEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Title
                </label>
                <input
                  id="edit-note-title-input"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Subject
                  </label>
                  <input
                    id="edit-note-subject-input"
                    type="text"
                    required
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Batch / Class
                  </label>
                  <input
                    id="edit-note-batch-input"
                    type="text"
                    value={editBatch}
                    onChange={(e) => setEditBatch(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Chapter / Topic
                </label>
                <input
                  id="edit-note-chapter-input"
                  type="text"
                  value={editChapter}
                  onChange={(e) => setEditChapter(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tags
                </label>
                <input
                  id="edit-note-tags-input"
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  id="edit-note-description-input"
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  id="cancel-edit-metadata-btn"
                  type="button"
                  onClick={() => setNoteToEdit(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  id="save-edit-metadata-btn"
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SAFE DELETE CONFIRMATION MODAL                         */}
      {/* ========================================================= */}
      {noteToDelete && (
        <div id="delete-note-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Permanently Delete Note?</h3>
                <p className="text-xs text-slate-500">Atomic removal from R2 bucket & Firestore</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <p className="font-semibold">{noteToDelete.title}</p>
              <p className="text-slate-600">R2 Object: {noteToDelete.r2ObjectKey || noteToDelete.storageKey}</p>
              <p className="text-rose-600 font-medium">This action cannot be undone. No orphan files will remain in R2.</p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                id="cancel-delete-note-btn"
                type="button"
                disabled={isDeleting === noteToDelete.id}
                onClick={() => setNoteToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-note-btn"
                type="button"
                disabled={isDeleting === noteToDelete.id}
                onClick={handlePerformDelete}
                className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-sm transition space-x-2"
              >
                {isDeleting === noteToDelete.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesContainer;
