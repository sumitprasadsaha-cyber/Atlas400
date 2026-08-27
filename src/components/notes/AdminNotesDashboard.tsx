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
  renameNotePipeline 
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
const STORAGE_CUSTOM_UPSC_PAPERS = "tuition_custom_upsc_papers";
const STORAGE_CUSTOM_UPSC_SUBJECTS = "tuition_custom_upsc_subjects";
const STORAGE_CUSTOM_UPSC_MODULES = "tuition_custom_upsc_modules";

// Default Standard School Classes
const DEFAULT_SCHOOL_CLASSES = [
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12"
];

// Default Standard School Subjects
const DEFAULT_SCHOOL_SUBJECTS: Record<string, string[]> = {
  "Class 6": ["Mathematics", "Science", "English", "Social Science", "Computer Science", "Hindi", "Bengali"],
  "Class 7": ["Mathematics", "Science", "English", "Social Science", "Computer Science", "Hindi", "Bengali"],
  "Class 8": ["Mathematics", "Science", "English", "Social Science", "Computer Science", "Hindi", "Bengali"],
  "Class 9": ["Mathematics", "Science", "English", "Social Science", "Computer Science", "Hindi", "Bengali"],
  "Class 10": ["Mathematics", "Science", "English", "Social Science", "Computer Science", "Hindi", "Bengali"],
  "Class 11": ["Physics", "Chemistry", "Mathematics", "Biology", "Computer Science", "English", "Economics", "Accountancy"],
  "Class 12": ["Physics", "Chemistry", "Mathematics", "Biology", "Computer Science", "English", "Economics", "Accountancy"],
};

// Default UPSC Papers
const DEFAULT_UPSC_PAPERS = [
  "General Studies Paper I",
  "General Studies Paper II",
  "General Studies Paper III",
  "General Studies Paper IV",
  "Essay",
  "Optional"
];

