/**
 * Atlas400 v5.0.5 — Notes Storage Refactor (Final Architecture)
 * Single Canonical Source of Truth for Notes Domain Model
 * 
 * Supported Types:
 * 1. School Notes (Class 6–12): Class -> Subject -> Chapter -> (Optional Topic) -> (Future Practice Tests)
 * 2. UPSC Notes: UPSC -> GS Paper -> Subject -> Module -> (Optional Topic) -> (Future Practice Tests)
 */

export type NoteType = "school" | "upsc";

/**
 * Storage root folder constants
 */
export const STORAGE_ROOTS = {
  SCHOOL: "class_notes",
  UPSC: "upsc",
} as const;

/**
 * Standard UPSC GS Paper mappings
 */
export const UPSC_GS_PAPER_CONFIG: Record<string, { displayName: string; folderName: string }> = {
  gs1: { displayName: "General Studies Paper I", folderName: "GS1" },
  gs2: { displayName: "General Studies Paper II", folderName: "GS2" },
  gs3: { displayName: "General Studies Paper III", folderName: "GS3" },
  gs4: { displayName: "General Studies Paper IV", folderName: "GS4" },
  essay: { displayName: "Essay", folderName: "Essay" },
  csat: { displayName: "CSAT", folderName: "CSAT" },
  optional: { displayName: "Optional Subject", folderName: "Optional" },
};

/**
 * School Note Canonical Metadata Model
 */
export interface SchoolNote {
  type: "school";
  id: string;
  className: string; // e.g. "Class 10"
  classFolder: string; // e.g. "Class_10"
  subject: string; // e.g. "Mathematics"
  chapterNumber: number; // e.g. 1
  chapterName: string; // e.g. "Real Numbers"
  chapterFolder: string; // e.g. "Chapter_01_Real_Numbers"
  topicNumber?: number; // e.g. 2 (optional)
  topicName?: string; // e.g. "Examples" (optional)
  topicFolder?: string; // e.g. "Topic_02_Examples" (optional)
  hasTopic: boolean;
  folderPath: string; // Directory containing the note
  storagePath: string; // Full R2 object key: class_notes/Class_10/Mathematics/Chapter_01_Real_Numbers/Topic_02_Examples/note.pdf
  r2Key: string; // Alias for storagePath
  practiceTestPath: string; // Reserved future path: class_notes/.../practice_tests/
  pdfUrl: string;
  fileName: string;
  fileType: "pdf" | "image";
  fileSize: number;
  mimeType: string;
  visibility: "all" | "selected" | "hidden";
  allowedStudentIds?: string[];
  allowedClasses?: string[];
  uploadedBy: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
  searchableText: string;
  version: "5.0.5";

  // Compatibility aliases strictly mapped from canonical fields
  classGrade: string;
  class: string;
  chapterNo: number;
  topicNo?: string;
  pdfFileName: string;
  storageKey: string;
}

/**
 * UPSC Note Canonical Metadata Model
 */
export interface UPSCNote {
  type: "upsc";
  id: string;
  className: "UPSC";
  classFolder: "upsc";
  gsPaper: string; // e.g. "General Studies Paper II"
  gsPaperFolder: string; // e.g. "GS2"
  subject: string; // e.g. "Polity"
  moduleNumber: number; // e.g. 3
  moduleName: string; // e.g. "Fundamental Rights"
  moduleFolder: string; // e.g. "Module_03_Fundamental_Rights"
  topicNumber?: number; // e.g. 1 (optional)
  topicName?: string; // e.g. "Basics" (optional)
  topicFolder?: string; // e.g. "Topic_01_Basics" (optional)
  hasTopic: boolean;
  folderPath: string; // Directory containing the note
  storagePath: string; // Full R2 object key: upsc/GS2/Polity/Module_03_Fundamental_Rights/Topic_01_Basics/note.pdf
  r2Key: string; // Alias for storagePath
  practiceTestPath: string; // Reserved future path: upsc/.../practice_tests/
  pdfUrl: string;
  fileName: string;
  fileType: "pdf" | "image";
  fileSize: number;
  mimeType: string;
  visibility: "all" | "selected" | "hidden";
  allowedStudentIds?: string[];
  allowedClasses?: string[];
  uploadedBy: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
  searchableText: string;
  version: "5.0.5";

