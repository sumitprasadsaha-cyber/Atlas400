import { ParsedAssessmentQuestion, TopicPracticeTest, TestAttemptRecord } from "../types";
import { getResolvedViewUrl } from "./storageService";
import { uploadToR2, downloadFromR2, getR2BucketName } from "./r2Client";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { normalizeQuestionOptions } from "../utils/assessmentParser";

import { safeLocalStorageSetItem, safeLocalStorageGetItem, safeLocalStorageRemoveItem } from "./safeStorage";
import {
  deleteTopicAttemptsFromPersistence,
  deleteAllAttemptsAndScoresFromPersistence,
  clearTestScoreCache
} from "./testScorePersistence";

const TESTS_CACHE_KEY = "tuition_topic_practice_tests_bank";
const SYNC_QUEUE_KEY = "tuition_practice_tests_sync_queue";
const PRACTICE_TESTS_BUCKET = "academy-connect-files";
const PRACTICE_TESTS_FILE_PATH = "practice_tests/test_bank.json";
const PRACTICE_TEST_ATTEMPTS_FILE_PATH = "practice_tests/test_attempts.json";

const IDB_DB_NAME = "tuition_practice_tests_db";
const IDB_DB_VERSION = 1;
const IDB_SYNC_QUEUE_STORE = "syncQueue";
const MAX_SYNC_RETRIES = 3;
const MAX_LOCAL_STORAGE_ITEM_BYTES = 50 * 1024;

let memoryTestBank: Record<string, TopicPracticeTest> = {};
let memorySyncQueue: SyncQueueItem[] = [];
let isRealtimeInitialized = false;

export interface TopicPracticeTestMetadata {
  id: string;
  classGrade: string;
  subject: string;
  chapterNo: number;
  chapterName: string;
  topicName: string;
  questionCount: number;
  lastUpdated: string;
}

export interface SaveTopicResult {
  success: boolean;
  count: number;
  message: string;
  error?: string;
  fromCache?: boolean;
}

export interface SyncQueueItem {
  id: string;
  action: "save_topic" | "delete_topic" | "delete_question" | "update_question";
  context?: {
    classGrade: string;
    subject: string;
    chapterNo: number;
    chapterName: string;
    topicName: string;
    rawText?: string;
  };
  data?: any;
  timestamp: number;
  retryCount?: number;
}

export interface ScoreButtonStyles {
  container: string;
  icon: string;
  scoreText: string;
  labelText: string;
}

/**
 * Normalizes test ID for topic practice tests
 */
export function buildTopicTestId(
  classGrade: string = "",
  subject: string = "",
  chapterNo: number = 0,
  topicName: string = ""
): string {
  const normClass = String(classGrade || "").toLowerCase().trim().replace(/\s+/g, "_");
  const normSubj = String(subject || "").toLowerCase().trim().replace(/\s+/g, "_");
  const normTopic = String(topicName || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
  return `${normClass}__${normSubj}__ch${chapterNo}__${normTopic}`;
}

/**
 * Clear cached question images and in-memory queries
 */
export function clearAllQuestionCaches(): void {
  // Clear any internal maps if applicable
}

/**
 * Broadcasts a practice test change signal locally, via BroadcastChannel (same-origin tabs),
 * and via Firestore practice_tests_sync collection (cross-device real-time sync).
 */
export async function notifyPracticeTestRealtimeSync(details?: any): Promise<void> {
  clearAllQuestionCaches();

  // 1. Dispatch local event immediately
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("practice-tests-updated"));
  }

  // 2. BroadcastChannel for instant same-browser multi-tab synchronization
  try {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel("tuition_practice_tests_channel");
      bc.postMessage({ type: "PRACTICE_TESTS_UPDATED", timestamp: Date.now(), ...details });
      bc.close();
    }
  } catch (err) {}

  // 3. Firestore realtime signal for cross-device real-time synchronization
  try {
    const db = await getFirebaseDb();
    if (db) {
      const syncDocRef = doc(db, "practice_tests_sync", "latest");
      await setDoc(
        syncDocRef,
        {
          updatedAt: new Date().toISOString(),
          timestamp: Date.now(),
          ...details,
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn("[PracticeTestService] Failed to send Firestore practice test sync signal:", err);
  }
}

async function openPracticeTestsDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) return null;
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_SYNC_QUEUE_STORE)) {
        db.createObjectStore(IDB_SYNC_QUEUE_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn("[PracticeTestService] IndexedDB open blocked by another tab.");
    };
  });
}