// Default UPSC Subjects
const DEFAULT_UPSC_SUBJECTS: Record<string, string[]> = {
  "General Studies Paper I": ["Indian Heritage & Culture", "History", "Geography of the World & Society"],
  "General Studies Paper II": ["Polity", "Governance", "Constitution", "Social Justice", "International Relations"],
  "General Studies Paper III": ["Economy", "Science & Technology", "Biodiversity", "Environment", "Security", "Disaster Management"],
  "General Studies Paper IV": ["Ethics", "Integrity", "Aptitude"],
  "Essay": ["Essay Writing & Strategy"],
  "Optional": ["History Optional", "Geography Optional", "Public Administration", "Sociology", "Political Science"]
};

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

  const [customUpscPapers, setCustomUpscPapers] = useState<string[]>(() => 
    safeGetStorageJson<string[]>(STORAGE_CUSTOM_UPSC_PAPERS, [])
  );
  const [customUpscSubjects, setCustomUpscSubjects] = useState<Record<string, string[]>>(() => 
    safeGetStorageJson<Record<string, string[]>>(STORAGE_CUSTOM_UPSC_SUBJECTS, {})
  );
  const [customUpscModules, setCustomUpscModules] = useState<Record<string, Record<string, Array<{ number: number; name: string }>>>>(() => 
    safeGetStorageJson(STORAGE_CUSTOM_UPSC_MODULES, {})
  );

  // Active Hierarchy Selection State - School
  const [selectedSchoolClass, setSelectedSchoolClass] = useState<string>("Class 10");
  const [selectedSchoolSubject, setSelectedSchoolSubject] = useState<string>("Mathematics");
  const [selectedSchoolChapterNo, setSelectedSchoolChapterNo] = useState<number>(1);
  const [selectedSchoolChapterName, setSelectedSchoolChapterName] = useState<string>("");

  // Active Hierarchy Selection State - UPSC
  const [selectedUpscPaper, setSelectedUpscPaper] = useState<string>("General Studies Paper II");
  const [selectedUpscSubject, setSelectedUpscSubject] = useState<string>("Polity");
  const [selectedUpscModuleNo, setSelectedUpscModuleNo] = useState<number>(1);
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
  // SCHOOL HIERARCHY COMPUTATION
  // =========================================================================
  // 1. Available Classes: Defaults + Notes Classes + Custom Classes
  const schoolClasses = useMemo(() => {
    const set = new Set<string>(DEFAULT_SCHOOL_CLASSES);
    customSchoolClasses.forEach((c) => set.add(c));
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
    if (schoolClasses.length > 0 && !schoolClasses.includes(selectedSchoolClass)) {
      setSelectedSchoolClass(schoolClasses[0]);
    }
  }, [schoolClasses, selectedSchoolClass]);

  // 2. Available Subjects for selected School Class
  const schoolSubjectsForSelectedClass = useMemo(() => {
    const set = new Set<string>();
    const defs = DEFAULT_SCHOOL_SUBJECTS[selectedSchoolClass] || [
      "Mathematics", "Science", "English", "Social Science", "Computer Science"
    ];
    defs.forEach((s) => set.add(s));

    const custom = customSchoolSubjects[selectedSchoolClass] || [];
    custom.forEach((s) => set.add(s));

    schoolNotes.forEach((n) => {
      const cls = (n as any).className || n.classGrade || (n as any).class || "";
      if (cls.toLowerCase() === selectedSchoolClass.toLowerCase()) {
        const s = (n as any).subjectName || n.subject || "";
        if (s && s.trim()) set.add(s.trim());
      }
    });

    return Array.from(set).sort();
  }, [selectedSchoolClass, schoolNotes, customSchoolSubjects]);

  // Ensure valid selected subject
  useEffect(() => {
    if (schoolSubjectsForSelectedClass.length > 0 && !schoolSubjectsForSelectedClass.includes(selectedSchoolSubject)) {
      setSelectedSchoolSubject(schoolSubjectsForSelectedClass[0]);
    }
  }, [schoolSubjectsForSelectedClass, selectedSchoolSubject]);

  // 3. Available Chapters for selected School Class & Subject
  const schoolChaptersForSelected = useMemo(() => {
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

    // If empty, provide at least Chapter 1
    if (map.size === 0) {
      map.set(1, "Chapter 1");
    }

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
    }
  }, [schoolChaptersForSelected, selectedSchoolChapterNo]);

  // =========================================================================
  // UPSC HIERARCHY COMPUTATION
  // =========================================================================
  // 1. Available GS Papers
  const upscPapers = useMemo(() => {
    const set = new Set<string>(DEFAULT_UPSC_PAPERS);
    customUpscPapers.forEach((p) => set.add(p));
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
    if (upscPapers.length > 0 && !upscPapers.includes(selectedUpscPaper)) {
      setSelectedUpscPaper(upscPapers[0]);
    }
  }, [upscPapers, selectedUpscPaper]);

  // 2. Available Subjects for selected GS Paper
  const upscSubjectsForSelectedPaper = useMemo(() => {
    const set = new Set<string>();
    const defs = DEFAULT_UPSC_SUBJECTS[selectedUpscPaper] || ["Polity", "Governance", "History", "Economy"];
    defs.forEach((s) => set.add(s));

    const custom = customUpscSubjects[selectedUpscPaper] || [];
    custom.forEach((s) => set.add(s));

    upscNotes.forEach((n) => {
      const p = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
      if (p.toLowerCase() === selectedUpscPaper.toLowerCase()) {
        const s = (n as any).subjectName || n.subject || "";
        if (s && s.trim()) set.add(s.trim());
      }
    });

    return Array.from(set).sort();
  }, [selectedUpscPaper, upscNotes, customUpscSubjects]);

  // Ensure valid selected UPSC subject
  useEffect(() => {
    if (upscSubjectsForSelectedPaper.length > 0 && !upscSubjectsForSelectedPaper.includes(selectedUpscSubject)) {
      setSelectedUpscSubject(upscSubjectsForSelectedPaper[0]);
    }
  }, [upscSubjectsForSelectedPaper, selectedUpscSubject]);

  // 3. Available Modules for selected UPSC Paper & Subject
  const upscModulesForSelected = useMemo(() => {
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

    // If empty, provide at least Module 1
    if (map.size === 0) {
      map.set(1, "Module 1");
    }

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
    <div className="flex flex-col h-full min-h-[85vh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden" id="admin-notes-management">
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
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* =========================================================================
            LEFT SIDEBAR: HIERARCHY NAVIGATION (School or UPSC)
            ========================================================================= */}
        <div className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
          {/* Top Switcher: School vs UPSC */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
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
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-1.5" id="school-classes-list">
                    {schoolClasses.map((cls) => {
                      const isSelected = selectedSchoolClass.toLowerCase() === cls.toLowerCase();
                      const classNotesCount = schoolNotes.filter((n) => {
                        const c = (n as any).className || n.classGrade || (n as any).class || "";
                        return c.toLowerCase() === cls.toLowerCase();
                      }).length;

                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => setSelectedSchoolClass(cls)}
                          className={`px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between gap-1.5 border ${
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300/80 dark:border-blue-700/80 shadow-2xs"
                              : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                          id={`class-btn-${cls.replace(/\s+/g, "-")}`}
                        >
                          <span className="truncate">{cls}</span>
                          {classNotesCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200/60 dark:bg-slate-800 font-mono text-slate-500 dark:text-slate-400 shrink-0">
                              {classNotesCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

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
                      Subjects • {selectedSchoolClass}
                    </span>
                  </div>

                  <div className="space-y-1" id="school-subjects-list">
                    {schoolSubjectsForSelectedClass.map((subj) => {
                      const isSelected = selectedSchoolSubject.toLowerCase() === subj.toLowerCase();
                      const subjNotesCount = schoolNotes.filter((n) => {
                        const c = (n as any).className || n.classGrade || (n as any).class || "";
                        const s = (n as any).subjectName || n.subject || "";
                        return c.toLowerCase() === selectedSchoolClass.toLowerCase() && s.toLowerCase() === subj.toLowerCase();
                      }).length;

                      return (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => setSelectedSchoolSubject(subj)}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between gap-2 border ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                          id={`subject-btn-${subj.replace(/\s+/g, "-")}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <BookOpen className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-blue-200" : "text-slate-400"}`} />
                            <span className="truncate">{subj}</span>
                          </div>
                          {subjNotesCount > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono shrink-0 ${
                              isSelected ? "bg-blue-700 text-blue-100" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                            }`}>
                              {subjNotesCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* + Add Subject Button */}
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
                </div>

                {/* 3. Chapters List for Selected Subject */}
                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                      Chapters • {selectedSchoolSubject}
                    </span>
                  </div>

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
                        <button
                          key={ch.number}
                          type="button"
                          onClick={() => {
                            setSelectedSchoolChapterNo(ch.number);
                            setSelectedSchoolChapterName(ch.name);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between gap-2 border ${
                            isSelected
                              ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-sm"
                              : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                          id={`chapter-btn-${ch.number}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-slate-300 dark:text-slate-700" : "text-slate-400"}`} />
                            <span className="truncate">
                              Ch {ch.number}: {ch.name}
                            </span>
                          </div>
                          {chNotesCount > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono shrink-0 ${
                              isSelected ? "bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                            }`}>
                              {chNotesCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* + Add Chapter Button */}
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
                  </div>

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
                      Subjects • {selectedUpscPaper}
                    </span>
                  </div>

                  <div className="space-y-1" id="upsc-subjects-list">
                    {upscSubjectsForSelectedPaper.map((subj) => {
                      const isSelected = selectedUpscSubject.toLowerCase() === subj.toLowerCase();
                      const subjNotesCount = upscNotes.filter((n) => {
                        const p = (n as any).gsPaper || (n as any).generalStudiesPaper || (n as any).paper || "";
                        const s = (n as any).subjectName || n.subject || "";
                        return p.toLowerCase() === selectedUpscPaper.toLowerCase() && s.toLowerCase() === subj.toLowerCase();
                      }).length;

                      return (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => setSelectedUpscSubject(subj)}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between gap-2 border ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                          id={`upsc-subject-btn-${subj.replace(/\s+/g, "-")}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <BookOpen className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-indigo-200" : "text-slate-400"}`} />
                            <span className="truncate">{subj}</span>
                          </div>
                          {subjNotesCount > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono shrink-0 ${
                              isSelected ? "bg-indigo-700 text-indigo-100" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                            }`}>
                              {subjNotesCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* + Add Subject Button */}
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
                </div>

                {/* 3. Modules List for Selected Subject */}
                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                      Modules • {selectedUpscSubject}
                    </span>
                  </div>

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
                        <button
                          key={mod.number}
                          type="button"
                          onClick={() => {
                            setSelectedUpscModuleNo(mod.number);
                            setSelectedUpscModuleName(mod.name);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between gap-2 border ${
                            isSelected
                              ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-sm"
                              : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                          id={`module-btn-${mod.number}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-slate-300 dark:text-slate-700" : "text-slate-400"}`} />
                            <span className="truncate">
                              Mod {mod.number}: {mod.name}
                            </span>
                          </div>
                          {modNotesCount > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono shrink-0 ${
                              isSelected ? "bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                            }`}>
                              {modNotesCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* + Add Module Button */}
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
                </div>
              </>
            )}
          </div>
        </div>

        {/* =========================================================================
            RIGHT MAIN AREA: ACTIVE CHAPTER/MODULE TOPICS & TOPIC CARDS
            ========================================================================= */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden">
          {/* Breadcrumb Navigation Bar */}
          <div className="px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="text-slate-800 dark:text-slate-200 font-extrabold flex items-center gap-1">
                {activeTab === "school" ? <School className="w-3.5 h-3.5 text-blue-500" /> : <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />}
                {activeTab === "school" ? "School" : "UPSC"}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>{activeTab === "school" ? selectedSchoolClass : selectedUpscPaper}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>{activeTab === "school" ? selectedSchoolSubject : selectedUpscSubject}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-blue-600 dark:text-blue-400 font-black">
                {activeTab === "school" 
                  ? `Chapter ${selectedSchoolChapterNo}`
                  : `Module ${selectedUpscModuleNo}`
                }
              </span>
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

          {/* Chapter / Module Header: Title + Single Circular Topic Add Button */}
          <div className="px-6 py-5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 truncate">
                {activeTab === "school" 
                  ? `Chapter ${selectedSchoolChapterNo}: ${selectedSchoolChapterName || "General"}`
                  : `Module ${selectedUpscModuleNo}: ${selectedUpscModuleName || "General"}`
                }
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {filteredAndSortedTopics.length} Topic Note{filteredAndSortedTopics.length === 1 ? "" : "s"} • {activeTab === "school" ? `${selectedSchoolClass} • ${selectedSchoolSubject}` : `${selectedUpscPaper} • ${selectedUpscSubject}`}
              </p>
            </div>

            {/* Small circular '+' Topic Note Add Icon */}
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
          </div>

          {/* Topics List Body */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {filteredAndSortedTopics.length === 0 ? (
              /* Empty State */
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
        </div>
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
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 shadow-md shadow-rose-500/20 transition-all"
              >
                {isDeleting ? "Deleting..." : "Delete Note"}
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