  // Compatibility aliases strictly mapped from canonical fields
  classGrade: "UPSC";
  class: "UPSC";
  generalStudiesPaper: string;
  paper: string;
  chapterNo: number;
  chapterName: string;
  moduleNo: number;
  topicNo?: string;
  pdfFileName: string;
  storageKey: string;
}

export type NoteMetadata = SchoolNote | UPSCNote;

/**
 * Input fields received from Upload Forms, Add Topic forms, or API payloads.
 */
export interface NoteFormInput {
  className?: string;
  classGrade?: string;
  class?: string;
  subject?: string;
  subjectName?: string;

  // School fields
  chapterNumber?: number | string;
  chapterNo?: number | string;
  chapterName?: string;
  chapterTitle?: string;

  // UPSC fields
  gsPaper?: string;
  generalStudiesPaper?: string;
  paper?: string;
  moduleNumber?: number | string;
  moduleNo?: number | string;
  module_number?: number | string;
  moduleName?: string;
  moduleTitle?: string;
  module_name?: string;

  // Optional Topic fields
  topicNumber?: number | string;
  topicNo?: number | string;
  topic_number?: number | string;
  topicName?: string;
  topicTitle?: string;
  topic_name?: string;
  partLabel?: string;

  // File metadata
  fileName?: string;
  originalFilename?: string;
  pdfFileName?: string;
  fileSize?: number;
  file_size?: number;
  mimeType?: string;
  mime_type?: string;
  fileType?: "pdf" | "image";

  // Access & persistence
  visibility?: "all" | "selected" | "hidden" | string;
  allowedStudentIds?: string[];
  allowedClasses?: string[];
  uploadedBy?: string;
  pdfUrl?: string;
  r2Key?: string;
  storagePath?: string;
  storageKey?: string;
  createdAt?: string;
  uploadedAt?: string;
  updatedAt?: string;
}

/**
 * Validation Result containing specific error message identifying exact missing field.
 */
export interface NoteValidationResult {
  isValid: boolean;
  missingField?: string;
  error?: string;
}

/**
 * Pads a number to at least 2 digits (e.g. 1 -> "01", 10 -> "10")
 */
export function formatPaddedNumber(num: number | string): string {
  const parsed = typeof num === "number" ? num : parseInt(String(num).replace(/\D/g, ""), 10);
  if (isNaN(parsed) || parsed < 0) return "01";
  return parsed < 10 ? `0${parsed}` : String(parsed);
}

/**
 * Sanitizes strings for folder and path segment generation.
 * Replaces non-alphanumeric characters with underscores, eliminates consecutive underscores, and trims.
 * Example: "Number System" -> "Number_System", "Science & Technology" -> "Science_and_Technology"
 */
export function sanitizeFolderName(input?: string): string {
  if (!input) return "General";
  return input
    .trim()
    .replace(/&/g, "and")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "General";
}

/**
 * Normalizes Class into display name, folder name, and type
 */
export function formatClassFolder(input?: string): { className: string; classFolder: string; isUPSC: boolean } {
  const raw = String(input || "").trim();
  const clean = raw.toLowerCase();

  if (clean.includes("upsc")) {
    return { className: "UPSC", classFolder: "upsc", isUPSC: true };
  }

  const romanMap: Record<string, number> = {
    xii: 12, xi: 11, x: 10, ix: 9, viii: 8, vii: 7, vi: 6, v: 5, iv: 4, iii: 3, ii: 2, i: 1
  };

  const numMatch = clean.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    return { className: `Class ${num}`, classFolder: `Class_${num}`, isUPSC: false };
  }

  for (const [roman, num] of Object.entries(romanMap)) {
    if (new RegExp(`\\b${roman}\\b`, "i").test(clean)) {
      return { className: `Class ${num}`, classFolder: `Class_${num}`, isUPSC: false };
    }
  }

  const sanitized = sanitizeFolderName(raw);
  const display = raw.startsWith("Class ") ? raw : `Class ${raw}`;
  return { className: display, classFolder: sanitized.startsWith("Class_") ? sanitized : `Class_${sanitized}`, isUPSC: false };
}