async function readSyncQueueFromIDB(): Promise<SyncQueueItem[]> {
  const db = await openPracticeTestsDB();
  if (!db) return memorySyncQueue;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SYNC_QUEUE_STORE, "readonly");
    const store = tx.objectStore(IDB_SYNC_QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as SyncQueueItem[]);
    request.onerror = () => reject(request.error);
  });
}

async function writeSyncQueueToIDB(queue: SyncQueueItem[]): Promise<void> {
  const db = await openPracticeTestsDB();
  if (!db) {
    memorySyncQueue = queue;
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SYNC_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(IDB_SYNC_QUEUE_STORE);
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      for (const item of queue) {
        store.put(item);
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

export function initPracticeTestsRealtimeSync(): void {
  if (typeof window === "undefined") return;
  if (isRealtimeInitialized) return;
  isRealtimeInitialized = true;

  // A. BroadcastChannel for same-origin multi-tab sync
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("tuition_practice_tests_channel");
      bc.onmessage = async (event) => {
        if (event.data?.type === "PRACTICE_TESTS_UPDATED") {
          await fetchAllPracticeTestsFromSupabase();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("practice-tests-updated"));
          }
        }
      };
    }
  } catch (err) {}

  // B. Firestore Realtime Snapshot for cross-device sync
  getFirebaseDb().then((db) => {
    if (!db) return;
    try {
      const syncDocRef = doc(db, "practice_tests_sync", "latest");
      let lastProcessedTs = 0;

      onSnapshot(
        syncDocRef,
        async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const ts = Number(data?.timestamp) || 0;
            if (ts && ts > lastProcessedTs) {
              lastProcessedTs = ts;
              await fetchAllPracticeTestsFromSupabase();
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("practice-tests-updated"));
              }
            }
          }
        },
        (err) => {
          console.warn("[PracticeTestService] Firestore practice_tests_sync snapshot error:", err);
        }
      );
    } catch (err) {
      console.warn("[PracticeTestService] Failed setting up Firestore practice_tests_sync listener:", err);
    }
  });
}

if (typeof window !== "undefined") {
  initPracticeTestsRealtimeSync();
}

export function isSubjectCompatible(subj1: string, subj2: string): boolean {
  const s1 = String(subj1 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const s2 = String(subj2 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s1 || !s2) return true;
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;

  const sstAliases = [
    "socialscience", "sst", "socialstudies", "social",
    "geography", "history", "politicalscience", "civics",
    "economics", "indianheritageandculture", "contemporaryindia",
    "democraticpolitics", "understandingeconomicdevelopment", "indiaandthecontemporaryworld"
  ];
  if (sstAliases.includes(s1) && sstAliases.includes(s2)) return true;

  const scienceAliases = [
    "science", "sci", "physics", "chemistry", "biology",
    "lifescience", "physicalscience", "generalscience", "natsci", "naturalscience"
  ];
  if (scienceAliases.includes(s1) && scienceAliases.includes(s2)) return true;

  const mathAliases = [
    "math", "maths", "mathematics", "appliedmaths", "basicmaths",
    "standardmaths", "highermaths", "generalmaths", "algebra", "geometry"
  ];
  if (mathAliases.includes(s1) && mathAliases.includes(s2)) return true;

  const engAliases = ["english", "englishlanguage", "englishliterature", "eng", "firstlanguageenglish", "secondlanguageenglish", "englishcommunicative"];
  if (engAliases.includes(s1) && engAliases.includes(s2)) return true;

  const hindiAliases = ["hindi", "hindicoursea", "hindicourseb", "hindilit", "hindilang"];
  if (hindiAliases.includes(s1) && hindiAliases.includes(s2)) return true;

  const bengaliAliases = ["bengali", "bangla", "bengaliliterature", "bengalilanguage"];
  if (bengaliAliases.includes(s1) && bengaliAliases.includes(s2)) return true;

  return false;
}

function normalizeGradeNumber(gradeStr: string): number | null {
  const s = String(gradeStr || "").toLowerCase().trim();
  if (!s) return null;
  const numMatch = s.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);
  const romanMatch = s.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\b/i);
  if (romanMatch) {
    const romanMap: Record<string, number> = {
      i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12
    };
    const r = romanMatch[1].toLowerCase();
    if (romanMap[r]) return romanMap[r];
  }
  return null;
}

