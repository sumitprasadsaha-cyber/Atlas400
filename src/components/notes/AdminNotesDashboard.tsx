import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  School, 
  GraduationCap, 
  Search, 
  Plus, 
  Filter, 
  X, 
  RefreshCw, 
  FolderPlus, 
  Pencil, 
  Trash2, 
  Folder, 
  Layers, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  BookOpen,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Sidebar,
  HardDrive
} from "lucide-react";
import { ClassNote, Student } from "../../types";
import { uploadNotePipeline, replaceNotePipeline, deleteNotePipeline } from "../../lib/notesService";
import { searchHierarchicalNotes } from "../../utils/notesHierarchyHelper";
import { getFullChapterQuestions } from "../../utils/assessmentParser";
import { openNoteInNativeViewer, invalidateNoteCache } from "../../lib/nativePdfService";

import NotesBreadcrumbs, { BreadcrumbItem } from "./NotesBreadcrumbs";
import TopicCard from "./TopicCard";
import NotesTreeNav, { SelectedNode } from "./NotesTreeNav";
import QuickAddTopicModal, { ParentContext } from "./QuickAddTopicModal";
import ChapterModuleModal, { ChapterModuleAction } from "./ChapterModuleModal";
import NotesPreviewModal from "./NotesPreviewModal";
import NotesUploadProgressModal, { UploadProgressState } from "./NotesUploadProgressModal";
import AdminPracticeTestModal from "../AdminPracticeTestModal";

interface AdminNotesDashboardProps {
  notes: ClassNote[];
  students?: Student[];
  onRefresh?: () => void;
}

const SCHOOL_CLASSES = [
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12"
];

const DEFAULT_SCHOOL_SUBJECTS: Record<string, string[]> = {
  "Class 6": ["Mathematics", "Science", "English", "Computer Science", "Social Science", "Hindi", "Bengali"],
  "Class 7": ["Mathematics", "Science", "English", "Computer Science", "Social Science", "Hindi", "Bengali"],
  "Class 8": ["Mathematics", "Science", "English", "Computer Science", "Social Science", "Hindi", "Bengali"],
  "Class 9": ["Mathematics", "Science", "English", "Computer Science", "Social Science", "Hindi", "Bengali"],
  "Class 10": ["Mathematics", "Science", "English", "Computer Science", "Social Science", "Hindi", "Bengali"],
  "Class 11": ["Physics", "Chemistry", "Mathematics", "Biology", "Computer Science", "English", "Economics", "Accountancy"],
  "Class 12": ["Physics", "Chemistry", "Mathematics", "Biology", "Computer Science", "English", "Economics", "Accountancy"],
};

const UPSC_PAPERS = [
  "General Studies Paper I",
  "General Studies Paper II",
  "General Studies Paper III",
  "General Studies Paper IV",
  "Essay",
  "CSAT"
];

const UPSC_SUBJECTS: Record<string, string[]> = {
  "General Studies Paper I": ["Indian Heritage & Culture", "History", "Geography of the World & Society"],
  "General Studies Paper II": ["Polity", "Governance", "Constitution", "Social Justice", "International Relations"],
  "General Studies Paper III": ["Economy", "Science & Technology", "Biodiversity", "Environment", "Security", "Disaster Management"],
  "General Studies Paper IV": ["Ethics", "Integrity", "Aptitude"],
  "Essay": ["Essay Writing & Strategy"],
  "CSAT": ["Quantitative Aptitude", "Reasoning", "Reading Comprehension"]
};