/**
 * Normalizes UPSC GS Paper into standard display name and folder name (GS1, GS2, GS3, GS4, Essay, CSAT)
 */
export function formatGSPaperFolder(paper?: string): { gsPaper: string; gsPaperFolder: string } {
  const clean = String(paper || "").trim().toLowerCase();

  if (clean.includes("paper iv") || clean.includes("paper 4") || clean.includes("gs iv") || clean.includes("gs 4") || clean.includes("gs4") || clean.includes("gs-4")) {
    return { gsPaper: UPSC_GS_PAPER_CONFIG.gs4.displayName, gsPaperFolder: UPSC_GS_PAPER_CONFIG.gs4.folderName };
  }
  if (clean.includes("paper iii") || clean.includes("paper 3") || clean.includes("gs iii") || clean.includes("gs 3") || clean.includes("gs3") || clean.includes("gs-3")) {
    return { gsPaper: UPSC_GS_PAPER_CONFIG.gs3.displayName, gsPaperFolder: UPSC_GS_PAPER_CONFIG.gs3.folderName };
  }
  if (clean.includes("paper ii") || clean.includes("paper 2") || clean.includes("gs ii") || clean.includes("gs 2") || clean.includes("gs2") || clean.includes("gs-2")) {
    return { gsPaper: UPSC_GS_PAPER_CONFIG.gs2.displayName, gsPaperFolder: UPSC_GS_PAPER_CONFIG.gs2.folderName };
  }
  if (clean.includes("paper i") || clean.includes("paper 1") || clean.includes("gs i") || clean.includes("gs 1") || clean.includes("gs1") || clean.includes("gs-1")) {
    return { gsPaper: UPSC_GS_PAPER_CONFIG.gs1.displayName, gsPaperFolder: UPSC_GS_PAPER_CONFIG.gs1.folderName };
  }
  if (clean.includes("essay")) {
    return { gsPaper: UPSC_GS_PAPER_CONFIG.essay.displayName, gsPaperFolder: UPSC_GS_PAPER_CONFIG.essay.folderName };
  }
  if (clean.includes("csat")) {
    return { gsPaper: UPSC_GS_PAPER_CONFIG.csat.displayName, gsPaperFolder: UPSC_GS_PAPER_CONFIG.csat.folderName };
  }
  if (clean.includes("optional")) {
    return { gsPaper: UPSC_GS_PAPER_CONFIG.optional.displayName, gsPaperFolder: UPSC_GS_PAPER_CONFIG.optional.folderName };
  }

  return { gsPaper: "General Studies Paper I", gsPaperFolder: "GS1" };
}

/**
 * Formats Chapter folder: Chapter_01_Number_System
 */
export function formatChapterFolder(chapterNumber: number, chapterName: string): string {
  const padded = formatPaddedNumber(chapterNumber);
  const cleanName = sanitizeFolderName(chapterName.replace(/^(?:chapter|ch)\s*\.?\s*\d+\s*(?:[:–\-]|–|-)?\s*/i, ""));
  return `Chapter_${padded}_${cleanName}`;
}

/**
 * Formats Module folder: Module_03_Fundamental_Rights
 */
export function formatModuleFolder(moduleNumber: number, moduleName: string): string {
  const padded = formatPaddedNumber(moduleNumber);
  const cleanName = sanitizeFolderName(moduleName.replace(/^(?:module|mod)\s*\.?\s*\d+\s*(?:[:–\-]|–|-)?\s*/i, ""));
  return `Module_${padded}_${cleanName}`;
}

/**
 * Formats Topic folder: Topic_01_Basics
 * ONLY created when topic exists (number or name provided).
 */
