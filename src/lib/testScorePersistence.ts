/**
 * Student Practice Test Score Persistence Service
 * 
 * Provides complete cross-device synchronization for student practice test scores using Firestore.
 * Zero Supabase dependencies.
 */

import { TestAttemptRecord } from "../types";
import { 
  getLocalTestAttempts, 
  saveLocalTestAttemptsCache, 
  saveTestAttemptDoc, 
  subscribeToTestAttempts 
} from "./firestoreService";
import {
  downloadFromR2,
  uploadToR2,
  deleteFromR2,
  getR2BucketName,
} from "./r2Client";
import { getFirebaseDb } from "./firebase";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";

const PRACTICE_TESTS_BUCKET = getR2BucketName();
const TEST_SCORE_CACHE_KEY = "tuition_student_test_score_cache";

// In-memory cache for fast, synchronous UI reads
let inMemoryAttempts: TestAttemptRecord[] = [];

// Session cache for student scores per topic & student
const scoreSessionCache = new Map<string, TestAttemptRecord | null>();
const inFlightScoreRequests = new Map<string, Promise<TestAttemptRecord | null>>();

function cleanId(str?: string): string {
  if (!str) return "";
  return str.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
}

export function deduplicateAttempts(attempts: TestAttemptRecord[]): TestAttemptRecord[] {
  if (!Array.isArray(attempts)) return [];
  const map = new Map<string, TestAttemptRecord>();

  attempts.forEach((a) => {
    if (!a) return;
    const studentKey = cleanId(a.studentId) || cleanId(a.studentName);
    const testType = a.testType || "topic";
    const topicNorm = (a.topicName || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const key = `${studentKey}__${cleanId(a.classGrade)}__${cleanId(a.subject)}__ch${a.chapterNo}__${testType}__${topicNorm}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, a);
    } else {
      const existingDate = new Date(existing.submittedAt || existing.date || 0).getTime();
      const curDate = new Date(a.submittedAt || a.date || 0).getTime();
      if (curDate > existingDate || (a.score || 0) > (existing.score || 0)) {
        map.set(key, a);
      }
    }
  });

  return Array.from(map.values());
}

export function clearTestScoreCache(studentId?: string, topicKey?: string): void {
  if (!studentId && !topicKey) {
    scoreSessionCache.clear();
    inFlightScoreRequests.clear();
    return;
  }
  for (const key of scoreSessionCache.keys()) {
    if (studentId && key.includes(studentId)) {
      scoreSessionCache.delete(key);
    } else if (topicKey && key.includes(topicKey)) {
      scoreSessionCache.delete(key);
    }
  }
}

/**
 * Persists student test attempt score to Firestore
 */
export async function persistStudentTestScore(attempt: TestAttemptRecord): Promise<void> {
  if (!attempt) return;
  try {
    inMemoryAttempts = [attempt, ...inMemoryAttempts.filter((a) => a.id !== attempt.id)];
    await saveTestAttemptDoc(attempt);

    const studentKey = cleanId(attempt.studentId) || cleanId(attempt.studentName);
    const cacheKey = `${studentKey}_${cleanId(attempt.classGrade)}_${cleanId(attempt.subject)}_${attempt.chapterNo}_${attempt.topicName || ""}`;
    scoreSessionCache.set(cacheKey, attempt);
    saveLocalTestAttemptsCache(inMemoryAttempts);
  } catch (err) {
    console.warn("[ScorePersistence] Failed to persist test score to Firestore:", err);
  }
}

export const savePracticeTestAttemptToSupabase = persistStudentTestScore;

/**
 * Fetches the latest student score from Firestore
 */
export async function fetchStudentScore(
  studentId: string,
  classGrade: string,
  subject: string,
  chapterNo: number,
  topicName: string,
  testType: "topic" | "full_chapter" = "topic"
): Promise<TestAttemptRecord | null> {
  const studentKey = cleanId(studentId);
  const cacheKey = `${studentKey}_${cleanId(classGrade)}_${cleanId(subject)}_${chapterNo}_${topicName || ""}_${testType}`;

  if (scoreSessionCache.has(cacheKey)) {
    return scoreSessionCache.get(cacheKey) || null;
  }

  if (inFlightScoreRequests.has(cacheKey)) {
    return inFlightScoreRequests.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const db = await getFirebaseDb();
      if (!db) return null;

      const q = query(
        collection(db, "student_attempts"),
        where("studentId", "==", studentId)
      );

      const snapshot = await getDocs(q);
      let bestAttempt: TestAttemptRecord | null = null;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const normSubj = cleanId(data.subject);
        const matchSubj = normSubj === cleanId(subject);
        const matchChap = Number(data.chapterNo || data.chapter) === Number(chapterNo);
        const matchTopic = (data.topicName || "").toLowerCase().trim() === (topicName || "").toLowerCase().trim();

        if (matchSubj && matchChap && matchTopic) {
          const rec: TestAttemptRecord = {
            id: docSnap.id,
            attemptId: data.attemptId || docSnap.id,
            studentId: data.studentId,
            studentName: data.studentName,
            classGrade: data.classGrade || classGrade,
            subject: data.subject || subject,
            chapterNo: Number(data.chapterNo || chapterNo),
            chapterName: data.chapterName || "",
            topicName: data.topicName || topicName,
            testType: data.testType || testType,
            score: data.score || 0,
            totalMarks: data.totalMarks || 0,
            totalQuestions: data.totalQuestions || 0,
            percentage: data.percentage || 0,
            correctAnswersCount: data.correct || 0,
            wrongAnswersCount: data.wrong || 0,
            date: data.submittedAt || data.completedAt || new Date().toISOString(),
            submittedAt: data.submittedAt || data.completedAt || new Date().toISOString(),
            timeTakenSeconds: data.timeTaken || 0,
            timestamp: new Date(data.submittedAt || Date.now()).getTime(),
            userAnswers: data.answers || {},
          };

          const curTime = new Date(rec.submittedAt || 0).getTime();
          const bestTime = bestAttempt ? new Date(bestAttempt.submittedAt || 0).getTime() : 0;
          if (!bestAttempt || curTime > bestTime) {
            bestAttempt = rec;
          }
        }
      });

      scoreSessionCache.set(cacheKey, bestAttempt);
      return bestAttempt;
    } catch (err) {
      console.warn("[ScorePersistence] Error fetching score from Firestore:", err);
      return null;
    } finally {
      inFlightScoreRequests.delete(cacheKey);
    }
  })();

  inFlightScoreRequests.set(cacheKey, promise);
  return promise;
}

export async function fetchStudentTestAttemptsFromSupabase(studentId?: string, studentName?: string): Promise<TestAttemptRecord[]> {
  try {
    const db = await getFirebaseDb();
    if (!db) return [];

    let q = collection(db, "student_attempts");
    const snap = await getDocs(q);

    const res: TestAttemptRecord[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      if (!studentId || data.studentId === studentId) {
        res.push({
          id: docSnap.id,
          attemptId: data.attemptId || docSnap.id,
          studentId: data.studentId || "",
          studentName: data.studentName || "Student",
          classGrade: data.classGrade || "",
          subject: data.subject || "",
          chapterNo: Number(data.chapterNo || 1),
          topicName: data.topicName || "",
          testType: data.testType || "topic",
          score: data.score || 0,
          totalMarks: data.totalMarks || 0,
          totalQuestions: data.totalQuestions || 0,
          percentage: data.percentage || 0,
          correctAnswersCount: data.correct || 0,
          wrongAnswersCount: data.wrong || 0,
          date: data.submittedAt || new Date().toISOString(),
          submittedAt: data.submittedAt || new Date().toISOString(),
          timeTakenSeconds: data.timeTaken || 0,
          timestamp: new Date(data.submittedAt || Date.now()).getTime(),
          userAnswers: data.answers || {},
        });
      }
    });

    return res;
  } catch (err) {
    return [];
  }
}

export async function loadStudentTestScores(studentId?: string): Promise<void> {
  if (studentId) {
    await fetchStudentTestAttemptsFromSupabase(studentId);
  }
}

export function getCachedAttemptsFromMemory(): TestAttemptRecord[] {
  return inMemoryAttempts;
}

export function mergeAttemptsIntoMemoryAndCache(attempts: TestAttemptRecord[]): void {
  inMemoryAttempts = deduplicateAttempts([...inMemoryAttempts, ...attempts]);
}

export function notifyScoreUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("practice-scores-updated"));
  }
}

export async function deleteTopicAttemptsFromPersistence(
  classGrade: string,
  subject: string,
  chapterNo: number,
  topicName: string
): Promise<void> {
  try {
    const db = await getFirebaseDb();
    if (!db) return;

    const q = query(
      collection(db, "student_attempts"),
      where("subject", "==", subject)
    );

    const snapshot = await getDocs(q);
    const deletePromises: Promise<void>[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      if (
        Number(data.chapterNo || data.chapter) === Number(chapterNo) &&
        (data.topicName || "").toLowerCase().trim() === (topicName || "").toLowerCase().trim()
      ) {
        deletePromises.push(deleteDoc(doc(db, "student_attempts", docSnap.id)));
      }
    });

    await Promise.all(deletePromises);
    clearTestScoreCache();
  } catch (err) {
    console.warn("[ScorePersistence] Error deleting topic attempts:", err);
  }
}

export async function deleteAllAttemptsAndScoresFromPersistence(): Promise<void> {
  inMemoryAttempts = [];
  clearTestScoreCache();
  saveLocalTestAttemptsCache([]);
}