export default function AdminNotesDashboard({
  notes = [],
  students = [],
  onRefresh,
}: AdminNotesDashboardProps) {
  // Top Level Mode: School vs UPSC
  const [activeTab, setActiveTab] = useState<"school" | "upsc">("school");

  // Selection state
  const [selectedNode, setSelectedNode] = useState<SelectedNode>({
    type: "school",
    className: "Class 10",
    subject: "Mathematics",
  });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterChapterModule, setFilterChapterModule] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);

  // Modals state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddInitialFile, setQuickAddInitialFile] = useState<File | null>(null);
  const [chapterModuleAction, setChapterModuleAction] = useState<ChapterModuleAction | null>(null);
  const [previewNote, setPreviewNote] = useState<ClassNote | null>(null);

  // Replace & Rename Modals
  const [replacingNote, setReplacingNote] = useState<ClassNote | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  const [renamingNote, setRenamingNote] = useState<ClassNote | null>(null);
  const [renameTopicNumber, setRenameTopicNumber] = useState<number | "">(1);
  const [renameTopicTitle, setRenameTopicTitle] = useState("");
  const [renameChapterTitle, setRenameChapterTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Practice Test Modal state
  const [practiceTestTarget, setPracticeTestTarget] = useState<{
    classGrade: string;
    subject: string;
    chapterNo: number;
    chapterName: string;
    topicName: string;
  } | null>(null);

  // Upload progress tracking
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    isOpen: false,
    isUploading: false,
    progress: 0,
  });

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Sync tab change
  const handleTabChange = (newTab: "school" | "upsc") => {
    setActiveTab(newTab);
    setSearchQuery("");
    setFilterClass("");
    setFilterSubject("");
    setFilterChapterModule("");

    if (newTab === "school") {
      setSelectedNode({
        type: "school",
        className: "Class 10",
        subject: "Mathematics",
      });
    } else {
      setSelectedNode({
        type: "upsc",
        gsPaper: "General Studies Paper II",
        subject: "Polity",
      });
    }
  };

  // Split Notes into School vs UPSC
  const schoolNotes = useMemo(() => {
    return notes.filter((n) => {
      const cls = (n as any).className || n.classGrade || (n as any).class || "";
      const isU = n.type === "upsc" || n.isUPSC || cls.toLowerCase() === "upsc";
      return !isU;
    });
  }, [notes]);

  const upscNotes = useMemo(() => {
    return notes.filter((n) => {
      const cls = (n as any).className || n.classGrade || (n as any).class || "";
      const isU = n.type === "upsc" || n.isUPSC || cls.toLowerCase() === "upsc";
      return isU;
    });
  }, [notes]);

  const currentPool = activeTab === "school" ? schoolNotes : upscNotes;

  // Filter & Search
  const filteredNotes = useMemo(() => {
    let result = currentPool;

    if (searchQuery.trim()) {
      result = searchHierarchicalNotes(result, searchQuery.trim());
    }

    if (activeTab === "school") {
      if (filterClass) {
        result = result.filter((n) => {
          const cls = (n as any).className || n.classGrade || (n as any).class || "";
          return cls.toLowerCase() === filterClass.toLowerCase();
        });
      }
      if (filterSubject) {
        result = result.filter((n) => {
          const s = (n as any).subjectName || n.subject || "";
          return s.toLowerCase() === filterSubject.toLowerCase();
        });
      }
      if (filterChapterModule) {
        result = result.filter((n) => {
          const chNo = (n as any).chapterNumber ?? n.chapterNo;
          return String(chNo) === String(filterChapterModule);
        });
      }
    } else {
      if (filterClass) { // Represents GS Paper
        result = result.filter((n) => {
          const gs = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
          return gs.toLowerCase() === filterClass.toLowerCase();
        });
      }
      if (filterSubject) {
        result = result.filter((n) => {
          const s = (n as any).subjectName || n.subject || "";
          return s.toLowerCase() === filterSubject.toLowerCase();
        });
      }
      if (filterChapterModule) { // Represents Module
        result = result.filter((n) => {
          const modNo = (n as any).moduleNumber ?? (n as any).moduleNo ?? (n as any).module_number ?? (n as any).chapterNumber ?? n.chapterNo;
          return String(modNo) === String(filterChapterModule);
        });
      }
    }

    return result;
  }, [currentPool, searchQuery, filterClass, filterSubject, filterChapterModule, activeTab]);

  // Derive Current Context from selected node
  const activeChapterOrModuleNotes = useMemo(() => {
    if (!selectedNode) return filteredNotes;

    return filteredNotes.filter((n) => {
      if (activeTab === "school") {
        if (selectedNode.className) {
          const cls = (n as any).className || n.classGrade || (n as any).class || "";
          if (cls.toLowerCase() !== selectedNode.className.toLowerCase()) return false;
        }
        if (selectedNode.subject) {
          const s = (n as any).subjectName || n.subject || "";
          if (s.toLowerCase() !== selectedNode.subject.toLowerCase()) return false;
        }
        if (selectedNode.chapterNumber !== undefined) {
          const chNo = (n as any).chapterNumber ?? n.chapterNo;
          if (Number(chNo) !== Number(selectedNode.chapterNumber)) return false;
        }
        return true;
      } else {
        if (selectedNode.gsPaper) {
          const gs = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
          if (gs.toLowerCase() !== selectedNode.gsPaper.toLowerCase()) return false;
        }
        if (selectedNode.subject) {
          const s = (n as any).subjectName || n.subject || "";
          if (s.toLowerCase() !== selectedNode.subject.toLowerCase()) return false;
        }
        if (selectedNode.moduleNumber !== undefined) {
          const modNo = (n as any).moduleNumber ?? (n as any).moduleNo ?? (n as any).module_number ?? (n as any).chapterNumber ?? n.chapterNo;
          if (Number(modNo) !== Number(selectedNode.moduleNumber)) return false;
        }
        return true;
      }
    });
  }, [filteredNotes, selectedNode, activeTab]);

  // Sort notes by topic number
  const sortedTopics = useMemo(() => {
    return [...activeChapterOrModuleNotes].sort((a, b) => {
      const aNo = (a as any).topicNumber ?? a.topicNo ?? 1;
      const bNo = (b as any).topicNumber ?? b.topicNo ?? 1;
      const numA = typeof aNo === "number" ? aNo : parseInt(String(aNo).replace(/\D/g, ""), 10) || 0;
      const numB = typeof bNo === "number" ? bNo : parseInt(String(bNo).replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
  }, [activeChapterOrModuleNotes]);

  // Build Breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      {
        id: "root",
        label: activeTab === "school" ? "School Notes" : "UPSC Notes",
        type: "root",
      },
    ];

    if (activeTab === "school") {
      if (selectedNode.className) {
        items.push({
          id: `class-${selectedNode.className}`,
          label: selectedNode.className,
          type: "class",
        });
      }
      if (selectedNode.subject) {
        items.push({
          id: `subj-${selectedNode.subject}`,
          label: selectedNode.subject,
          type: "subject",
        });
      }
      if (selectedNode.chapterNumber !== undefined) {
        items.push({
          id: `ch-${selectedNode.chapterNumber}`,
          label: `Chapter ${selectedNode.chapterNumber}${selectedNode.chapterName ? `: ${selectedNode.chapterName}` : ""}`,
          type: "chapter",
        });
      }
    } else {
      if (selectedNode.gsPaper) {
        items.push({
          id: `gs-${selectedNode.gsPaper}`,
          label: selectedNode.gsPaper,
          type: "gsPaper",
        });
      }
      if (selectedNode.subject) {
        items.push({
          id: `subj-${selectedNode.subject}`,
          label: selectedNode.subject,
          type: "subject",
        });
      }
      if (selectedNode.moduleNumber !== undefined) {
        items.push({
          id: `mod-${selectedNode.moduleNumber}`,
          label: `Module ${selectedNode.moduleNumber}${selectedNode.moduleName ? `: ${selectedNode.moduleName}` : ""}`,
          type: "module",
        });
      }
    }

    return items;
  }, [activeTab, selectedNode]);

  const handleBreadcrumbNavigate = (item: BreadcrumbItem, index: number) => {
    if (item.type === "root") {
      setSelectedNode({ type: activeTab });
    } else if (item.type === "class") {
      setSelectedNode({ type: "school", className: selectedNode.className });
    } else if (item.type === "gsPaper") {
      setSelectedNode({ type: "upsc", gsPaper: selectedNode.gsPaper });
    } else if (item.type === "subject") {
      setSelectedNode({
        type: activeTab,
        className: selectedNode.className,
        gsPaper: selectedNode.gsPaper,
        subject: selectedNode.subject,
      });
    }
  };

  // Prepare ParentContext for QuickAddTopicModal
  const parentContext: ParentContext | null = useMemo(() => {
    if (activeTab === "school") {
      const cls = selectedNode.className || "Class 10";
      const subj = selectedNode.subject || "Mathematics";
      const chNo = selectedNode.chapterNumber || 1;
      const chName = selectedNode.chapterName || "Chapter 1";

      const existing = currentPool.filter((n) => {
        const nCls = (n as any).className || n.classGrade || (n as any).class || "";
        const nSubj = (n as any).subjectName || n.subject || "";
        const nChNo = (n as any).chapterNumber ?? n.chapterNo ?? 1;
        return (
          nCls.toLowerCase() === cls.toLowerCase() &&
          nSubj.toLowerCase() === subj.toLowerCase() &&
          Number(nChNo) === Number(chNo)
        );
      });

      return {
        type: "school",
        className: cls,
        subject: subj,
        chapterNumber: chNo,
        chapterName: chName,
        existingTopics: existing,
      };
    } else {
      const gs = selectedNode.gsPaper || "General Studies Paper II";
      const subj = selectedNode.subject || "Polity";
      const modNo = selectedNode.moduleNumber || 1;
      const modName = selectedNode.moduleName || "Module 1";

      const existing = currentPool.filter((n) => {
        const nGs = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
        const nSubj = (n as any).subjectName || n.subject || "";
        const nModNo = (n as any).moduleNumber ?? (n as any).moduleNo ?? (n as any).module_number ?? (n as any).chapterNumber ?? n.chapterNo ?? 1;
        return (
          nGs.toLowerCase() === gs.toLowerCase() &&
          nSubj.toLowerCase() === subj.toLowerCase() &&
          Number(nModNo) === Number(modNo)
        );
      });

      return {
        type: "upsc",
        gsPaper: gs,
        subject: subj,
        moduleNumber: modNo,
        moduleName: modName,
        existingTopics: existing,
      };
    }
  }, [activeTab, selectedNode, currentPool]);

  // Handle Drag & Drop on main container
  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setQuickAddInitialFile(file);
      setQuickAddOpen(true);
    }
  };

  // Replace Note handler
  const handleOpenReplace = (note: ClassNote) => {
    setReplacingNote(note);
    setReplaceFile(null);
  };

  const handleConfirmReplace = async () => {
    if (!replacingNote || !replaceFile) {
      showToast("Please choose a replacement file.", "error");
      return;
    }

    setIsReplacing(true);
    try {
      await replaceNotePipeline({
        noteId: replacingNote.id,
        currentNote: replacingNote,
        newFile: replaceFile,
      });

      invalidateNoteCache(replacingNote.id);
      showToast(`Successfully replaced "${replacingNote.fileName || replacingNote.pdfFileName}" in Cloudflare R2!`, "success");
      setReplacingNote(null);
      setReplaceFile(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("[AdminNotesDashboard] Replace failed:", err);
      showToast(err?.message || "Failed to replace note.", "error");
    } finally {
      setIsReplacing(false);
    }
  };

  // Rename Note handler
  const handleOpenRename = (note: ClassNote) => {
    setRenamingNote(note);
    const rawNo = (note as any).topicNumber ?? note.topicNo ?? 1;
    const num = typeof rawNo === "number" ? rawNo : parseInt(String(rawNo).replace(/\D/g, ""), 10) || 1;
    setRenameTopicNumber(num);
    setRenameTopicTitle((note as any).topicTitle || (note as any).topicName || note.partLabel || "");
    setRenameChapterTitle((note as any).chapterTitle || (note as any).chapterName || note.chapterName || "");
  };

  const handleConfirmRename = async () => {
    if (!renamingNote) return;
    if (!renameTopicTitle.trim()) {
      showToast("Topic Title cannot be empty.", "error");
      return;
    }

    setIsRenaming(true);
    try {
      const { saveClassNoteDoc } = await import("../../lib/firestoreService");
      const updated: ClassNote = {
        ...renamingNote,
        topicNumber: typeof renameTopicNumber === "number" ? renameTopicNumber : 1,
        topicTitle: renameTopicTitle.trim(),
        topicName: renameTopicTitle.trim(),
        partLabel: renameTopicTitle.trim(),
        topicNo: typeof renameTopicNumber === "number" ? renameTopicNumber : 1,
        chapterName: renameChapterTitle.trim() || renamingNote.chapterName,
        chapterTitle: renameChapterTitle.trim() || renamingNote.chapterName,
      };

      await saveClassNoteDoc(updated);
      showToast("Topic metadata updated successfully.", "success");
      setRenamingNote(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("[AdminNotesDashboard] Rename failed:", err);
      showToast(err?.message || "Failed to update topic.", "error");
    } finally {
      setIsRenaming(false);
    }
  };

  // Delete Note handler
  const handleDeleteNote = async (note: ClassNote) => {
    if (!window.confirm(`Are you sure you want to delete "${(note as any).topicTitle || (note as any).topicName || note.fileName}"? This will delete the file from Cloudflare R2 and remove its index.`)) {
      return;
    }

    try {
      await deleteNotePipeline(note.id, note);
      invalidateNoteCache(note.id);
      showToast("Note deleted successfully.", "success");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("[AdminNotesDashboard] Delete failed:", err);
      showToast(err?.message || "Failed to delete note.", "error");
    }
  };

  // Chapter & Module Actions
  const handleOpenAddChapterModule = (context: {
    type: "school" | "upsc";
    className?: string;
    gsPaper?: string;
    subject: string;
  }) => {
    setChapterModuleAction({
      mode: "add",
      type: context.type,
      className: context.className,
      gsPaper: context.gsPaper,
      subject: context.subject,
      chapterNumber: (selectedNode.chapterNumber || 0),
      moduleNumber: (selectedNode.moduleNumber || 0),
    });
  };

  const handleOpenRenameChapterModule = () => {
    const isSchool = activeTab === "school";
    setChapterModuleAction({
      mode: "rename",
      type: activeTab,
      className: selectedNode.className,
      gsPaper: selectedNode.gsPaper,
      subject: selectedNode.subject || (isSchool ? "Mathematics" : "Polity"),
      chapterNumber: selectedNode.chapterNumber,
      chapterName: selectedNode.chapterName,
      moduleNumber: selectedNode.moduleNumber,
      moduleName: selectedNode.moduleName,
    });
  };

  const handleOpenDeleteChapterModule = () => {
    const isSchool = activeTab === "school";
    setChapterModuleAction({
      mode: "delete",
      type: activeTab,
      className: selectedNode.className,
      gsPaper: selectedNode.gsPaper,
      subject: selectedNode.subject || (isSchool ? "Mathematics" : "Polity"),
      chapterNumber: selectedNode.chapterNumber,
      chapterName: selectedNode.chapterName,
      moduleNumber: selectedNode.moduleNumber,
      moduleName: selectedNode.moduleName,
      affectedTopics: activeChapterOrModuleNotes,
    });
  };

  const handleConfirmAddChapterModule = (data: { number: number; name: string }) => {
    if (activeTab === "school") {
      setSelectedNode({
        type: "school",
        className: chapterModuleAction?.className || selectedNode.className || "Class 10",
        subject: chapterModuleAction?.subject || selectedNode.subject || "Mathematics",
        chapterNumber: data.number,
        chapterName: data.name,
      });
    } else {
      setSelectedNode({
        type: "upsc",
        gsPaper: chapterModuleAction?.gsPaper || selectedNode.gsPaper || "General Studies Paper II",
        subject: chapterModuleAction?.subject || selectedNode.subject || "Polity",
        moduleNumber: data.number,
        moduleName: data.name,
      });
    }
    setChapterModuleAction(null);
    showToast(`${activeTab === "school" ? "Chapter" : "Module"} ${data.number}: ${data.name} selected. You can now add topics!`, "info");
  };

  const handleConfirmRenameChapterModule = async (data: { oldNumber: number; newNumber: number; newName: string }) => {
    const isSchool = activeTab === "school";
    const affected = activeChapterOrModuleNotes;

    try {
      const { saveClassNoteDoc } = await import("../../lib/firestoreService");
      for (const note of affected) {
        const updated: ClassNote = {
          ...note,
          chapterNo: isSchool ? data.newNumber : note.chapterNo,
          chapterNumber: isSchool ? data.newNumber : note.chapterNumber,
          chapterName: isSchool ? data.newName : note.chapterName,
          chapterTitle: isSchool ? data.newName : note.chapterTitle,
          moduleNumber: !isSchool ? data.newNumber : note.moduleNumber,
          moduleNo: !isSchool ? data.newNumber : note.moduleNo,
          moduleName: !isSchool ? data.newName : note.moduleName,
          moduleTitle: !isSchool ? data.newName : note.moduleTitle,
        };
        await saveClassNoteDoc(updated);
      }

      setSelectedNode((prev) => ({
        ...prev,
        chapterNumber: isSchool ? data.newNumber : prev.chapterNumber,
        chapterName: isSchool ? data.newName : prev.chapterName,
        moduleNumber: !isSchool ? data.newNumber : prev.moduleNumber,
        moduleName: !isSchool ? data.newName : prev.moduleName,
      }));

      setChapterModuleAction(null);
      showToast(`Renamed ${isSchool ? "Chapter" : "Module"} to "${data.newName}" across ${affected.length} topics.`, "success");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast(err?.message || "Failed to rename.", "error");
    }
  };

  const handleConfirmDeleteChapterModule = async (data: { number: number; topics: ClassNote[] }) => {
    const isSchool = activeTab === "school";
    try {
      for (const note of data.topics) {
        await deleteNotePipeline(note.id, note);
        invalidateNoteCache(note.id);
      }

      setSelectedNode((prev) => ({
        ...prev,
        chapterNumber: undefined,
        chapterName: undefined,
        moduleNumber: undefined,
        moduleName: undefined,
      }));

      setChapterModuleAction(null);
      showToast(`Deleted ${isSchool ? "Chapter" : "Module"} ${data.number} and ${data.topics.length} topics.`, "success");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast(err?.message || "Failed to delete.", "error");
    }
  };

  // Preview Note trigger
  const handlePreview = (note: ClassNote) => {
    setPreviewNote(note);
  };

  return (
    <div 
      className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[85vh] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800"
      id="admin-notes-dashboard-root"
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
    >
      {/* Toast Banner */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 animate-fadeIn ${
          toast.type === "error"
            ? "bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
            : toast.type === "info"
            ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
            : "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
        }`}>
          {toast.type === "error" ? (
            <AlertCircle className="w-4 h-4" />
          ) : toast.type === "info" ? (
            <AlertCircle className="w-4 h-4 text-blue-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TOP HEADER: High-Level Switch (School vs UPSC) & Global Controls */}
      <div className="px-4 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        {/* Left: Mode Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => handleTabChange("school")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "school"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
              id="admin-tab-school"
            >
              <School className="w-4 h-4" />
              <span>School Notes</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                activeTab === "school" 
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" 
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              }`}>
                {schoolNotes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("upsc")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "upsc"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
              id="admin-tab-upsc"
            >
              <GraduationCap className="w-4 h-4" />
              <span>UPSC Notes</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                activeTab === "upsc" 
                  ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" 
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              }`}>
                {upscNotes.length}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSidebar((prev) => !prev)}
            className={`p-2 rounded-xl border text-xs font-semibold transition-colors hidden md:flex items-center gap-1.5 ${
              showSidebar
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 border-blue-200 dark:border-blue-800"
                : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
            }`}
            title="Toggle Hierarchy Tree Sidebar"
          >
            <Sidebar className="w-4 h-4" />
            <span>Tree</span>
          </button>
        </div>

        {/* Right: Quick Actions (+ Add Topic & Refresh) */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 transition-colors"
              title="Refresh notes from database"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setQuickAddInitialFile(null);
              setQuickAddOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
            id="admin-quick-add-btn"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Topic Note</span>
          </button>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="px-4 sm:px-6 py-2.5 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === "school" ? "School" : "UPSC"} notes (Class, Subject, Chapter, Topic, File)...`}
            className="w-full pl-9 pr-7 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "school" ? (
            <>
              {/* Class Filter */}
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-blue-500"
              >
                <option value="">All Classes</option>
                {SCHOOL_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Subject Filter */}
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-blue-500"
              >
                <option value="">All Subjects</option>
                {(DEFAULT_SCHOOL_SUBJECTS[filterClass || "Class 10"] || DEFAULT_SCHOOL_SUBJECTS["Class 10"]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              {/* GS Paper Filter */}
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-blue-500"
              >
                <option value="">All GS Papers</option>
                {UPSC_PAPERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {/* UPSC Subject Filter */}
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-blue-500"
              >
                <option value="">All Subjects</option>
                {(UPSC_SUBJECTS[filterClass || "General Studies Paper II"] || UPSC_SUBJECTS["General Studies Paper II"]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </>
          )}

          {(filterClass || filterSubject || filterChapterModule || searchQuery) && (
            <button
              onClick={() => {
                setFilterClass("");
                setFilterSubject("");
                setFilterChapterModule("");
                setSearchQuery("");
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Reset Filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA: Left Tree Nav + Right Topics Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Tree Navigation */}
        {showSidebar && (
          <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-3 overflow-y-auto hidden md:flex flex-col gap-2 shrink-0 scrollbar-thin">
            <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                {activeTab === "school" ? "School Hierarchy" : "UPSC Hierarchy"}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleOpenAddChapterModule({
                    type: activeTab,
                    className: selectedNode.className,
                    gsPaper: selectedNode.gsPaper,
                    subject: selectedNode.subject || (activeTab === "school" ? "Mathematics" : "Polity"),
                  })
                }
                className="p-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 flex items-center gap-1 text-[11px] font-bold"
                title={`Add ${activeTab === "school" ? "Chapter" : "Module"}`}
              >
                <Plus className="w-3 h-3" />
                <span>{activeTab === "school" ? "Chapter" : "Module"}</span>
              </button>
            </div>

            <NotesTreeNav
              type={activeTab}
              notes={currentPool}
              selectedNode={selectedNode}
              onSelectNode={(node) => setSelectedNode(node)}
              onAddChapterModule={handleOpenAddChapterModule}
              isAdmin={true}
            />
          </aside>
        )}

        {/* Right Main Explorer Pane */}
        <main className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 space-y-4">
          {/* Breadcrumbs Navigation Trail */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <NotesBreadcrumbs
              items={breadcrumbs}
              onNavigate={handleBreadcrumbNavigate}
              className="flex-1"
            />

            {/* Chapter / Module Management Controls */}
            {(selectedNode.chapterNumber !== undefined || selectedNode.moduleNumber !== undefined) && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenRenameChapterModule}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-amber-500" />
                  <span>Rename {activeTab === "school" ? "Chapter" : "Module"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenDeleteChapterModule}
                  className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Section Header: Current Folder Info */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 shrink-0">
                <Folder className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {activeTab === "school"
                    ? selectedNode.chapterNumber
                      ? `Chapter ${selectedNode.chapterNumber}: ${selectedNode.chapterName || "General"}`
                      : selectedNode.subject
                      ? `${selectedNode.className || "Class 10"} • ${selectedNode.subject}`
                      : selectedNode.className || "All School Notes"
                    : selectedNode.moduleNumber
                    ? `Module ${selectedNode.moduleNumber}: ${selectedNode.moduleName || "General"}`
                    : selectedNode.subject
                    ? `${selectedNode.gsPaper || "GS Paper"} • ${selectedNode.subject}`
                    : selectedNode.gsPaper || "All UPSC Notes"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {sortedTopics.length} {sortedTopics.length === 1 ? "topic note" : "topic notes"} found • Drag PDF/Image here to upload
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setQuickAddInitialFile(null);
                setQuickAddOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800/80 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">+ Add Topic</span>
            </button>
          </div>

          {/* TOPICS CARDS GRID */}
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
            {sortedTopics.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50">
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 mb-3">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {searchQuery ? "No matching topics found" : "No topic notes in this section yet"}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                  {searchQuery 
                    ? "Try adjusting your search terms or filters." 
                    : "Drag and drop your PDF / Image document here, or click the button below to upload your first topic note."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddInitialFile(null);
                    setQuickAddOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Upload Topic Note</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {sortedTopics.map((note) => {
                  const rawTopicNo = (note as any).topicNumber ?? note.topicNo;
                  const rawTopicName = (note as any).topicTitle || (note as any).topicName || note.partLabel;
                  const practiceTestQuestions = getFullChapterQuestions(
                    (note as any).className || note.classGrade || "",
                    note.subject,
                    (note as any).chapterNumber ?? note.chapterNo ?? 1
                  );
                  const hasTest = !!(practiceTestQuestions && practiceTestQuestions.length > 0);

                  return (
                    <TopicCard
                      key={note.id}
                      note={note}
                      topicNumber={rawTopicNo}
                      topicTitle={rawTopicName}
                      isAdmin={true}
                      onPreview={handlePreview}
                      onReplace={handleOpenReplace}
                      onRename={handleOpenRename}
                      onDelete={handleDeleteNote}
                      onTakeTest={() => {
                        setPracticeTestTarget({
                          classGrade: (note as any).className || note.classGrade || "Class 10",
                          subject: note.subject,
                          chapterNo: (note as any).chapterNumber ?? note.chapterNo ?? 1,
                          chapterName: (note as any).chapterTitle || (note as any).chapterName || note.chapterName,
                          topicName: rawTopicName || `Topic ${rawTopicNo || 1}`,
                        });
                      }}
                      hasPracticeTest={hasTest}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* QUICK ADD TOPIC MODAL */}
      <QuickAddTopicModal
        isOpen={quickAddOpen}
        parentContext={parentContext}
        initialFile={quickAddInitialFile}
        onClose={() => {
          setQuickAddOpen(false);
          setQuickAddInitialFile(null);
        }}
        onSuccess={(newNote) => {
          showToast(`Uploaded "${newNote.fileName || (newNote as any).pdfFileName}" to R2 & Firestore!`, "success");
          if (onRefresh) onRefresh();
        }}
        onOpenTestBuilder={(topicMeta) => {
          setPracticeTestTarget(topicMeta);
        }}
      />

      {/* CHAPTER & MODULE ACTION MODAL */}
      <ChapterModuleModal
        isOpen={!!chapterModuleAction}
        action={chapterModuleAction}
        onClose={() => setChapterModuleAction(null)}
        onConfirmAdd={handleConfirmAddChapterModule}
        onConfirmRename={handleConfirmRenameChapterModule}
        onConfirmDelete={handleConfirmDeleteChapterModule}
      />

      {/* EMBEDDED FILE PREVIEW MODAL */}
      <NotesPreviewModal
        isOpen={!!previewNote}
        note={previewNote}
        onClose={() => setPreviewNote(null)}
      />

      {/* IN-PLACE REPLACE FILE MODAL */}
      {replacingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Replace Document File
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-[240px]">
                    {(replacingNote as any).topicTitle || (replacingNote as any).topicName || replacingNote.fileName}
                  </p>
                </div>
              </div>
              <button onClick={() => setReplacingNote(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-700 dark:text-slate-300">Current Storage Key:</p>
              <p className="font-mono text-[11px] text-slate-500 break-all">
                {(replacingNote as any).r2Key || (replacingNote as any).storagePath || (replacingNote as any).storageKey || "canonical-path"}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select New PDF / Image
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setReplaceFile(e.target.files[0]);
                  }
                }}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReplacingNote(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReplace}
                disabled={!replaceFile || isReplacing}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isReplacing ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Replace File"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME / EDIT METADATA MODAL */}
      {renamingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Edit Topic Note
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-[240px]">
                    {renamingNote.fileName}
                  </p>
                </div>
              </div>
              <button onClick={() => setRenamingNote(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Topic No.
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={renameTopicNumber}
                    onChange={(e) => setRenameTopicNumber(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Topic Title
                  </label>
                  <input
                    type="text"
                    value={renameTopicTitle}
                    onChange={(e) => setRenameTopicTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {activeTab === "school" ? "Chapter Title" : "Module Title"}
                </label>
                <input
                  type="text"
                  value={renameChapterTitle}
                  onChange={(e) => setRenameChapterTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRenamingNote(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                disabled={isRenaming}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 flex items-center gap-1.5"
              >
                {isRenaming ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRACTICE TEST BUILDER MODAL */}
      {practiceTestTarget && (
        <AdminPracticeTestModal
          isOpen={true}
          onClose={() => setPracticeTestTarget(null)}
          classGrade={practiceTestTarget.classGrade}
          subject={practiceTestTarget.subject}
          chapterNo={practiceTestTarget.chapterNo}
          chapterName={practiceTestTarget.chapterName}
          topicName={practiceTestTarget.topicName}
          onPracticeTestChanged={() => {
            showToast("Practice Test saved successfully!", "success");
            setPracticeTestTarget(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
