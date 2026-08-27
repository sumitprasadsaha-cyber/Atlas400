import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  School, 
  GraduationCap, 
  Search, 
  Plus, 
  RefreshCw, 
  FolderPlus, 
  Pencil, 
  Trash2, 
  ChevronRight,
  BookOpen,
  Layers,
  HardDrive,
  FileText,
  AlertTriangle,
  X,
  Sparkles,
  Upload,
  CheckCircle2,
  FileCheck,
  ChevronDown
} from "lucide-react";
import { ClassNote, Student } from "../../types";
import { 
  uploadNotePipeline, 
  replaceNotePipeline, 
  deleteNotePipeline, 
  renameNotePipeline,
  renameSubjectPipeline,
  deleteChapterPipeline,
  deleteClassPipeline
} from "../../lib/notesService";
import { searchHierarchicalNotes } from "../../utils/notesHierarchyHelper";
import { fetchAllPracticeTests, buildTopicTestId } from "../../lib/practiceTestService";

import TopicCard from "./TopicCard";
import QuickAddTopicModal, { ParentContext } from "./QuickAddTopicModal";
import CreateHierarchyNodeModal, { 
  CreateHierarchyNodeContext, 
  NodeType 
} from "./CreateHierarchyNodeModal";
import NotesPreviewModal from "./NotesPreviewModal";
import AdminPracticeTestModal from "../AdminPracticeTestModal";

interface AdminNotesDashboardProps {
  notes: ClassNote[];
  students?: Student[];
  onRefresh?: () => void;
}

// Storage keys for custom created nodes
const STORAGE_CUSTOM_SCHOOL_CLASSES = "tuition_custom_school_classes";
const STORAGE_CUSTOM_SCHOOL_SUBJECTS = "tuition_custom_school_subjects";
const STORAGE_CUSTOM_SCHOOL_CHAPTERS = "tuition_custom_school_chapters";
const STORAGE_REMOVED_SCHOOL_SUBJECTS = "tuition_removed_school_subjects";
const STORAGE_CUSTOM_UPSC_PAPERS = "tuition_custom_upsc_papers";
const STORAGE_CUSTOM_UPSC_SUBJECTS = "tuition_custom_upsc_subjects";
const STORAGE_CUSTOM_UPSC_MODULES = "tuition_custom_upsc_modules";
const STORAGE_REMOVED_UPSC_SUBJECTS = "tuition_removed_upsc_subjects";

function safeGetStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function safeSetStorageJson(key: string, value: any): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export default function AdminNotesDashboard({
  notes = [],
  students = [],
  onRefresh,
}: AdminNotesDashboardProps) {
  // Top Level Mode: School vs UPSC
  const [activeTab, setActiveTab] = useState<"school" | "upsc">("school");

  // Custom Created Hierarchy Nodes from Local Storage
  const [customSchoolClasses, setCustomSchoolClasses] = useState<string[]>(() => 
    safeGetStorageJson<string[]>(STORAGE_CUSTOM_SCHOOL_CLASSES, [])
  );
  const [customSchoolSubjects, setCustomSchoolSubjects] = useState<Record<string, string[]>>(() => 
    safeGetStorageJson<Record<string, string[]>>(STORAGE_CUSTOM_SCHOOL_SUBJECTS, {})
  );
  const [customSchoolChapters, setCustomSchoolChapters] = useState<Record<string, Record<string, Array<{ number: number; name: string }>>>>(() => 
    safeGetStorageJson(STORAGE_CUSTOM_SCHOOL_CHAPTERS, {})
  );
  const [removedSchoolSubjects, setRemovedSchoolSubjects] = useState<Record<string, string[]>>(() =>
    safeGetStorageJson<Record<string, string[]>>(STORAGE_REMOVED_SCHOOL_SUBJECTS, {})
  );

  const [customUpscPapers, setCustomUpscPapers] = useState<string[]>(() => 
    safeGetStorageJson<string[]>(STORAGE_CUSTOM_UPSC_PAPERS, [])
  );
  const [customUpscSubjects, setCustomUpscSubjects] = useState<Record<string, string[]>>(() => 
    safeGetStorageJson<Record<string, string[]>>(STORAGE_CUSTOM_UPSC_SUBJECTS, {})
  );
  const [customUpscModules, setCustomUpscModules] = useState<Record<string, Record<string, Array<{ number: number; name: string }>>>>(() => 
    safeGetStorageJson(STORAGE_CUSTOM_UPSC_MODULES, {})
  );
  const [removedUpscSubjects, setRemovedUpscSubjects] = useState<Record<string, string[]>>(() =>
    safeGetStorageJson<Record<string, string[]>>(STORAGE_REMOVED_UPSC_SUBJECTS, {})
  );

  // Active Hierarchy Selection State - School (Dynamic, no hardcoded defaults)
  const [selectedSchoolClass, setSelectedSchoolClass] = useState<string>("");
  const [selectedSchoolSubject, setSelectedSchoolSubject] = useState<string>("");
  const [selectedSchoolChapterNo, setSelectedSchoolChapterNo] = useState<number>(0);
  const [selectedSchoolChapterName, setSelectedSchoolChapterName] = useState<string>("");

  // Active Hierarchy Selection State - UPSC (Dynamic, no hardcoded defaults)
  const [selectedUpscPaper, setSelectedUpscPaper] = useState<string>("");
  const [selectedUpscSubject, setSelectedUpscSubject] = useState<string>("");
  const [selectedUpscModuleNo, setSelectedUpscModuleNo] = useState<number>(0);
  const [selectedUpscModuleName, setSelectedUpscModuleName] = useState<string>("");

  // Search input within active topic list
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [createNodeContext, setCreateNodeContext] = useState<CreateHierarchyNodeContext | null>(null);
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

  const [deletingNote, setDeletingNote] = useState<ClassNote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Subject Rename Modal state
  const [renamingSubject, setRenamingSubject] = useState<{
    type: "school" | "upsc";
    className?: string;
    gsPaper?: string;
    oldSubject: string;
    newSubject: string;
  } | null>(null);
  const [isRenamingSubject, setIsRenamingSubject] = useState(false);

  // Rename Chapter / Module Modal State
  const [renamingChapter, setRenamingChapter] = useState<{
    type: "school" | "upsc";
    className?: string;
    gsPaper?: string;
    subject: string;
    oldNumber: number;
    oldName: string;
    newNumber: number | "";
    newName: string;
  } | null>(null);
  const [isRenamingChapter, setIsRenamingChapter] = useState(false);

  // Delete Class Modal State
  const [deletingClass, setDeletingClass] = useState<string | null>(null);
  const [isDeletingClass, setIsDeletingClass] = useState(false);

  // Practice Test Bank & Modal state
  const [practiceTestBank, setPracticeTestBank] = useState<Record<string, any>>({});
  const [practiceTestTarget, setPracticeTestTarget] = useState<{
    classGrade: string;
    subject: string;
    chapterNo: number;
    chapterName: string;
    topicName: string;
  } | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load practice tests bank on mount and refresh
  const loadPracticeTests = useCallback(async () => {
    try {
      const tests = await fetchAllPracticeTests();
      if (tests) {
        setPracticeTestBank(tests);
      }
    } catch (e) {
      console.warn("Failed to load practice tests bank:", e);
    }
  }, []);

  useEffect(() => {
    loadPracticeTests();
    const handleUpdate = () => loadPracticeTests();
    window.addEventListener("practice-tests-updated", handleUpdate);
    return () => window.removeEventListener("practice-tests-updated", handleUpdate);
  }, [loadPracticeTests]);

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

  // =========================================================================
  // SCHOOL HIERARCHY COMPUTATION (100% Dynamic from Custom State & DB Notes)
  // =========================================================================
  // 1. Available Classes: Custom Classes + DB Notes Classes
  const schoolClasses = useMemo(() => {
    const set = new Set<string>();
    customSchoolClasses.forEach((c) => {
      if (c && c.trim()) set.add(c.trim());
    });
    schoolNotes.forEach((n) => {
      const cls = (n as any).className || n.classGrade || (n as any).class;
      if (cls && typeof cls === "string" && cls.trim()) {
        set.add(cls.trim());
      }
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return numA - numB || a.localeCompare(b);
    });
  }, [schoolNotes, customSchoolClasses]);

  // Ensure valid selected class
  useEffect(() => {
    if (schoolClasses.length > 0) {
      if (!selectedSchoolClass || !schoolClasses.includes(selectedSchoolClass)) {
        setSelectedSchoolClass(schoolClasses[0]);
      }
    } else {
      setSelectedSchoolClass("");
    }
  }, [schoolClasses, selectedSchoolClass]);

  // 2. Available Subjects for selected School Class
  const schoolSubjectsForSelectedClass = useMemo(() => {
    if (!selectedSchoolClass) return [];
    const set = new Set<string>();
    const removedForClass = new Set(removedSchoolSubjects[selectedSchoolClass] || []);

    const custom = customSchoolSubjects[selectedSchoolClass] || [];
    custom.forEach((s) => {
      if (s && s.trim() && !removedForClass.has(s.trim())) set.add(s.trim());
    });

    schoolNotes.forEach((n) => {
      const cls = (n as any).className || n.classGrade || (n as any).class || "";
      if (cls.toLowerCase() === selectedSchoolClass.toLowerCase()) {
        const s = (n as any).subjectName || n.subject || "";
        if (s && s.trim() && !removedForClass.has(s.trim())) set.add(s.trim());
      }
    });

    return Array.from(set).sort();
  }, [selectedSchoolClass, schoolNotes, customSchoolSubjects, removedSchoolSubjects]);

  // Ensure valid selected subject
  useEffect(() => {
    if (schoolSubjectsForSelectedClass.length > 0) {
      if (!selectedSchoolSubject || !schoolSubjectsForSelectedClass.includes(selectedSchoolSubject)) {
        setSelectedSchoolSubject(schoolSubjectsForSelectedClass[0]);
      }
    } else {
      setSelectedSchoolSubject("");
    }
  }, [schoolSubjectsForSelectedClass, selectedSchoolSubject]);

  // 3. Available Chapters for selected School Class & Subject (No baseline 1..10 hardcoding)
  const schoolChaptersForSelected = useMemo(() => {
    if (!selectedSchoolClass || !selectedSchoolSubject) return [];
    const map = new Map<number, string>();

    // From custom created chapters
    const customList = customSchoolChapters[selectedSchoolClass]?.[selectedSchoolSubject] || [];
    customList.forEach((c) => {
      map.set(c.number, c.name || `Chapter ${c.number}`);
    });

    // From existing notes
    schoolNotes.forEach((n) => {
      const cls = (n as any).className || n.classGrade || (n as any).class || "";
      const subj = (n as any).subjectName || n.subject || "";
      if (cls.toLowerCase() === selectedSchoolClass.toLowerCase() && subj.toLowerCase() === selectedSchoolSubject.toLowerCase()) {
        const rawChNo = (n as any).chapterNumber ?? n.chapterNo ?? 1;
        const chNo = typeof rawChNo === "number" ? rawChNo : parseInt(String(rawChNo).replace(/\D/g, ""), 10) || 1;
        const chName = (n as any).chapterTitle || (n as any).chapterName || n.chapterName || `Chapter ${chNo}`;
        map.set(chNo, chName);
      }
    });

    return Array.from(map.entries())
      .map(([number, name]) => ({ number, name }))
      .sort((a, b) => a.number - b.number);
  }, [selectedSchoolClass, selectedSchoolSubject, schoolNotes, customSchoolChapters]);

  // Ensure valid selected chapter
  useEffect(() => {
    if (schoolChaptersForSelected.length > 0) {
      const exists = schoolChaptersForSelected.find((c) => c.number === selectedSchoolChapterNo);
      if (!exists) {
        setSelectedSchoolChapterNo(schoolChaptersForSelected[0].number);
        setSelectedSchoolChapterName(schoolChaptersForSelected[0].name);
      } else {
        setSelectedSchoolChapterName(exists.name);
      }
    } else {
      setSelectedSchoolChapterNo(0);
      setSelectedSchoolChapterName("");
    }
  }, [schoolChaptersForSelected, selectedSchoolChapterNo]);

  // =========================================================================
  // UPSC HIERARCHY COMPUTATION (100% Dynamic from Custom State & DB Notes)
  // =========================================================================
  // 1. Available GS Papers: Custom Papers + DB Notes Papers
  const upscPapers = useMemo(() => {
    const set = new Set<string>();
    customUpscPapers.forEach((p) => {
      if (p && p.trim()) set.add(p.trim());
    });
    upscNotes.forEach((n) => {
      const p = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper;
      if (p && typeof p === "string" && p.trim()) {
        set.add(p.trim());
      }
    });
    return Array.from(set);
  }, [upscNotes, customUpscPapers]);

  // Ensure valid selected GS Paper
  useEffect(() => {
    if (upscPapers.length > 0) {
      if (!selectedUpscPaper || !upscPapers.includes(selectedUpscPaper)) {
        setSelectedUpscPaper(upscPapers[0]);
      }
    } else {
      setSelectedUpscPaper("");
    }
  }, [upscPapers, selectedUpscPaper]);

  // 2. Available Subjects for selected GS Paper
  const upscSubjectsForSelectedPaper = useMemo(() => {
    if (!selectedUpscPaper) return [];
    const set = new Set<string>();
    const removedForPaper = new Set(removedUpscSubjects[selectedUpscPaper] || []);

    const custom = customUpscSubjects[selectedUpscPaper] || [];
    custom.forEach((s) => {
      if (s && s.trim() && !removedForPaper.has(s.trim())) set.add(s.trim());
    });

    upscNotes.forEach((n) => {
      const p = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
      if (p.toLowerCase() === selectedUpscPaper.toLowerCase()) {
        const s = (n as any).subjectName || n.subject || "";
        if (s && s.trim() && !removedForPaper.has(s.trim())) set.add(s.trim());
      }
    });

    return Array.from(set).sort();
  }, [selectedUpscPaper, upscNotes, customUpscSubjects, removedUpscSubjects]);

  // Ensure valid selected UPSC subject
  useEffect(() => {
    if (upscSubjectsForSelectedPaper.length > 0) {
      if (!selectedUpscSubject || !upscSubjectsForSelectedPaper.includes(selectedUpscSubject)) {
        setSelectedUpscSubject(upscSubjectsForSelectedPaper[0]);
      }
    } else {
      setSelectedUpscSubject("");
    }
  }, [upscSubjectsForSelectedPaper, selectedUpscSubject]);

  // 3. Available Modules for selected UPSC Paper & Subject (No baseline 1..10 hardcoding)
  const upscModulesForSelected = useMemo(() => {
    if (!selectedUpscPaper || !selectedUpscSubject) return [];
    const map = new Map<number, string>();

    // From custom created modules
    const customList = customUpscModules[selectedUpscPaper]?.[selectedUpscSubject] || [];
    customList.forEach((m) => {
      map.set(m.number, m.name || `Module ${m.number}`);
    });

    // From existing notes
    upscNotes.forEach((n) => {
      const p = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
      const subj = (n as any).subjectName || n.subject || "";
      if (p.toLowerCase() === selectedUpscPaper.toLowerCase() && subj.toLowerCase() === selectedUpscSubject.toLowerCase()) {
        const rawModNo = (n as any).moduleNumber ?? (n as any).moduleNo ?? (n as any).chapterNumber ?? n.chapterNo ?? 1;
        const modNo = typeof rawModNo === "number" ? rawModNo : parseInt(String(rawModNo).replace(/\D/g, ""), 10) || 1;
        const modName = (n as any).moduleTitle || (n as any).moduleName || (n as any).chapterTitle || (n as any).chapterName || `Module ${modNo}`;
        map.set(modNo, modName);
      }
    });

    return Array.from(map.entries())
      .map(([number, name]) => ({ number, name }))
      .sort((a, b) => a.number - b.number);
  }, [selectedUpscPaper, selectedUpscSubject, upscNotes, customUpscModules]);

  // Ensure valid selected module
  useEffect(() => {
    if (upscModulesForSelected.length > 0) {
      const exists = upscModulesForSelected.find((m) => m.number === selectedUpscModuleNo);
      if (!exists) {
        setSelectedUpscModuleNo(upscModulesForSelected[0].number);
        setSelectedUpscModuleName(upscModulesForSelected[0].name);
      } else {
        setSelectedUpscModuleName(exists.name);
      }
    } else {
      setSelectedUpscModuleNo(0);
      setSelectedUpscModuleName("");
    }
  }, [upscModulesForSelected, selectedUpscModuleNo]);

  // =========================================================================
  // ACTIVE TOPIC NOTES COMPUTATION
  // =========================================================================
  const activeTopicNotes = useMemo(() => {
    if (activeTab === "school") {
      return schoolNotes.filter((n) => {
        const cls = (n as any).className || n.classGrade || (n as any).class || "";
        const subj = (n as any).subjectName || n.subject || "";
        const chNo = (n as any).chapterNumber ?? n.chapterNo ?? 1;

        return (
          cls.toLowerCase() === selectedSchoolClass.toLowerCase() &&
          subj.toLowerCase() === selectedSchoolSubject.toLowerCase() &&
          Number(chNo) === Number(selectedSchoolChapterNo)
        );
      });
    } else {
      return upscNotes.filter((n) => {
        const p = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
        const subj = (n as any).subjectName || n.subject || "";
        const modNo = (n as any).moduleNumber ?? (n as any).moduleNo ?? (n as any).chapterNumber ?? n.chapterNo ?? 1;

        return (
          p.toLowerCase() === selectedUpscPaper.toLowerCase() &&
          subj.toLowerCase() === selectedUpscSubject.toLowerCase() &&
          Number(modNo) === Number(selectedUpscModuleNo)
        );
      });
    }
  }, [
    activeTab, 
    schoolNotes, 
    upscNotes, 
    selectedSchoolClass, 
    selectedSchoolSubject, 
    selectedSchoolChapterNo, 
    selectedUpscPaper, 
    selectedUpscSubject, 
    selectedUpscModuleNo
  ]);

  // Filtered and Sorted Topics
  const filteredAndSortedTopics = useMemo(() => {
    let list = activeTopicNotes;
    if (searchQuery.trim()) {
      list = searchHierarchicalNotes(list, searchQuery.trim());
    }

    return [...list].sort((a, b) => {
      const aNo = (a as any).topicNumber ?? a.topicNo ?? 1;
      const bNo = (b as any).topicNumber ?? b.topicNo ?? 1;
      const numA = typeof aNo === "number" ? aNo : parseInt(String(aNo).replace(/\D/g, ""), 10) || 0;
      const numB = typeof bNo === "number" ? bNo : parseInt(String(bNo).replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
  }, [activeTopicNotes, searchQuery]);

  // Current Parent Context for QuickAddTopicModal
  const parentContext: ParentContext = useMemo(() => {
    if (activeTab === "school") {
      return {
        type: "school",
        className: selectedSchoolClass,
        subject: selectedSchoolSubject,
        chapterNumber: selectedSchoolChapterNo,
        chapterName: selectedSchoolChapterName,
        existingTopics: activeTopicNotes,
      };
    } else {
      return {
        type: "upsc",
        gsPaper: selectedUpscPaper,
        subject: selectedUpscSubject,
        moduleNumber: selectedUpscModuleNo,
        moduleName: selectedUpscModuleName,
        existingTopics: activeTopicNotes,
      };
    }
  }, [
    activeTab, 
    selectedSchoolClass, 
    selectedSchoolSubject, 
    selectedSchoolChapterNo, 
    selectedSchoolChapterName, 
    selectedUpscPaper, 
    selectedUpscSubject, 
    selectedUpscModuleNo, 
    selectedUpscModuleName, 
    activeTopicNotes
  ]);

  // Helper to check if a topic has a practice test
  const checkIfTopicHasPracticeTest = useCallback((note: ClassNote): boolean => {
    if ((note as any).hasPracticeTest || (note as any).practiceTest) return true;

    const classGrade = activeTab === "school" ? selectedSchoolClass : "UPSC";
    const subject = activeTab === "school" ? selectedSchoolSubject : selectedUpscSubject;
    const chapterNo = activeTab === "school" ? selectedSchoolChapterNo : selectedUpscModuleNo;
    const topicName = ((note as any).topicTitle || (note as any).topicName || note.partLabel || "").trim();

    const testId = buildTopicTestId(classGrade, subject, chapterNo, topicName);
    return Boolean(practiceTestBank[testId]);
  }, [activeTab, selectedSchoolClass, selectedSchoolSubject, selectedSchoolChapterNo, selectedUpscSubject, selectedUpscModuleNo, practiceTestBank]);

  // =========================================================================
  // HIERARCHY NODE CREATION HANDLERS
  // =========================================================================
  const handleCreateNodeSubmit = (result: {
    nodeType: NodeType;
    name: string;
    number?: number;
    className?: string;
    gsPaper?: string;
    subject?: string;
  }) => {
    const cleanName = result.name.trim();

    if (result.nodeType === "new_class") {
      if (!customSchoolClasses.includes(cleanName)) {
        const next = [...customSchoolClasses, cleanName];
        setCustomSchoolClasses(next);
        safeSetStorageJson(STORAGE_CUSTOM_SCHOOL_CLASSES, next);
      }
      setSelectedSchoolClass(cleanName);
      showToast(`Class "${cleanName}" created`, "success");
    } else if (result.nodeType === "new_gs_paper") {
      if (!customUpscPapers.includes(cleanName)) {
        const next = [...customUpscPapers, cleanName];
        setCustomUpscPapers(next);
        safeSetStorageJson(STORAGE_CUSTOM_UPSC_PAPERS, next);
      }
      setSelectedUpscPaper(cleanName);
      showToast(`GS Paper "${cleanName}" created`, "success");
    } else if (result.nodeType === "add_subject") {
      if (activeTab === "school") {
        const targetClass = selectedSchoolClass;
        const currentList = customSchoolSubjects[targetClass] || [];
        if (!currentList.includes(cleanName)) {
          const nextMap = {
            ...customSchoolSubjects,
            [targetClass]: [...currentList, cleanName],
          };
          setCustomSchoolSubjects(nextMap);
          safeSetStorageJson(STORAGE_CUSTOM_SCHOOL_SUBJECTS, nextMap);
        }
        setSelectedSchoolSubject(cleanName);
        showToast(`Subject "${cleanName}" added to ${targetClass}`, "success");
      } else {
        const targetPaper = selectedUpscPaper;
        const currentList = customUpscSubjects[targetPaper] || [];
        if (!currentList.includes(cleanName)) {
          const nextMap = {
            ...customUpscSubjects,
            [targetPaper]: [...currentList, cleanName],
          };
          setCustomUpscSubjects(nextMap);
          safeSetStorageJson(STORAGE_CUSTOM_UPSC_SUBJECTS, nextMap);
        }
        setSelectedUpscSubject(cleanName);
        showToast(`Subject "${cleanName}" added to ${targetPaper}`, "success");
      }
    } else if (result.nodeType === "add_chapter") {
      const targetClass = selectedSchoolClass;
      const targetSubj = selectedSchoolSubject;
      const num = result.number || 1;

      const currentClassMap = customSchoolChapters[targetClass] || {};
      const currentSubjList = currentClassMap[targetSubj] || [];
      const updatedList = [
        ...currentSubjList.filter((c) => c.number !== num),
        { number: num, name: cleanName || `Chapter ${num}` },
      ].sort((a, b) => a.number - b.number);

      const nextMap = {
        ...customSchoolChapters,
        [targetClass]: {
          ...currentClassMap,
          [targetSubj]: updatedList,
        },
      };

      setCustomSchoolChapters(nextMap);
      safeSetStorageJson(STORAGE_CUSTOM_SCHOOL_CHAPTERS, nextMap);

      setSelectedSchoolChapterNo(num);
      setSelectedSchoolChapterName(cleanName || `Chapter ${num}`);
      showToast(`Chapter ${num}: "${cleanName || `Chapter ${num}`}" created`, "success");
    } else if (result.nodeType === "add_module") {
      const targetPaper = selectedUpscPaper;
      const targetSubj = selectedUpscSubject;
      const num = result.number || 1;

      const currentPaperMap = customUpscModules[targetPaper] || {};
      const currentSubjList = currentPaperMap[targetSubj] || [];
      const updatedList = [
        ...currentSubjList.filter((m) => m.number !== num),
        { number: num, name: cleanName || `Module ${num}` },
      ].sort((a, b) => a.number - b.number);

      const nextMap = {
        ...customUpscModules,
        [targetPaper]: {
          ...currentPaperMap,
          [targetSubj]: updatedList,
        },
      };

      setCustomUpscModules(nextMap);
      safeSetStorageJson(STORAGE_CUSTOM_UPSC_MODULES, nextMap);

      setSelectedUpscModuleNo(num);
      setSelectedUpscModuleName(cleanName || `Module ${num}`);
      showToast(`Module ${num}: "${cleanName || `Module ${num}`}" created`, "success");
    }
  };

  // =========================================================================
  // NOTE ACTION HANDLERS (Replace, Rename, Delete, Practice Test)
  // =========================================================================
  const handleOpenReplace = (note: ClassNote) => {
    setReplacingNote(note);
    setReplaceFile(null);
  };

  const handleConfirmReplace = async () => {
    if (!replacingNote || !replaceFile) return;
    setIsReplacing(true);
    try {
      await replaceNotePipeline({
        noteId: replacingNote.id,
        currentNote: replacingNote,
        newFile: replaceFile,
      });
      showToast("Note file replaced successfully!", "success");
      setReplacingNote(null);
      setReplaceFile(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast(err?.message || "Failed to replace note.", "error");
    } finally {
      setIsReplacing(false);
    }
  };

  const handleOpenRename = (note: ClassNote) => {
    setRenamingNote(note);
    const rawNo = (note as any).topicNumber ?? note.topicNo ?? 1;
    const num = typeof rawNo === "number" ? rawNo : parseInt(String(rawNo).replace(/\D/g, ""), 10) || 1;
    setRenameTopicNumber(num);
    setRenameTopicTitle((note as any).topicTitle || (note as any).topicName || note.partLabel || "");
    setRenameChapterTitle((note as any).chapterTitle || (note as any).chapterName || (note as any).moduleName || "");
  };

  const handleConfirmRename = async () => {
    if (!renamingNote) return;
    setIsRenaming(true);
    try {
      await renameNotePipeline({
        noteId: renamingNote.id,
        currentNote: renamingNote,
        newTopicNumber: renameTopicNumber === "" ? undefined : renameTopicNumber,
        newTopicTitle: renameTopicTitle.trim() || undefined,
        newChapterTitle: renameChapterTitle.trim() || undefined,
      });
      showToast("Note renamed successfully!", "success");
      setRenamingNote(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast(err?.message || "Failed to rename note.", "error");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleOpenDelete = (note: ClassNote) => {
    setDeletingNote(note);
  };

  const handleConfirmDelete = async () => {
    if (!deletingNote) return;
    setIsDeleting(true);
    try {
      await deleteNotePipeline(deletingNote.id, deletingNote);
      showToast("Topic note deleted successfully.", "success");
      setDeletingNote(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast(err?.message || "Failed to delete note.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // =========================================================================
  // SUBJECT MANAGEMENT: RENAME & DELETE HANDLERS
  // =========================================================================
  const handleOpenRenameSubject = (subject: string) => {
    setRenamingSubject({
      type: activeTab,
      className: selectedSchoolClass,
      gsPaper: selectedUpscPaper,
      oldSubject: subject,
      newSubject: subject,
    });
  };

  const handleConfirmRenameSubject = async () => {
    if (!renamingSubject) return;
    const cleanNew = renamingSubject.newSubject.trim();
    if (!cleanNew) {
      showToast("Subject name cannot be empty.", "error");
      return;
    }
    if (cleanNew.toLowerCase() === renamingSubject.oldSubject.toLowerCase()) {
      setRenamingSubject(null);
      return;
    }

    setIsRenamingSubject(true);
    try {
      // 1. Run pipeline to update all Firestore docs and invalidate caches
      const res = await renameSubjectPipeline({
        type: renamingSubject.type,
        className: renamingSubject.type === "school" ? renamingSubject.className : undefined,
        gsPaper: renamingSubject.type === "upsc" ? renamingSubject.gsPaper : undefined,
        oldSubject: renamingSubject.oldSubject,
        newSubject: cleanNew,
        notes: activeTab === "school" ? schoolNotes : upscNotes,
      });

      // 2. Update custom subjects and removed subjects in localStorage
      if (renamingSubject.type === "school") {
        const targetCls = renamingSubject.className || selectedSchoolClass;
        const curCustom = customSchoolSubjects[targetCls] || [];
        const nextCustom = curCustom.map((s) => (s.toLowerCase() === renamingSubject.oldSubject.toLowerCase() ? cleanNew : s));
        if (!nextCustom.includes(cleanNew)) nextCustom.push(cleanNew);

        const updatedMap = { ...customSchoolSubjects, [targetCls]: nextCustom };
        setCustomSchoolSubjects(updatedMap);
        safeSetStorageJson(STORAGE_CUSTOM_SCHOOL_SUBJECTS, updatedMap);

        if (selectedSchoolSubject.toLowerCase() === renamingSubject.oldSubject.toLowerCase()) {
          setSelectedSchoolSubject(cleanNew);
        }
      } else {
        const targetPaper = renamingSubject.gsPaper || selectedUpscPaper;
        const curCustom = customUpscSubjects[targetPaper] || [];
        const nextCustom = curCustom.map((s) => (s.toLowerCase() === renamingSubject.oldSubject.toLowerCase() ? cleanNew : s));
        if (!nextCustom.includes(cleanNew)) nextCustom.push(cleanNew);

        const updatedMap = { ...customUpscSubjects, [targetPaper]: nextCustom };
        setCustomUpscSubjects(updatedMap);
        safeSetStorageJson(STORAGE_CUSTOM_UPSC_SUBJECTS, updatedMap);

        if (selectedUpscSubject.toLowerCase() === renamingSubject.oldSubject.toLowerCase()) {
          setSelectedUpscSubject(cleanNew);
        }
      }

      showToast(`Subject renamed to "${cleanNew}" (${res.updatedCount} notes updated)`, "success");
      setRenamingSubject(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast(err?.message || "Failed to rename subject.", "error");
    } finally {
      setIsRenamingSubject(false);
    }
  };

  const handleDeleteSubject = (subjectToDelete: string) => {
    // Check if subject contains notes
    const notesInSubj = (activeTab === "school" ? schoolNotes : upscNotes).filter((n) => {
      const s = ((n as any).subjectName || n.subject || "").trim().toLowerCase();
      if (s !== subjectToDelete.trim().toLowerCase()) return false;

      if (activeTab === "school") {
        const c = ((n as any).className || n.classGrade || (n as any).class || "").trim().toLowerCase();
        return c === selectedSchoolClass.trim().toLowerCase();
      } else {
        const p = ((n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "").trim().toLowerCase();
        return p === selectedUpscPaper.trim().toLowerCase();
      }
    });

    if (notesInSubj.length > 0) {
      showToast("This subject contains notes. Delete all Chapters/Modules first.", "error");
      return;
    }

    if (activeTab === "school") {
      const curRemoved = removedSchoolSubjects[selectedSchoolClass] || [];
      const nextRemoved = {
        ...removedSchoolSubjects,
        [selectedSchoolClass]: Array.from(new Set([...curRemoved, subjectToDelete])),
      };
      setRemovedSchoolSubjects(nextRemoved);
      safeSetStorageJson(STORAGE_REMOVED_SCHOOL_SUBJECTS, nextRemoved);

      const curCustom = customSchoolSubjects[selectedSchoolClass] || [];
      if (curCustom.includes(subjectToDelete)) {
        const nextCustom = {
          ...customSchoolSubjects,
          [selectedSchoolClass]: curCustom.filter((s) => s !== subjectToDelete),
        };
        setCustomSchoolSubjects(nextCustom);
        safeSetStorageJson(STORAGE_CUSTOM_SCHOOL_SUBJECTS, nextCustom);
      }

      showToast(`Subject "${subjectToDelete}" deleted.`, "success");
    } else {
      const curRemoved = removedUpscSubjects[selectedUpscPaper] || [];
      const nextRemoved = {
        ...removedUpscSubjects,
        [selectedUpscPaper]: Array.from(new Set([...curRemoved, subjectToDelete])),
      };
      setRemovedUpscSubjects(nextRemoved);
      safeSetStorageJson(STORAGE_REMOVED_UPSC_SUBJECTS, nextRemoved);

      const curCustom = customUpscSubjects[selectedUpscPaper] || [];
      if (curCustom.includes(subjectToDelete)) {
        const nextCustom = {
          ...customUpscSubjects,
          [selectedUpscPaper]: curCustom.filter((s) => s !== subjectToDelete),
        };
        setCustomUpscSubjects(nextCustom);
        safeSetStorageJson(STORAGE_CUSTOM_UPSC_SUBJECTS, nextCustom);
      }

      showToast(`Subject "${subjectToDelete}" deleted.`, "success");
    }
  };

  // =========================================================================
  // CLASS MANAGEMENT: DELETE HANDLER (Cascade Cloudflare & Firestore Deletion)
  // =========================================================================
  const handleConfirmDeleteClass = async () => {
    if (!deletingClass) return;
    const targetClass = deletingClass;
    setIsDeletingClass(true);

    try {
      // 1. Run cascade deletion pipeline for this class (deletes R2 files, Firestore docs, practice tests)
      await deleteClassPipeline({
        className: targetClass,
        notes: notes,
      });

      // 2. Remove class from customSchoolClasses
      const updatedClasses = customSchoolClasses.filter(
        (c) => c.toLowerCase() !== targetClass.toLowerCase()
      );
      setCustomSchoolClasses(updatedClasses);
      safeSetStorageJson(STORAGE_CUSTOM_SCHOOL_CLASSES, updatedClasses);

      // 3. Clean up custom subjects, custom chapters, and removed subjects mapping
      const nextCustomSubjects = { ...customSchoolSubjects };
      delete nextCustomSubjects[targetClass];
      setCustomSchoolSubjects(nextCustomSubjects);
      safeSetStorageJson(STORAGE_CUSTOM_SCHOOL_SUBJECTS, nextCustomSubjects);

      const nextCustomChapters = { ...customSchoolChapters };
      delete nextCustomChapters[targetClass];
      setCustomSchoolChapters(nextCustomChapters);
      safeSetStorageJson(STORAGE_CUSTOM_SCHOOL_CHAPTERS, nextCustomChapters);

      const nextRemovedSubjects = { ...removedSchoolSubjects };
      delete nextRemovedSubjects[targetClass];
      setRemovedSchoolSubjects(nextRemovedSubjects);
      safeSetStorageJson(STORAGE_REMOVED_SCHOOL_SUBJECTS, nextRemovedSubjects);

      // 4. Compute next available class
      const remaining = schoolClasses.filter(
        (c) => c.toLowerCase() !== targetClass.toLowerCase()
      );
      if (remaining.length > 0) {
        setSelectedSchoolClass(remaining[0]);
      } else {
        setSelectedSchoolClass("");
      }

      showToast(`Class "${targetClass}" deleted successfully.`, "success");
      setDeletingClass(null);

      // 5. Trigger parent refresh if available
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error("[AdminNotesDashboard] Delete class failure:", err);
      showToast(err?.message || `Failed to delete "${targetClass}".`, "error");
    } finally {
      setIsDeletingClass(false);
    }
  };

  // Chapter & Module Rename Handlers
  const handleOpenRenameChapter = (chNumber: number, chName: string) => {
    if (activeTab === "school") {
      setRenamingChapter({
        type: "school",
        className: selectedSchoolClass,
        subject: selectedSchoolSubject,
        oldNumber: chNumber,
        oldName: chName,
        newNumber: chNumber,
        newName: chName,
      });
    } else {
      setRenamingChapter({
        type: "upsc",
        gsPaper: selectedUpscPaper,
        subject: selectedUpscSubject,
        oldNumber: chNumber,
        oldName: chName,
        newNumber: chNumber,
        newName: chName,
      });
    }
  };

  const handleConfirmRenameChapter = () => {
    if (!renamingChapter) return;
    const num = typeof renamingChapter.newNumber === "number" ? renamingChapter.newNumber : parseInt(String(renamingChapter.newNumber), 10) || renamingChapter.oldNumber;
    const cleanName = renamingChapter.newName.trim() || (renamingChapter.type === "school" ? `Chapter ${num}` : `Module ${num}`);

    if (renamingChapter.type === "school") {
      const cls = renamingChapter.className || selectedSchoolClass;
      const subj = renamingChapter.subject || selectedSchoolSubject;
      const curClassMap = customSchoolChapters[cls] || {};
      const curSubjList = curClassMap[subj] || [];
      const updatedList = [
        ...curSubjList.filter((c) => c.number !== renamingChapter.oldNumber && c.number !== num),
        { number: num, name: cleanName },
      ].sort((a, b) => a.number - b.number);

      const nextMap = {
        ...customSchoolChapters,
        [cls]: {
          ...curClassMap,
          [subj]: updatedList,
        },
      };
      setCustomSchoolChapters(nextMap);
      safeSetStorageJson(STORAGE_CUSTOM_SCHOOL_CHAPTERS, nextMap);

      if (selectedSchoolChapterNo === renamingChapter.oldNumber) {
        setSelectedSchoolChapterNo(num);
        setSelectedSchoolChapterName(cleanName);
      }
      showToast(`Chapter updated to "Chapter ${num}: ${cleanName}"`, "success");
    } else {
      const paper = renamingChapter.gsPaper || selectedUpscPaper;
      const subj = renamingChapter.subject || selectedUpscSubject;
      const curPaperMap = customUpscModules[paper] || {};
      const curSubjList = curPaperMap[subj] || [];
      const updatedList = [
        ...curSubjList.filter((m) => m.number !== renamingChapter.oldNumber && m.number !== num),
        { number: num, name: cleanName },
      ].sort((a, b) => a.number - b.number);

      const nextMap = {
        ...customUpscModules,
        [paper]: {
          ...curPaperMap,
          [subj]: updatedList,
        },
      };
      setCustomUpscModules(nextMap);
      safeSetStorageJson(STORAGE_CUSTOM_UPSC_MODULES, nextMap);

      if (selectedUpscModuleNo === renamingChapter.oldNumber) {
        setSelectedUpscModuleNo(num);
        setSelectedUpscModuleName(cleanName);
      }
      showToast(`Module updated to "Module ${num}: ${cleanName}"`, "success");
    }

    setRenamingChapter(null);
  };

  const handleDeleteChapter = (chNum: number) => {
    // Check if notes exist in this chapter/module
    const notesInCh = (activeTab === "school" ? schoolNotes : upscNotes).filter((n) => {
      const s = ((n as any).subjectName || n.subject || "").trim().toLowerCase();
      const currSubj = (activeTab === "school" ? selectedSchoolSubject : selectedUpscSubject).trim().toLowerCase();
      if (s !== currSubj) return false;

      if (activeTab === "school") {
        const c = ((n as any).className || n.classGrade || (n as any).class || "").trim().toLowerCase();
        const num = (n as any).chapterNumber ?? n.chapterNo ?? 1;
        return c === selectedSchoolClass.trim().toLowerCase() && Number(num) === chNum;
      } else {
        const p = ((n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "").trim().toLowerCase();
        const num = (n as any).moduleNumber ?? (n as any).moduleNo ?? (n as any).chapterNumber ?? n.chapterNo ?? 1;
        return p === selectedUpscPaper.trim().toLowerCase() && Number(num) === chNum;
      }
    });

    if (notesInCh.length > 0) {
      showToast(`This ${activeTab === "school" ? "chapter" : "module"} contains ${notesInCh.length} note(s). Please delete the notes first.`, "error");
      return;
    }

    if (activeTab === "school") {
      const curClassMap = customSchoolChapters[selectedSchoolClass] || {};
      const curSubjList = curClassMap[selectedSchoolSubject] || [];
      const nextList = curSubjList.filter((c) => c.number !== chNum);
      const nextMap = {
        ...customSchoolChapters,
        [selectedSchoolClass]: {
          ...curClassMap,
          [selectedSchoolSubject]: nextList,
        },
      };
      setCustomSchoolChapters(nextMap);
      safeSetStorageJson(STORAGE_CUSTOM_SCHOOL_CHAPTERS, nextMap);
      showToast(`Chapter ${chNum} deleted.`, "success");
    } else {
      const curPaperMap = customUpscModules[selectedUpscPaper] || {};
      const curSubjList = curPaperMap[selectedUpscSubject] || [];
      const nextList = curSubjList.filter((m) => m.number !== chNum);
      const nextMap = {
        ...customUpscModules,
        [selectedUpscPaper]: {
          ...curPaperMap,
          [selectedUpscSubject]: nextList,
        },
      };
      setCustomUpscModules(nextMap);
      safeSetStorageJson(STORAGE_CUSTOM_UPSC_MODULES, nextMap);
      showToast(`Module ${chNum} deleted.`, "success");
    }
  };

  const handleOpenPracticeTest = (note: ClassNote) => {
    const classGrade = activeTab === "school" ? selectedSchoolClass : "UPSC";
    const subject = activeTab === "school" ? selectedSchoolSubject : selectedUpscSubject;
    const chapterNo = activeTab === "school" ? selectedSchoolChapterNo : selectedUpscModuleNo;
    const chapterName = activeTab === "school" ? selectedSchoolChapterName : selectedUpscModuleName;
    const topicName = ((note as any).topicTitle || (note as any).topicName || note.partLabel || "").trim();

    setPracticeTestTarget({
      classGrade,
      subject,
      chapterNo,
      chapterName: chapterName || `Chapter ${chapterNo}`,
      topicName: topicName || `Topic ${(note as any).topicNumber || note.topicNo || 1}`,
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 sm:rounded-2xl border-0 sm:border border-slate-200/80 dark:border-slate-800/80 overflow-hidden" id="admin-notes-management">
      {/* Toast Notification */}
      {toast && (
        <div 
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 animate-slideUp text-xs font-bold ${
            toast.type === "success" 
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20" 
              : toast.type === "error" 
              ? "bg-rose-600 text-white border-rose-500 shadow-rose-500/20" 
              : "bg-slate-900 text-white border-slate-700"
          }`}
        >
          {toast.type === "success" && <CheckCircle2 className="w-4 h-4" />}
          {toast.type === "error" && <AlertTriangle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Grid Layout: Left Hierarchy Sidebar + Right Topic Notes Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* =========================================================================
            LEFT SIDEBAR: HIERARCHY NAVIGATION (School or UPSC)
            ========================================================================= */}
        <aside className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 shrink-0 overflow-hidden max-h-72 lg:max-h-none" id="notes-sidebar">
          {/* Top Switcher: School vs UPSC */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
            <div className="flex rounded-xl bg-slate-200/70 dark:bg-slate-800/70 p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("school");
                  setSearchQuery("");
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "school"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                id="school-tab-btn"
              >
                <School className="w-4 h-4" />
                <span>SCHOOL</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("upsc");
                  setSearchQuery("");
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "upsc"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                id="upsc-tab-btn"
              >
                <GraduationCap className="w-4 h-4" />
                <span>UPSC</span>
              </button>
            </div>
          </div>

          {/* Hierarchy Cascade Columns / Sections */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-6 scrollbar-thin overscroll-contain" id="notes-sidebar-scroll">
            {activeTab === "school" ? (
              <>
                {/* 1. Classes List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Classes
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {schoolClasses.length} Available
                    </span>
                  </div>

                  {schoolClasses.length === 0 ? (
                    <div className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <p className="text-xs text-slate-400 font-medium">No classes created yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-1.5" id="school-classes-list">
                      {schoolClasses.map((cls) => {
                        const isSelected = selectedSchoolClass.toLowerCase() === cls.toLowerCase();
                        const classNotesCount = schoolNotes.filter((n) => {
                          const c = (n as any).className || n.classGrade || (n as any).class || "";
                          return c.toLowerCase() === cls.toLowerCase();
                        }).length;

                        return (
                          <div
                            key={cls}
                            onClick={() => setSelectedSchoolClass(cls)}
                            className={`group px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between gap-1.5 border cursor-pointer ${
                              isSelected
                                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300/80 dark:border-blue-700/80 shadow-2xs"
                                : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                            id={`class-btn-${cls.replace(/\s+/g, "-")}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="truncate">{cls}</span>
                              {classNotesCount > 0 && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200/60 dark:bg-slate-800 font-mono text-slate-500 dark:text-slate-400 shrink-0">
                                  {classNotesCount}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              title={`Delete ${cls}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingClass(cls);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0 cursor-pointer"
                              id={`delete-class-${cls.replace(/\s+/g, "-")}`}
                              aria-label={`Delete ${cls}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* + New Class Button */}
                  <button
                    type="button"
                    onClick={() => setCreateNodeContext({ nodeType: "new_class", type: "school" })}
                    className="w-full mt-2.5 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-transparent text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    id="add-new-class-btn"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ New Class</span>
                  </button>
                </div>

                {/* 2. Subjects List for Selected Class */}
                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                      {selectedSchoolClass ? `Subjects • ${selectedSchoolClass}` : "Subjects"}
                    </span>
                  </div>

                  {!selectedSchoolClass ? (
                    <p className="text-xs text-slate-400 italic p-2">Create or select a class first</p>
                  ) : schoolSubjectsForSelectedClass.length === 0 ? (
                    <div className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <p className="text-xs text-slate-400 font-medium">No subjects added to {selectedSchoolClass}</p>
                    </div>
                  ) : (
                    <div className="space-y-1" id="school-subjects-list">
                      {schoolSubjectsForSelectedClass.map((subj) => {
                        const isSelected = selectedSchoolSubject.toLowerCase() === subj.toLowerCase();
                        const subjNotesCount = schoolNotes.filter((n) => {
                          const c = (n as any).className || n.classGrade || (n as any).class || "";
                          const s = (n as any).subjectName || n.subject || "";
                          return c.toLowerCase() === selectedSchoolClass.toLowerCase() && s.toLowerCase() === subj.toLowerCase();
                        }).length;

                        return (
                          <div
                            key={subj}
                            className={`group/subj w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1.5 border ${
                              isSelected
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedSchoolSubject(subj)}
                              className="flex items-center gap-2 min-w-0 flex-1 text-left py-0.5"
                              id={`subject-btn-${subj.replace(/\s+/g, "-")}`}
                            >
                              <BookOpen className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-blue-100" : "text-slate-400"}`} />
                              <span className="truncate">{subj}</span>
                              {subjNotesCount > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono shrink-0 ${
                                  isSelected ? "bg-blue-700 text-blue-100" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                                }`}>
                                  {subjNotesCount}
                                </span>
                              )}
                            </button>

                            {/* Action icons: Rename (📝) & Delete (🗑) */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRenameSubject(subj);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isSelected 
                                    ? "hover:bg-blue-700 text-blue-100" 
                                    : "text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                }`}
                                title={`Rename ${subj}`}
                                id={`rename-subj-${subj.replace(/\s+/g, "-")}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSubject(subj);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isSelected 
                                    ? "hover:bg-blue-700 text-blue-100 hover:text-rose-200" 
                                    : "text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                }`}
                                title={`Delete ${subj}`}
                                id={`delete-subj-${subj.replace(/\s+/g, "-")}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* + Add Subject Button */}
                  {selectedSchoolClass && (
                    <button
                      type="button"
                      onClick={() => setCreateNodeContext({ 
                        nodeType: "add_subject", 
                        type: "school", 
                        className: selectedSchoolClass 
                      })}
                      className="w-full mt-2.5 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-transparent text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      id="add-school-subject-btn"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Subject</span>
                    </button>
                  )}
                </div>

                {/* 3. Chapters List for Selected Subject */}
                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                      {selectedSchoolSubject ? `Chapters • ${selectedSchoolSubject}` : "Chapters"}
                    </span>
                  </div>

                  {!selectedSchoolSubject ? (
                    <p className="text-xs text-slate-400 italic p-2">Create or select a subject first</p>
                  ) : schoolChaptersForSelected.length === 0 ? (
                    <div className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <p className="text-xs text-slate-400 font-medium">No chapters added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1" id="school-chapters-list">
                      {schoolChaptersForSelected.map((ch) => {
                        const isSelected = selectedSchoolChapterNo === ch.number;
                        const chNotesCount = schoolNotes.filter((n) => {
                          const c = (n as any).className || n.classGrade || (n as any).class || "";
                          const s = (n as any).subjectName || n.subject || "";
                          const chNo = (n as any).chapterNumber ?? n.chapterNo ?? 1;
                          return c.toLowerCase() === selectedSchoolClass.toLowerCase() && 
                                 s.toLowerCase() === selectedSchoolSubject.toLowerCase() && 
                                 Number(chNo) === ch.number;
                        }).length;

                        return (
                          <div
                            key={ch.number}
                            className={`group/ch w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1.5 border ${
                              isSelected
                                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-sm"
                                : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSchoolChapterNo(ch.number);
                                setSelectedSchoolChapterName(ch.name);
                              }}
                              className="flex items-center gap-2 min-w-0 flex-1 text-left py-0.5"
                              id={`chapter-btn-${ch.number}`}
                            >
                              <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-slate-300 dark:text-slate-700" : "text-slate-400"}`} />
                              <span className="truncate">
                                Ch {ch.number}: {ch.name}
                              </span>
                              {chNotesCount > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono shrink-0 ${
                                  isSelected ? "bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                                }`}>
                                  {chNotesCount}
                                </span>
                              )}
                            </button>

                            {/* Action icons: Edit Chapter No & Name (📝) & Delete (🗑) */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRenameChapter(ch.number, ch.name);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isSelected 
                                    ? "hover:bg-slate-800 dark:hover:bg-slate-200 text-slate-300 dark:text-slate-700 hover:text-white dark:hover:text-slate-900" 
                                    : "text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                }`}
                                title={`Edit Chapter ${ch.number}: ${ch.name}`}
                                id={`rename-ch-${ch.number}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChapter(ch.number);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isSelected 
                                    ? "hover:bg-slate-800 dark:hover:bg-slate-200 text-slate-300 dark:text-slate-700 hover:text-rose-300 dark:hover:text-rose-600" 
                                    : "text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                }`}
                                title={`Delete Chapter ${ch.number}`}
                                id={`delete-ch-${ch.number}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* + Add Chapter Button */}
                  {selectedSchoolSubject && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextChNum = schoolChaptersForSelected.length > 0 
                          ? Math.max(...schoolChaptersForSelected.map((c) => c.number)) + 1 
                          : 1;
                        setCreateNodeContext({
                          nodeType: "add_chapter",
                          type: "school",
                          className: selectedSchoolClass,
                          subject: selectedSchoolSubject,
                          suggestedNumber: nextChNum,
                        });
                      }}
                      className="w-full mt-2.5 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-transparent text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      id="add-school-chapter-btn"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Chapter</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* =========================================================================
                    UPSC LEFT HIERARCHY
                    ========================================================================= */}
                {/* 1. GS Papers List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      GS Papers
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {upscPapers.length} Available
                    </span>
                  </div>

                  {upscPapers.length === 0 ? (
                    <div className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <p className="text-xs text-slate-400 font-medium">No GS papers created yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1" id="upsc-papers-list">
                      {upscPapers.map((paper) => {
                        const isSelected = selectedUpscPaper.toLowerCase() === paper.toLowerCase();
                        const paperNotesCount = upscNotes.filter((n) => {
                          const p = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
                          return p.toLowerCase() === paper.toLowerCase();
                        }).length;

                        return (
                          <button
                            key={paper}
                            type="button"
                            onClick={() => setSelectedUpscPaper(paper)}
                            className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between gap-1.5 border ${
                              isSelected
                                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300/80 dark:border-indigo-700/80 shadow-2xs"
                                : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                            id={`upsc-paper-btn-${paper.replace(/\s+/g, "-")}`}
                          >
                            <span className="truncate">{paper}</span>
                            {paperNotesCount > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200/60 dark:bg-slate-800 font-mono text-slate-500 dark:text-slate-400 shrink-0">
                                {paperNotesCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* + New GS Paper Button */}
                  <button
                    type="button"
                    onClick={() => setCreateNodeContext({ nodeType: "new_gs_paper", type: "upsc" })}
                    className="w-full mt-2.5 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-transparent text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    id="add-new-gs-paper-btn"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ New GS Paper</span>
                  </button>
                </div>

                {/* 2. Subjects List for Selected GS Paper */}
                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                      {selectedUpscPaper ? `Subjects • ${selectedUpscPaper}` : "Subjects"}
                    </span>
                  </div>

                  {!selectedUpscPaper ? (
                    <p className="text-xs text-slate-400 italic p-2">Create or select a GS paper first</p>
                  ) : upscSubjectsForSelectedPaper.length === 0 ? (
                    <div className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <p className="text-xs text-slate-400 font-medium">No subjects added to {selectedUpscPaper}</p>
                    </div>
                  ) : (
                    <div className="space-y-1" id="upsc-subjects-list">
                      {upscSubjectsForSelectedPaper.map((subj) => {
                        const isSelected = selectedUpscSubject.toLowerCase() === subj.toLowerCase();
                        const subjNotesCount = upscNotes.filter((n) => {
                          const p = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
                          const s = (n as any).subjectName || n.subject || "";
                          return p.toLowerCase() === selectedUpscPaper.toLowerCase() && s.toLowerCase() === subj.toLowerCase();
                        }).length;

                        return (
                          <div
                            key={subj}
                            className={`group/subj w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1.5 border ${
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedUpscSubject(subj)}
                              className="flex items-center gap-2 min-w-0 flex-1 text-left py-0.5"
                              id={`upsc-subject-btn-${subj.replace(/\s+/g, "-")}`}
                            >
                              <BookOpen className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-indigo-100" : "text-slate-400"}`} />
                              <span className="truncate">{subj}</span>
                              {subjNotesCount > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono shrink-0 ${
                                  isSelected ? "bg-indigo-700 text-indigo-100" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                                }`}>
                                  {subjNotesCount}
                                </span>
                              )}
                            </button>

                            {/* Action icons: Rename (📝) & Delete (🗑) */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRenameSubject(subj);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isSelected 
                                    ? "hover:bg-indigo-700 text-indigo-100" 
                                    : "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                }`}
                                title={`Rename ${subj}`}
                                id={`rename-upsc-subj-${subj.replace(/\s+/g, "-")}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSubject(subj);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isSelected 
                                    ? "hover:bg-indigo-700 text-indigo-100 hover:text-rose-200" 
                                    : "text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                }`}
                                title={`Delete ${subj}`}
                                id={`delete-upsc-subj-${subj.replace(/\s+/g, "-")}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* + Add Subject Button */}
                  {selectedUpscPaper && (
                    <button
                      type="button"
                      onClick={() => setCreateNodeContext({ 
                        nodeType: "add_subject", 
                        type: "upsc", 
                        gsPaper: selectedUpscPaper 
                      })}
                      className="w-full mt-2.5 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-transparent text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      id="add-upsc-subject-btn"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Subject</span>
                    </button>
                  )}
                </div>

                {/* 3. Modules List for Selected Subject */}
                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                      {selectedUpscSubject ? `Modules • ${selectedUpscSubject}` : "Modules"}
                    </span>
                  </div>

                  {!selectedUpscSubject ? (
                    <p className="text-xs text-slate-400 italic p-2">Create or select a subject first</p>
                  ) : upscModulesForSelected.length === 0 ? (
                    <div className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <p className="text-xs text-slate-400 font-medium">No modules added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1" id="upsc-modules-list">
                      {upscModulesForSelected.map((mod) => {
                        const isSelected = selectedUpscModuleNo === mod.number;
                        const modNotesCount = upscNotes.filter((n) => {
                          const p = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
                          const s = (n as any).subjectName || n.subject || "";
                          const modNo = (n as any).moduleNumber ?? (n as any).moduleNo ?? (n as any).chapterNumber ?? n.chapterNo ?? 1;
                          return p.toLowerCase() === selectedUpscPaper.toLowerCase() && 
                                 s.toLowerCase() === selectedUpscSubject.toLowerCase() && 
                                 Number(modNo) === mod.number;
                        }).length;

                        return (
                          <div
                            key={mod.number}
                            className={`group/mod w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1.5 border ${
                              isSelected
                                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-sm"
                                : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUpscModuleNo(mod.number);
                                setSelectedUpscModuleName(mod.name);
                              }}
                              className="flex items-center gap-2 min-w-0 flex-1 text-left py-0.5"
                              id={`module-btn-${mod.number}`}
                            >
                              <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-slate-300 dark:text-slate-700" : "text-slate-400"}`} />
                              <span className="truncate">
                                Mod {mod.number}: {mod.name}
                              </span>
                              {modNotesCount > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono shrink-0 ${
                                  isSelected ? "bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                                }`}>
                                  {modNotesCount}
                                </span>
                              )}
                            </button>

                            {/* Action icons: Edit Module No & Name (📝) & Delete (🗑) */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRenameChapter(mod.number, mod.name);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isSelected 
                                    ? "hover:bg-slate-800 dark:hover:bg-slate-200 text-slate-300 dark:text-slate-700 hover:text-white dark:hover:text-slate-900" 
                                    : "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                }`}
                                title={`Edit Module ${mod.number}: ${mod.name}`}
                                id={`rename-mod-${mod.number}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChapter(mod.number);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isSelected 
                                    ? "hover:bg-slate-800 dark:hover:bg-slate-200 text-slate-300 dark:text-slate-700 hover:text-rose-300 dark:hover:text-rose-600" 
                                    : "text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                }`}
                                title={`Delete Module ${mod.number}`}
                                id={`delete-mod-${mod.number}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* + Add Module Button */}
                  {selectedUpscSubject && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextModNum = upscModulesForSelected.length > 0 
                          ? Math.max(...upscModulesForSelected.map((m) => m.number)) + 1 
                          : 1;
                        setCreateNodeContext({
                          nodeType: "add_module",
                          type: "upsc",
                          gsPaper: selectedUpscPaper,
                          subject: selectedUpscSubject,
                          suggestedNumber: nextModNum,
                        });
                      }}
                      className="w-full mt-2.5 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-transparent text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      id="add-upsc-module-btn"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Module</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* =========================================================================
            RIGHT MAIN AREA: ACTIVE CHAPTER/MODULE TOPICS & TOPIC CARDS
            ========================================================================= */}
        <section className="flex-1 min-h-0 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden" id="notes-main-content">
          {/* Breadcrumb Navigation Bar (Fixed shrink-0) */}
          <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="text-slate-800 dark:text-slate-200 font-extrabold flex items-center gap-1">
                {activeTab === "school" ? <School className="w-3.5 h-3.5 text-blue-500" /> : <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />}
                {activeTab === "school" ? "School" : "UPSC"}
              </span>
              {(activeTab === "school" ? selectedSchoolClass : selectedUpscPaper) && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeTab === "school" ? selectedSchoolClass : selectedUpscPaper}</span>
                </>
              )}
              {(activeTab === "school" ? selectedSchoolSubject : selectedUpscSubject) && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeTab === "school" ? selectedSchoolSubject : selectedUpscSubject}</span>
                </>
              )}
              {((activeTab === "school" && selectedSchoolChapterNo > 0) || (activeTab === "upsc" && selectedUpscModuleNo > 0)) && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-blue-600 dark:text-blue-400 font-black">
                    {activeTab === "school" 
                      ? `Chapter ${selectedSchoolChapterNo}`
                      : `Module ${selectedUpscModuleNo}`
                    }
                  </span>
                </>
              )}
            </div>

            {/* Quick search inside active topics */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics in this chapter..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500"
                id="search-topics-input"
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

          {/* Chapter / Module Header: Title + Single Circular Topic Add Button (Fixed shrink-0) */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 truncate">
                {activeTab === "school" 
                  ? (selectedSchoolChapterNo > 0 
                      ? `Chapter ${selectedSchoolChapterNo}: ${selectedSchoolChapterName || "General"}` 
                      : (selectedSchoolSubject ? `${selectedSchoolSubject}` : selectedSchoolClass || "Select a Class"))
                  : (selectedUpscModuleNo > 0 
                      ? `Module ${selectedUpscModuleNo}: ${selectedUpscModuleName || "General"}` 
                      : (selectedUpscSubject ? `${selectedUpscSubject}` : selectedUpscPaper || "Select a GS Paper"))
                }
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {filteredAndSortedTopics.length} Topic Note{filteredAndSortedTopics.length === 1 ? "" : "s"} • {activeTab === "school" ? `${selectedSchoolClass || "No Class"} • ${selectedSchoolSubject || "No Subject"}` : `${selectedUpscPaper || "No Paper"} • ${selectedUpscSubject || "No Subject"}`}
              </p>
            </div>

            {/* Small circular '+' Topic Note Add Icon */}
            {((activeTab === "school" && selectedSchoolClass && selectedSchoolSubject && selectedSchoolChapterNo > 0) ||
              (activeTab === "upsc" && selectedUpscPaper && selectedUpscSubject && selectedUpscModuleNo > 0)) && (
              <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                title={activeTab === "school" ? `Add Topic Note to Chapter ${selectedSchoolChapterNo}` : `Add Topic Note to Module ${selectedUpscModuleNo}`}
                aria-label="Add Topic Note"
                id="add-topic-circular-btn"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </button>
            )}
          </div>

          {/* Topics List Body: Independent scrolling container */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3 scrollbar-thin overscroll-contain pb-12 sm:pb-8" id="notes-topics-scroll">
            {/* If no class / paper created */}
            {((activeTab === "school" && !selectedSchoolClass) || (activeTab === "upsc" && !selectedUpscPaper)) ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto" id="empty-class-state">
                <div 
                  onClick={() => setCreateNodeContext(activeTab === "school" ? { nodeType: "new_class", type: "school" } : { nodeType: "new_gs_paper", type: "upsc" })}
                  className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/60 border-2 border-dashed border-blue-400 dark:border-blue-700 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 cursor-pointer transition-transform hover:scale-110 shadow-sm"
                  title={activeTab === "school" ? "Create New Class" : "Create New GS Paper"}
                >
                  <Plus className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {activeTab === "school" ? "No classes created yet" : "No GS papers created yet"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Start building your curriculum by clicking below to add your first {activeTab === "school" ? "Class" : "GS Paper"}.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateNodeContext(activeTab === "school" ? { nodeType: "new_class", type: "school" } : { nodeType: "new_gs_paper", type: "upsc" })}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  {activeTab === "school" ? "+ New Class" : "+ New GS Paper"}
                </button>
              </div>
            ) : ((activeTab === "school" && !selectedSchoolSubject) || (activeTab === "upsc" && !selectedUpscSubject)) ? (
              /* If no subject created in selected class */
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto" id="empty-subject-state">
                <div 
                  onClick={() => setCreateNodeContext(activeTab === "school" ? { nodeType: "add_subject", type: "school", className: selectedSchoolClass } : { nodeType: "add_subject", type: "upsc", gsPaper: selectedUpscPaper })}
                  className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border-2 border-dashed border-indigo-400 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 cursor-pointer transition-transform hover:scale-110 shadow-sm"
                  title="Add Subject"
                >
                  <Plus className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No subjects in {activeTab === "school" ? selectedSchoolClass : selectedUpscPaper}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Add a subject to this {activeTab === "school" ? "class" : "paper"} to organize your chapters and topic notes.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateNodeContext(activeTab === "school" ? { nodeType: "add_subject", type: "school", className: selectedSchoolClass } : { nodeType: "add_subject", type: "upsc", gsPaper: selectedUpscPaper })}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  + Add Subject
                </button>
              </div>
            ) : ((activeTab === "school" && selectedSchoolChapterNo <= 0) || (activeTab === "upsc" && selectedUpscModuleNo <= 0)) ? (
              /* If no chapter created in selected subject */
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto" id="empty-chapter-state">
                <div 
                  onClick={() => setCreateNodeContext(activeTab === "school" 
                    ? { nodeType: "add_chapter", type: "school", className: selectedSchoolClass, subject: selectedSchoolSubject, suggestedNumber: 1 } 
                    : { nodeType: "add_module", type: "upsc", gsPaper: selectedUpscPaper, subject: selectedUpscSubject, suggestedNumber: 1 }
                  )}
                  className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/60 border-2 border-dashed border-blue-400 dark:border-blue-700 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 cursor-pointer transition-transform hover:scale-110 shadow-sm"
                  title={activeTab === "school" ? "Add Chapter" : "Add Module"}
                >
                  <Plus className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No {activeTab === "school" ? "chapters" : "modules"} in {activeTab === "school" ? selectedSchoolSubject : selectedUpscSubject}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Create a {activeTab === "school" ? "Chapter" : "Module"} (with customizable number & name) to upload topic notes.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateNodeContext(activeTab === "school" 
                    ? { nodeType: "add_chapter", type: "school", className: selectedSchoolClass, subject: selectedSchoolSubject, suggestedNumber: 1 } 
                    : { nodeType: "add_module", type: "upsc", gsPaper: selectedUpscPaper, subject: selectedUpscSubject, suggestedNumber: 1 }
                  )}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  {activeTab === "school" ? "+ Add Chapter" : "+ Add Module"}
                </button>
              </div>
            ) : filteredAndSortedTopics.length === 0 ? (
              /* Empty Topics State */
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto" id="empty-topics-state">
                <div 
                  onClick={() => setQuickAddOpen(true)}
                  className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/60 border-2 border-dashed border-blue-400 dark:border-blue-700 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 cursor-pointer transition-transform hover:scale-110 shadow-sm"
                  title="Click to upload topic note"
                >
                  <Plus className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No topic notes uploaded yet.
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Click the + icon to upload the first topic note.
                </p>
              </div>
            ) : (
              /* Topics Cards List */
              <div className="space-y-3" id="topic-notes-list">
                {filteredAndSortedTopics.map((note) => {
                  const hasTest = checkIfTopicHasPracticeTest(note);
                  return (
                    <TopicCard
                      key={note.id}
                      note={note}
                      topicNumber={(note as any).topicNumber ?? note.topicNo}
                      topicTitle={(note as any).topicTitle || (note as any).topicName || note.partLabel}
                      isAdmin={true}
                      hasPracticeTest={hasTest}
                      onPreview={(n) => setPreviewNote(n as ClassNote)}
                      onReplace={(n) => handleOpenReplace(n as ClassNote)}
                      onRename={(n) => handleOpenRename(n as ClassNote)}
                      onDelete={(n) => handleOpenDelete(n as ClassNote)}
                      onOpenPracticeTest={(n) => handleOpenPracticeTest(n as ClassNote)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* =========================================================================
          MODALS
          ========================================================================= */}

      {/* 1. Quick Add Topic Modal */}
      <QuickAddTopicModal
        isOpen={quickAddOpen}
        parentContext={parentContext}
        onClose={() => setQuickAddOpen(false)}
        onSuccess={(newNote) => {
          showToast(`Topic "${(newNote as any).topicTitle || (newNote as any).topicName || newNote.partLabel || "Note"}" uploaded successfully!`, "success");
          if (onRefresh) onRefresh();
        }}
      />

      {/* 2. Create Hierarchy Node Modal (Class, Subject, Chapter, Module) */}
      <CreateHierarchyNodeModal
        isOpen={Boolean(createNodeContext)}
        context={createNodeContext}
        onClose={() => setCreateNodeContext(null)}
        onSubmit={handleCreateNodeSubmit}
      />

      {/* 3. Document Preview Modal */}
      {previewNote && (
        <NotesPreviewModal
          isOpen={Boolean(previewNote)}
          note={previewNote}
          onClose={() => setPreviewNote(null)}
        />
      )}

      {/* 4. Replace Note Modal */}
      {replacingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-500" /> Replace Note File
              </h3>
              <button
                type="button"
                onClick={() => setReplacingNote(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload a replacement document for{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {(replacingNote as any).topicTitle || (replacingNote as any).topicName || replacingNote.partLabel || "Topic Note"}
              </strong>
              . This updates the file in-place.
            </p>

            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center">
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp,image/jpg"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setReplaceFile(e.target.files[0]);
                  }
                }}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {replaceFile && (
                <p className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  Selected: {replaceFile.name} ({(replaceFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReplacingNote(null)}
                disabled={isReplacing}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReplace}
                disabled={isReplacing || !replaceFile}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-md transition-all"
              >
                {isReplacing ? "Replacing..." : "Replace File"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Rename Note Modal */}
      {renamingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-500" /> Rename Topic Note
              </h3>
              <button
                type="button"
                onClick={() => setRenamingNote(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
                  placeholder="e.g. Real Numbers"
                  autoFocus
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
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
                placeholder={activeTab === "school" ? "Chapter 1" : "Module 1"}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenamingNote(null)}
                disabled={isRenaming}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                disabled={isRenaming || !renameTopicTitle.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 shadow-md transition-all"
              >
                {isRenaming ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Confirm Delete Modal */}
      {deletingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Delete Topic Note?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to delete{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {(deletingNote as any).topicTitle || (deletingNote as any).topicName || deletingNote.partLabel || "this note"}
                </strong>
                ? This permanently removes the file from Cloudflare R2 storage.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingNote(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete Note"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6b. Rename Subject Modal */}
      {renamingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
                <Pencil className="w-4 h-4 text-blue-500" />
                <span>Rename Subject</span>
              </div>
              <button
                type="button"
                onClick={() => setRenamingSubject(null)}
                disabled={isRenamingSubject}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Current Subject
                </label>
                <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {renamingSubject.oldSubject}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  New Subject Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={renamingSubject.newSubject}
                  onChange={(e) => setRenamingSubject({ ...renamingSubject, newSubject: e.target.value })}
                  placeholder="Enter new subject name..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isRenamingSubject) {
                      e.preventDefault();
                      handleConfirmRenameSubject();
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRenamingSubject(null)}
                disabled={isRenamingSubject}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRenameSubject}
                disabled={isRenamingSubject || !renamingSubject.newSubject.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                {isRenamingSubject ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6c. Rename Chapter / Module Modal */}
      {renamingChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
                <Pencil className="w-4 h-4 text-blue-500" />
                <span>{renamingChapter.type === "school" ? "Edit Chapter" : "Edit Module"}</span>
              </div>
              <button
                type="button"
                onClick={() => setRenamingChapter(null)}
                disabled={isRenamingChapter}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    {renamingChapter.type === "school" ? "Ch #" : "Mod #"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={renamingChapter.newNumber}
                    onChange={(e) => setRenamingChapter({ 
                      ...renamingChapter, 
                      newNumber: e.target.value === "" ? "" : parseInt(e.target.value, 10) 
                    })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    {renamingChapter.type === "school" ? "Chapter Name" : "Module Name"} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={renamingChapter.newName}
                    onChange={(e) => setRenamingChapter({ ...renamingChapter, newName: e.target.value })}
                    placeholder={renamingChapter.type === "school" ? "e.g. Real Numbers" : "e.g. Historical Background"}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isRenamingChapter) {
                        e.preventDefault();
                        handleConfirmRenameChapter();
                      }
                    }}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                You can independently edit the {renamingChapter.type === "school" ? "Chapter Number and Chapter Name" : "Module Number and Module Name"} without affecting uploaded topic notes.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRenamingChapter(null)}
                disabled={isRenamingChapter}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRenameChapter}
                disabled={isRenamingChapter || !renamingChapter.newName.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                {isRenamingChapter ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6d. Delete Class Confirmation Modal */}
      {deletingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-600 dark:text-rose-400">
                <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Delete Class</span>
              </div>
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                disabled={isDeletingClass}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-left">
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-slate-100">"{deletingClass}"</span>?
              </p>
              
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300">This will permanently remove:</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 pl-1">
                  <li>All Subjects</li>
                  <li>All Chapters</li>
                  <li>All Topic Notes</li>
                  <li>Firestore metadata</li>
                  <li>Cloudflare files</li>
                </ul>
              </div>

              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                disabled={isDeletingClass}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClass}
                disabled={isDeletingClass}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 shadow-md shadow-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingClass ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Practice Test Builder Modal */}
      {practiceTestTarget && (
        <AdminPracticeTestModal
          isOpen={Boolean(practiceTestTarget)}
          onClose={() => setPracticeTestTarget(null)}
          classGrade={practiceTestTarget.classGrade}
          subject={practiceTestTarget.subject}
          chapterNo={practiceTestTarget.chapterNo}
          chapterName={practiceTestTarget.chapterName}
          topicName={practiceTestTarget.topicName}
          onPracticeTestChanged={() => {
            loadPracticeTests();
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