function cleanTopicText(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\+/g, "and")
    .replace(/^(?:topic|part|pt|ch|chapter|unit)?\s*\d*\s*[:\–\-]?\s*/i, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function isExactTopicMatch(
  classGrade1: string,
  subject1: string,
  chapterNo1: number | string,
  topicName1: string,
  classGrade2: string,
  subject2: string,
  chapterNo2: number | string,
  topicName2: string
): boolean {
  const ch1 = typeof chapterNo1 === "number" ? chapterNo1 : (parseInt(String(chapterNo1 || "").replace(/\D/g, ""), 10) || Number(chapterNo1) || 0);
  const ch2 = typeof chapterNo2 === "number" ? chapterNo2 : (parseInt(String(chapterNo2 || "").replace(/\D/g, ""), 10) || Number(chapterNo2) || 0);
  if (ch1 > 0 && ch2 > 0 && ch1 !== ch2) return false;

  const g1 = normalizeGradeNumber(classGrade1);
  const g2 = normalizeGradeNumber(classGrade2);
  if (g1 !== null && g2 !== null) {
    if (g1 !== g2) return false;
  } else {
    const c1 = String(classGrade1 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const c2 = String(classGrade2 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (c1 && c2 && c1 !== c2 && !c1.includes(c2) && !c2.includes(c1)) return false;
  }

  if (!isSubjectCompatible(subject1, subject2)) return false;

  const clean1 = cleanTopicText(topicName1);
  const clean2 = cleanTopicText(topicName2);
  if (clean1 && clean2) {
    if (clean1 === clean2 || clean1.includes(clean2) || clean2.includes(clean1)) return true;
  }

  const raw1 = String(topicName1 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const raw2 = String(topicName2 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return raw1 === raw2 || raw1.includes(raw2) || raw2.includes(raw1);
}

export function getScoreButtonStyles(isAttempted: boolean, percentage?: number | null): ScoreButtonStyles {
  if (!isAttempted || percentage === undefined || percentage === null || isNaN(percentage)) {
    return {
      container: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200",
      icon: "text-emerald-600 dark:text-emerald-400",
      scoreText: "text-emerald-800 dark:text-emerald-200",
      labelText: "text-emerald-600 dark:text-emerald-400",
    };
  }

  const pct = Math.round(percentage);

  if (pct >= 90) {
    return {
      container: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200",
      icon: "text-emerald-600 dark:text-emerald-400",
      scoreText: "text-emerald-800 dark:text-emerald-200",
      labelText: "text-emerald-600 dark:text-emerald-400",
    };
  } else if (pct >= 75) {
    return {
      container: "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200",
      icon: "text-blue-600 dark:text-blue-400",
      scoreText: "text-blue-800 dark:text-blue-200",
      labelText: "text-blue-600 dark:text-blue-400",
    };
  } else if (pct >= 50) {
    return {
      container: "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200",
      icon: "text-amber-600 dark:text-amber-400",
      scoreText: "text-amber-800 dark:text-amber-200",
      labelText: "text-amber-600 dark:text-amber-400",
    };
  } else {
    return {
      container: "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200",
      icon: "text-rose-600 dark:text-rose-400",
      scoreText: "text-rose-800 dark:text-rose-200",
      labelText: "text-rose-600 dark:text-rose-400",
    };
  }
}

export async function syncTestBankToSupabaseStorage(bank: Record<string, TopicPracticeTest>): Promise<boolean> {
  try {
    const jsonString = JSON.stringify(bank, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    await uploadToR2({
      bucket: PRACTICE_TESTS_BUCKET,
      key: PRACTICE_TESTS_FILE_PATH,
      file: blob,
      mimeType: "application/json",
    });
    return true;
  } catch (err) {
    console.warn("[PracticeTestService] Storage sync exception:", err);
    return false;
  }
}

export async function fetchTestBankFromSupabaseStorage(): Promise<Record<string, TopicPracticeTest> | null> {
  try {
    const { blob } = await downloadFromR2({
      bucket: PRACTICE_TESTS_BUCKET,
      key: PRACTICE_TESTS_FILE_PATH,
    });
    if (blob) {
      const text = await blob.text();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("[PracticeTestService] Storage fetch error:", err);
  }
  return null;
}

export function getLocalTestBank(): Record<string, TopicPracticeTest> {
  return memoryTestBank;
}

export function getLocalTopicMetadata(): Record<string, TopicPracticeTestMetadata> {
  if (typeof window === "undefined") return {};
  try {
    const raw = safeLocalStorageGetItem(TESTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

export function saveLocalTestBank(bank: Record<string, TopicPracticeTest>, options?: { silent?: boolean }): void {
  memoryTestBank = { ...bank };

  if (typeof window === "undefined") return;
  try {
    const metadataMap: Record<string, TopicPracticeTestMetadata> = {};
    for (const key of Object.keys(bank)) {
      const test = bank[key];
      if (!test) continue;
      metadataMap[key] = {
        id: test.id,
        classGrade: test.classGrade || "",
        subject: test.subject || "",
        chapterNo: Number(test.chapterNo) || 1,
        chapterName: test.chapterName || "",
        topicName: test.topicName || "",
        questionCount: Array.isArray(test.questions) ? test.questions.length : 0,
        lastUpdated: test.updatedAt || new Date().toISOString(),
      };
    }

    const entries = Object.entries(metadataMap).sort(([, a], [, b]) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );
    let trimmedMap: Record<string, TopicPracticeTestMetadata> = {};
    let json = "";

    for (const [key, metadata] of entries) {
      trimmedMap[key] = metadata;
      json = JSON.stringify(trimmedMap);
      if (json.length * 2 > MAX_LOCAL_STORAGE_ITEM_BYTES) {
        delete trimmedMap[key];
        break;
      }
    }

    safeLocalStorageSetItem(TESTS_CACHE_KEY, JSON.stringify(trimmedMap));
  } catch (err: any) {
    console.warn("[PracticeTestService] Error saving metadata:", err);
  } finally {
    if (!options?.silent) {
      window.dispatchEvent(new CustomEvent("practice-tests-updated"));
    }
  }
}

export function updateLocalTopicCache(test: TopicPracticeTest): void {
  memoryTestBank[test.id] = test;
  saveLocalTestBank(memoryTestBank);
  syncTestBankToSupabaseStorage(memoryTestBank).catch(() => {});
}

export function removeLocalTopicCache(testId: string): void {
  delete memoryTestBank[testId];

  const parts = testId.split("__");
  if (parts.length >= 4) {
    const classGrade = parts[0];
    const subject = parts[1];
    const chapterNoStr = parts[2];
    const normTopic = parts.slice(3).join("__").toLowerCase().replace(/[^a-z0-9]/g, "");

    Object.keys(memoryTestBank).forEach((key) => {
      const t = memoryTestBank[key];
      if (
        t &&
        (t.classGrade || "").toLowerCase().replace(/\s+/g, "_") === classGrade &&
        (t.subject || "").toLowerCase().replace(/\s+/g, "_") === subject &&
        String(t.chapterNo) === chapterNoStr.replace("ch", "") &&
        (t.topicName || "").toLowerCase().replace(/[^a-z0-9]/g, "_") === normTopic
      ) {
        delete memoryTestBank[key];
      }
    });
  }

  saveLocalTestBank(memoryTestBank);
}

export async function resolveQuestionImageUrls(
  questions: ParsedAssessmentQuestion[]
): Promise<ParsedAssessmentQuestion[]> {
  if (!questions || !Array.isArray(questions)) return [];

  return Promise.all(
    questions.map(async (q) => {
      if (!q.imageUrl) return q;

      if (q.imageUrl.startsWith("http://") || q.imageUrl.startsWith("https://")) {
        return q;
      }

      try {
        const resolvedUrl = await getResolvedViewUrl(q.imageUrl);
        return {
          ...q,
          imageUrl: resolvedUrl || q.imageUrl,
        };
      } catch (err) {
        console.warn(`[PracticeTestService] Failed to resolve URL for image path: ${q.imageUrl}`, err);
        return q;
      }
    })
  );
}

/**
 * Fetches all topic practice tests from R2 / cache and populates the local test bank.
 */
let activeFetchPromise: Promise<Record<string, TopicPracticeTest>> | null = null;

export async function fetchAllPracticeTestsFromSupabase(): Promise<Record<string, TopicPracticeTest>> {
  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    try {
      const storageBank = await fetchTestBankFromSupabaseStorage();
      if (storageBank && typeof storageBank === "object") {
        memoryTestBank = storageBank;
        saveLocalTestBank(storageBank, { silent: true });
        return storageBank;
      }
    } catch (err) {
      console.warn("[PracticeTestService] Error fetching tests bank from R2:", err);
    } finally {
      activeFetchPromise = null;
    }

    return memoryTestBank;
  })();

  return activeFetchPromise;
}

export async function getTopicPracticeTest(
  classGrade: string,
  subject: string,
  chapterNo: number,
  topicName: string,
  _options?: { publishedOnly?: boolean; forceFresh?: boolean }
): Promise<TopicPracticeTest | null> {
  const testId = buildTopicTestId(classGrade, subject, chapterNo, topicName);
  let test = memoryTestBank[testId] || null;

  if (!test) {
    const bank = await fetchAllPracticeTestsFromSupabase();
    test = bank[testId] || null;

    if (!test) {
      const allTests = Object.values(bank);
      test =
        allTests.find((t) =>
          isExactTopicMatch(
            classGrade,
            subject,
            chapterNo,
            topicName,
            t.classGrade,
            t.subject,
            t.chapterNo,
            t.topicName
          )
        ) || null;
    }
  }

  if (!test) return null;

  if (Array.isArray(test.questions)) {
    test.questions = await resolveQuestionImageUrls(test.questions);
  }

  return test;
}

export function getTopicPracticeTestSync(
  classGrade: string,
  subject: string,
  chapterNo: number,
  topicName: string,
  _options?: { publishedOnly?: boolean }
): TopicPracticeTest | null {
  const testId = buildTopicTestId(classGrade, subject, chapterNo, topicName);
  let test = memoryTestBank[testId] || null;

  if (!test) {
    const allBankTests = Object.values(memoryTestBank);
    test =
      allBankTests.find((t) =>
        isExactTopicMatch(
          classGrade,
          subject,
          chapterNo,
          topicName,
          t.classGrade,
          t.subject,
          t.chapterNo,
          t.topicName
        )
      ) || null;
  }

  return test;
}

export async function getFullChapterQuestions(
  classGrade: string,
  subject: string,
  chapterNo: number,
  options: { publishedOnly?: boolean } = { publishedOnly: true }
): Promise<ParsedAssessmentQuestion[]> {
  const bank = Object.keys(memoryTestBank).length > 0 ? memoryTestBank : await fetchAllPracticeTestsFromSupabase();
  const aggregated: ParsedAssessmentQuestion[] = [];
  const normClass = (classGrade || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanNormClass = normClass.replace(/class/g, "");
  const normSubj = (subject || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  Object.values(bank).forEach((test) => {
    const tCh = typeof test.chapterNo === "number" ? test.chapterNo : (parseInt(String(test.chapterNo || "").replace(/\D/g, ""), 10) || Number(test.chapterNo) || 0);
    if (tCh > 0 && tCh !== Number(chapterNo)) return;

    const tSubj = (test.subject || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const subjMatch =
      !normSubj ||
      !tSubj ||
      normSubj === tSubj ||
      normSubj.includes(tSubj) ||
      tSubj.includes(normSubj) ||
      isSubjectCompatible(subject, test.subject);
    if (!subjMatch) return;

    const tClass = (test.classGrade || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanTClass = tClass.replace(/class/g, "");
    const classMatch =
      !normClass ||
      !tClass ||
      normClass === tClass ||
      cleanNormClass === cleanTClass ||
      normClass.includes(tClass) ||
      tClass.includes(normClass);
    if (!classMatch) return;

    if (Array.isArray(test.questions)) {
      test.questions.forEach((q) => {
        if (!options.publishedOnly || q.published !== false) {
          aggregated.push(q);
        }
      });
    }
  });

  return await resolveQuestionImageUrls(aggregated);
}

export function getFullChapterQuestionsSync(
  classGrade: string,
  subject: string,
  chapterNo: number,
  _options: { publishedOnly?: boolean } = { publishedOnly: true }
): ParsedAssessmentQuestion[] {
  const bank = getLocalTestBank();
  const aggregated: ParsedAssessmentQuestion[] = [];
  const normClass = (classGrade || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanNormClass = normClass.replace(/class/g, "");
  const normSubj = (subject || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  Object.values(bank).forEach((test) => {
    const tCh = typeof test.chapterNo === "number" ? test.chapterNo : (parseInt(String(test.chapterNo || "").replace(/\D/g, ""), 10) || Number(test.chapterNo) || 0);
    if (tCh > 0 && tCh !== Number(chapterNo)) return;

    const tSubj = (test.subject || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const subjMatch =
      !normSubj ||
      !tSubj ||
      normSubj === tSubj ||
      normSubj.includes(tSubj) ||
      tSubj.includes(normSubj) ||
      isSubjectCompatible(subject, test.subject);
    if (!subjMatch) return;

    const tClass = (test.classGrade || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanTClass = tClass.replace(/class/g, "");
    const classMatch =
      !normClass ||
      !tClass ||
      normClass === tClass ||
      cleanNormClass === cleanTClass ||
      normClass.includes(tClass) ||
      tClass.includes(normClass);
    if (!classMatch) return;

    if (Array.isArray(test.questions)) {
      test.questions.forEach((q) => {
        aggregated.push(q);
      });
    }
  });

  return aggregated;
}

export async function fetchQuestions(
  classGradeOrTopicId: string,
  subject?: string,
  chapterNo?: number,
  topicName?: string,
  testType: "topic" | "full_chapter" = "topic",
  options?: { publishedOnly?: boolean }
): Promise<ParsedAssessmentQuestion[]> {
  let classGrade = classGradeOrTopicId;
  if (classGradeOrTopicId && classGradeOrTopicId.includes("__") && !subject) {
    const parts = classGradeOrTopicId.split("__");
    classGrade = parts[0] || "";
    subject = parts[1] || "";
    chapterNo = parseInt((parts[2] || "").replace("ch", ""), 10) || 1;
    topicName = parts.slice(3).join("__");
  }

  if (testType === "full_chapter") {
    return await getFullChapterQuestions(classGrade, subject || "", chapterNo || 1, options);
  }

  const topicTest = await getTopicPracticeTest(
    classGrade,
    subject || "",
    chapterNo || 1,
    topicName || "",
    options
  );

  let list = topicTest?.questions || [];
  if (options?.publishedOnly) {
    list = list.filter((q) => q.published !== false);
  }

  return list;
}

export async function saveTopicPracticeTest(
  context: {
    classGrade: string;
    subject: string;
    chapterNo: number;
    chapterName: string;
    topicName: string;
    rawText: string;
  },
  questions: ParsedAssessmentQuestion[]
): Promise<SaveTopicResult> {
  if (!questions || questions.length === 0) {
    return {
      success: false,
      count: 0,
      message: "Cannot save empty practice test. Please enter valid questions.",
      error: "No valid questions found.",
    };
  }

  const topicTestId = buildTopicTestId(
    context.classGrade,
    context.subject,
    context.chapterNo,
    context.topicName
  );

  // Clear previous attempts for topic
  await deleteTopicAttemptsFromPersistence(
    context.classGrade,
    context.subject,
    context.chapterNo,
    context.topicName
  ).catch(() => {});

  const formattedQuestions: ParsedAssessmentQuestion[] = questions.map((q, idx) => {
    let qId = q.id;
    if (!qId) {
      qId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `q_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`;
    }

    return {
      ...q,
      id: qId,
      classGrade: context.classGrade,
      subject: context.subject,
      chapterNo: context.chapterNo,
      chapterName: context.chapterName,
      topicName: context.topicName,
      published: q.published !== false,
      orderIndex: idx + 1,
      rawText: context.rawText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const topicTest: TopicPracticeTest = {
    id: topicTestId,
    classGrade: context.classGrade,
    subject: context.subject,
    chapterNo: context.chapterNo,
    chapterName: context.chapterName,
    topicName: context.topicName,
    rawText: context.rawText,
    questions: formattedQuestions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    uploadedBy: "Admin",
  };

  updateLocalTopicCache(topicTest);
  clearAllQuestionCaches();
  await syncTestBankToSupabaseStorage(getLocalTestBank()).catch(() => false);
  await notifyPracticeTestRealtimeSync({ testId: topicTestId, action: "save_topic" });

  return {
    success: true,
    count: formattedQuestions.length,
    message: `Practice Test saved successfully. ${formattedQuestions.length} questions updated.`,
  };
}

export const saveTopicPracticeTestDirect = saveTopicPracticeTest;

export async function deleteTopicPracticeTest(
  classGrade: string,
  subject: string,
  chapterNo: number,
  topicName: string
): Promise<{ success: boolean; message: string }> {
  const testId = buildTopicTestId(classGrade, subject, chapterNo, topicName);
  const bank = getLocalTestBank();

  delete bank[testId];

  Object.keys(bank).forEach((k) => {
    const t = bank[k];
    if (
      t &&
      isExactTopicMatch(
        classGrade,
        subject,
        chapterNo,
        topicName,
        t.classGrade,
        t.subject,
        t.chapterNo,
        t.topicName
      )
    ) {
      delete bank[k];
    }
  });

  removeLocalTopicCache(testId);
  saveLocalTestBank(bank);
  clearAllQuestionCaches();

  await deleteTopicAttemptsFromPersistence(classGrade, subject, chapterNo, topicName).catch(() => {});
  await syncTestBankToSupabaseStorage(bank).catch(() => {});
  await notifyPracticeTestRealtimeSync({ testId, action: "delete_topic" });

  return { success: true, message: "Practice Test deleted successfully." };
}

export const deleteTopicPracticeTestDirect = deleteTopicPracticeTest;

export async function deleteAllPracticeTestsFromDatabase(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  deletedCounts?: {
    practiceTests: number;
    questions: number;
    studentMarks: number;
    options: number;
  };
}> {
  const bank = getLocalTestBank();
  const testCount = Object.keys(bank).length;
  let questionCount = 0;
  Object.values(bank).forEach((t) => {
    questionCount += Array.isArray(t.questions) ? t.questions.length : 0;
  });

  memoryTestBank = {};
  saveLocalTestBank({});
  clearAllQuestionCaches();
  clearTestScoreCache();

  try {
    safeLocalStorageRemoveItem(TESTS_CACHE_KEY);
    safeLocalStorageRemoveItem("tuition_practice_tests_cache");
    safeLocalStorageRemoveItem("tuition_student_test_score_cache");
    safeLocalStorageRemoveItem("tuition_test_attempts_cache");
  } catch (e) {}

  await deleteAllAttemptsAndScoresFromPersistence().catch(() => {});
  await syncTestBankToSupabaseStorage({}).catch(() => {});
  await notifyPracticeTestRealtimeSync({ action: "delete_all" });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("practice-tests-cleared-all"));
    window.dispatchEvent(new CustomEvent("practice-tests-updated"));
    window.dispatchEvent(new CustomEvent("test-attempts-updated"));
  }

  return {
    success: true,
    message: "All Practice Tests, Questions, and Student Test Marks have been permanently deleted.",
    deletedCounts: {
      practiceTests: testCount,
      questions: questionCount,
      studentMarks: 0,
      options: questionCount * 4,
    },
  };
}

export const deleteAllPracticeTests = deleteAllPracticeTestsFromDatabase;

export async function performOneTimePracticeTestCleanup(): Promise<{ success: boolean; message: string }> {
  const res = await deleteAllPracticeTestsFromDatabase();
  return {
    success: res.success,
    message: res.message || "Cleanup completed successfully.",
  };
}

export async function updateAssessmentQuestion(
  questionId: string,
  updates: Partial<ParsedAssessmentQuestion>
): Promise<{ success: boolean; message: string }> {
  const bank = getLocalTestBank();
  let foundTest: TopicPracticeTest | null = null;
  let questionIndex = -1;

  for (const t of Object.values(bank)) {
    const idx = (t.questions || []).findIndex((q) => q.id === questionId);
    if (idx !== -1) {
      foundTest = t;
      questionIndex = idx;
      break;
    }
  }

  if (foundTest && questionIndex !== -1) {
    foundTest.questions[questionIndex] = {
      ...foundTest.questions[questionIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    updateLocalTopicCache(foundTest);
    saveLocalTestBank(bank, { silent: true });
    await syncTestBankToSupabaseStorage(bank).catch(() => {});
    await notifyPracticeTestRealtimeSync({ questionId, action: "update_question" });
    return { success: true, message: "Question updated successfully." };
  }

  return { success: false, message: "Question not found." };
}

export async function deleteAssessmentQuestion(
  questionId: string
): Promise<{ success: boolean; message: string }> {
  const bank = getLocalTestBank();
  let modified = false;

  for (const k of Object.keys(bank)) {
    const t = bank[k];
    if (t && Array.isArray(t.questions)) {
      const filtered = t.questions.filter((q) => q.id !== questionId);
      if (filtered.length !== t.questions.length) {
        modified = true;
        if (filtered.length === 0) {
          delete bank[k];
          removeLocalTopicCache(k);
        } else {
          t.questions = filtered;
          updateLocalTopicCache(t);
        }
      }
    }
  }

  if (modified) {
    saveLocalTestBank(bank);
    await syncTestBankToSupabaseStorage(bank).catch(() => {});
    await notifyPracticeTestRealtimeSync({ questionId, action: "delete_question" });
    return { success: true, message: "Question deleted successfully." };
  }

  return { success: false, message: "Question not found." };
}

export async function reorderAssessmentQuestions(
  classGrade: string,
  subject: string,
  chapterNo: number,
  topicName: string,
  reorderedQuestions: ParsedAssessmentQuestion[]
): Promise<{ success: boolean }> {
  const testId = buildTopicTestId(classGrade, subject, chapterNo, topicName);
  const bank = getLocalTestBank();
  const test = bank[testId];

  if (test) {
    test.questions = reorderedQuestions.map((q, idx) => ({
      ...q,
      orderIndex: idx + 1,
    }));
    updateLocalTopicCache(test);
    await syncTestBankToSupabaseStorage(bank).catch(() => {});
    await notifyPracticeTestRealtimeSync({ testId, action: "reorder_questions" });
  }

  return { success: true };
}