export function formatTopicFolder(topicNumber?: number, topicName?: string): string | undefined {
  const hasNum = topicNumber !== undefined && !isNaN(topicNumber) && topicNumber > 0;
  const rawName = (topicName || "").trim().replace(/^(?:topic|part|pt)\s*\.?\s*\d+\s*(?:[:–\-]|–|-)?\s*/i, "").trim();
  const hasName = Boolean(rawName);

  if (!hasNum && !hasName) {
    return undefined;
  }

  if (hasNum && hasName) {
    return `Topic_${formatPaddedNumber(topicNumber!)}_${sanitizeFolderName(rawName)}`;
  }

  if (hasNum) {
    return `Topic_${formatPaddedNumber(topicNumber!)}`;
  }

  return `Topic_${sanitizeFolderName(rawName)}`;
}

/**
 * Single source of truth: Storage Path Generator
 * Generates deterministic Cloudflare R2 folder paths and object keys.
 */
export function generateStoragePaths(
  meta: {
    type: NoteType;
    classFolder: string;
    gsPaperFolder?: string;
    subject: string;
    chapterFolder?: string;
    moduleFolder?: string;
    topicFolder?: string;
  },
  fileName = "note.pdf"
): { folderPath: string; storagePath: string; practiceTestPath: string } {
  const cleanSubjectFolder = sanitizeFolderName(meta.subject);

  let folderPath = "";
  if (meta.type === "upsc") {
    const gsPaperFolder = meta.gsPaperFolder || "GS1";
    const moduleFolder = meta.moduleFolder || "Module_01_General";
    if (meta.topicFolder) {
      folderPath = `${STORAGE_ROOTS.UPSC}/${gsPaperFolder}/${cleanSubjectFolder}/${moduleFolder}/${meta.topicFolder}`;
    } else {
      folderPath = `${STORAGE_ROOTS.UPSC}/${gsPaperFolder}/${cleanSubjectFolder}/${moduleFolder}`;
    }
  } else {
    const classFolder = meta.classFolder || "Class_10";
    const chapterFolder = meta.chapterFolder || "Chapter_01_General";
    if (meta.topicFolder) {
      folderPath = `${STORAGE_ROOTS.SCHOOL}/${classFolder}/${cleanSubjectFolder}/${chapterFolder}/${meta.topicFolder}`;
    } else {
      folderPath = `${STORAGE_ROOTS.SCHOOL}/${classFolder}/${cleanSubjectFolder}/${chapterFolder}`;
    }
  }

  const storagePath = `${folderPath}/${fileName}`;
  const practiceTestPath = `${folderPath}/practice_tests`;

  return {
    folderPath,
    storagePath,
    practiceTestPath,
  };
}

/**
 * Single canonical Metadata Builder
 * Builds the complete, deterministic NoteMetadata object.
 */
export function buildCanonicalNoteMetadata(input: NoteFormInput): NoteMetadata {
  const rawClass = input.className || input.classGrade || input.class || "Class 10";
  const classInfo = formatClassFolder(rawClass);
  const isUPSC = classInfo.isUPSC;

  const rawSubject = (input.subject || input.subjectName || "General").trim().replace(/\s+/g, " ");
  const subject = rawSubject || "General";

  // File resolution
  const originalFilename = input.fileName || input.originalFilename || input.pdfFileName || "note.pdf";
  const ext = originalFilename.split(".").pop()?.toLowerCase() || "pdf";
  const fileType: "pdf" | "image" = ext === "pdf" ? "pdf" : "image";
  const mimeType = input.mimeType || input.mime_type || (fileType === "pdf" ? "application/pdf" : `image/${ext}`);
  const fileSize = input.fileSize || input.file_size || 0;

  // Topic parsing (strictly optional)
  let parsedTopicNumber: number | undefined = undefined;
  const rawTopicNo = input.topicNumber ?? input.topicNo ?? input.topic_number;
  if (rawTopicNo !== undefined && rawTopicNo !== null && String(rawTopicNo).trim() !== "") {
    const digits = parseInt(String(rawTopicNo).replace(/\D/g, ""), 10);
    if (!isNaN(digits) && digits > 0) {
      parsedTopicNumber = digits;
    }
  }

  let parsedTopicName: string | undefined = undefined;
  const rawTopicName = (input.topicName || input.topicTitle || input.topic_name || "").trim();
  if (rawTopicName) {
    parsedTopicName = rawTopicName.replace(/^(?:topic|part|pt)\s*\.?\s*\d+\s*(?:[:–\-]|–|-)?\s*/i, "").trim() || rawTopicName;
  } else if (input.partLabel && typeof input.partLabel === "string" && !/^\d+$/.test(input.partLabel)) {
    parsedTopicName = input.partLabel.trim();
  }

  const topicFolder = formatTopicFolder(parsedTopicNumber, parsedTopicName);
  const hasTopic = Boolean(topicFolder);

  const nowIso = new Date().toISOString();
  const createdAt = input.createdAt || input.uploadedAt || nowIso;
  const updatedAt = input.updatedAt || nowIso;
  const visibility = (input.visibility === "selected" || input.visibility === "hidden" ? input.visibility : "all") as "all" | "selected" | "hidden";
  const uploadedBy = input.uploadedBy || "Admin";

  if (isUPSC) {
    const gsInfo = formatGSPaperFolder(input.gsPaper || input.generalStudiesPaper || input.paper);
    const rawModNo = input.moduleNumber ?? input.moduleNo ?? input.module_number ?? input.chapterNumber ?? input.chapterNo ?? 1;
    const moduleNumber = typeof rawModNo === "number" ? rawModNo : parseInt(String(rawModNo).replace(/\D/g, ""), 10) || 1;
    let rawModName = (input.moduleName || input.moduleTitle || input.module_name || input.chapterName || input.chapterTitle || "Module 1").trim();
    rawModName = rawModName.replace(/^(?:module|mod)\s*\.?\s*\d+\s*(?:[:–\-]|–|-)?\s*/i, "").trim() || rawModName;

    const moduleFolder = formatModuleFolder(moduleNumber, rawModName);
    const paths = generateStoragePaths({
      type: "upsc",
      classFolder: "upsc",
      gsPaperFolder: gsInfo.gsPaperFolder,
      subject,
      moduleFolder,
      topicFolder,
    }, originalFilename);

    const topicSuffix = topicFolder ? `_${topicFolder.toLowerCase()}` : "";
    const id = `upsc_${gsInfo.gsPaperFolder.toLowerCase()}_${sanitizeFolderName(subject).toLowerCase()}_${moduleFolder.toLowerCase()}${topicSuffix}`;
    const searchableText = `UPSC ${gsInfo.gsPaper} ${subject} Module ${moduleNumber} ${rawModName} ${parsedTopicNumber ? `Topic ${parsedTopicNumber}` : ""} ${parsedTopicName || ""} ${originalFilename}`.trim();

    return {
      type: "upsc",
      id,
      className: "UPSC",
      classFolder: "upsc",
      gsPaper: gsInfo.gsPaper,
      gsPaperFolder: gsInfo.gsPaperFolder,
      subject,
      moduleNumber,
      moduleName: rawModName,
      moduleFolder,
      topicNumber: parsedTopicNumber,
      topicName: parsedTopicName,
      topicFolder,
      hasTopic,
      folderPath: paths.folderPath,
      storagePath: input.storagePath || input.r2Key || paths.storagePath,
      r2Key: input.r2Key || input.storagePath || paths.storagePath,
      practiceTestPath: paths.practiceTestPath,
      pdfUrl: input.pdfUrl || "",
      fileName: originalFilename,
      fileType,
      fileSize,
      mimeType,
      visibility,
      allowedStudentIds: input.allowedStudentIds,
      allowedClasses: input.allowedClasses,
      uploadedBy,
      uploadedAt: createdAt,
      createdAt,
      updatedAt,
      searchableText,
      version: "5.0.5",

      // Compatibility aliases
      classGrade: "UPSC",
      class: "UPSC",
      generalStudiesPaper: gsInfo.gsPaper,
      paper: gsInfo.gsPaper,
      chapterNo: moduleNumber,
      chapterName: rawModName,
      moduleNo: moduleNumber,
      topicNo: parsedTopicNumber !== undefined ? String(parsedTopicNumber) : undefined,
      pdfFileName: originalFilename,
      storageKey: input.storagePath || input.r2Key || paths.storagePath,
    };
  } else {
    const rawChNo = input.chapterNumber ?? input.chapterNo ?? 1;
    const chapterNumber = typeof rawChNo === "number" ? rawChNo : parseInt(String(rawChNo).replace(/\D/g, ""), 10) || 1;
    let rawChName = (input.chapterName || input.chapterTitle || "Chapter 1").trim();
    rawChName = rawChName.replace(/^(?:chapter|ch)\s*\.?\s*\d+\s*(?:[:–\-]|–|-)?\s*/i, "").trim() || rawChName;

    const chapterFolder = formatChapterFolder(chapterNumber, rawChName);
    const paths = generateStoragePaths({
      type: "school",
      classFolder: classInfo.classFolder,
      subject,
      chapterFolder,
      topicFolder,
    }, originalFilename);

    const topicSuffix = topicFolder ? `_${topicFolder.toLowerCase()}` : "";
    const id = `${classInfo.classFolder.toLowerCase()}_${sanitizeFolderName(subject).toLowerCase()}_${chapterFolder.toLowerCase()}${topicSuffix}`;
    const searchableText = `${classInfo.className} ${subject} Chapter ${chapterNumber} ${rawChName} ${parsedTopicNumber ? `Topic ${parsedTopicNumber}` : ""} ${parsedTopicName || ""} ${originalFilename}`.trim();

    return {
      type: "school",
      id,
      className: classInfo.className,
      classFolder: classInfo.classFolder,
      subject,
      chapterNumber,
      chapterName: rawChName,
      chapterFolder,
      topicNumber: parsedTopicNumber,
      topicName: parsedTopicName,
      topicFolder,
      hasTopic,
      folderPath: paths.folderPath,
      storagePath: input.storagePath || input.r2Key || paths.storagePath,
      r2Key: input.r2Key || input.storagePath || paths.storagePath,
      practiceTestPath: paths.practiceTestPath,
      pdfUrl: input.pdfUrl || "",
      fileName: originalFilename,
      fileType,
      fileSize,
      mimeType,
      visibility,
      allowedStudentIds: input.allowedStudentIds,
      allowedClasses: input.allowedClasses,
      uploadedBy,
      uploadedAt: createdAt,
      createdAt,
      updatedAt,
      searchableText,
      version: "5.0.5",

      // Compatibility aliases
      classGrade: classInfo.className,
      class: classInfo.className,
      chapterNo: chapterNumber,
      topicNo: parsedTopicNumber !== undefined ? String(parsedTopicNumber) : undefined,
      pdfFileName: originalFilename,
      storageKey: input.storagePath || input.r2Key || paths.storagePath,
    };
  }
}

/**
 * Type-driven metadata validation.
 * Operates strictly on the Canonical NoteMetadata object.
 * Returns exact missing field name.
 */
export function validateCanonicalNoteMetadata(meta: NoteMetadata): NoteValidationResult {
  if (!meta.className || !meta.className.trim()) {
    return { isValid: false, missingField: "className", error: "Missing className" };
  }

  if (!meta.subject || !meta.subject.trim()) {
    return { isValid: false, missingField: "subject", error: "Missing subject" };
  }

  if (meta.type === "upsc") {
    if (!meta.gsPaper || !meta.gsPaper.trim()) {
      return { isValid: false, missingField: "gsPaper", error: "Missing gsPaper" };
    }
    if (!meta.moduleNumber || isNaN(meta.moduleNumber) || meta.moduleNumber <= 0) {
      return { isValid: false, missingField: "moduleNumber", error: "Missing moduleNumber" };
    }
    if (!meta.moduleName || !meta.moduleName.trim()) {
      return { isValid: false, missingField: "moduleName", error: "Missing moduleName" };
    }
  } else {
    if (!meta.chapterNumber || isNaN(meta.chapterNumber) || meta.chapterNumber <= 0) {
      return { isValid: false, missingField: "chapterNumber", error: "Missing chapterNumber" };
    }
    if (!meta.chapterName || !meta.chapterName.trim()) {
      return { isValid: false, missingField: "chapterName", error: "Missing chapterName" };
    }
  }

  return { isValid: true };
}
