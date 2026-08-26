import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "./firebase";
import { Student, ChapterNote, ClassNote, HomeworkRecord } from "../types";
import { safeLocalStorageGetItem, safeLocalStorageSetItem, safeLocalStorageRemoveItem } from "./safeStorage";

export interface StudentPortalFeatureFlags {
  dashboard: boolean;
  notes: boolean;
  practice_tests: boolean;
  homework: boolean;
  attendance: boolean;
  fees: boolean;
  notifications: boolean;
  profile: boolean;
  settings: boolean;
  study_timer: boolean;
  global_search: boolean;
}

export interface PortalMaintenanceConfig {
  isMaintenanceMode: boolean;
  message?: string;
  estimatedReturnTime?: string;
  affectedRoles?: ("student" | "parent" | "teacher")[];
}

export interface StudentHomeworkItem {
  id: string;
  classGrade: string;
  subject: string;
  title: string;
  description: string;
  dueDate: string;
  assignedBy?: string;
  createdAt: string;
  attachments?: Array<{
    name: string;
    url: string;
    size?: number;
    mimeType?: string;
  }>;
  status: "pending" | "submitted" | "completed" | "reviewed";
  submissionDate?: string;
  submissionRemarks?: string;
  submissionAttachmentUrl?: string;
  teacherRemarks?: string;
  grade?: string;
}

export interface StudentNotification {
  id: string;
  title: string;
  body: string;
  category: "notes" | "homework" | "tests" | "fees" | "attendance" | "general";
  createdAt: string;
  read: boolean;
  linkTab?: string;
  targetId?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

export interface StudentFeeEntry {
  id: string;
  month: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  status: "paid" | "unpaid" | "partial" | "na";
  paymentDate?: string;
  paymentMode?: "upi" | "card" | "bank_transfer" | "cash" | "other";
  receiptId?: string;
  remarks?: string;
}

const DEFAULT_FEATURE_FLAGS: StudentPortalFeatureFlags = {
  dashboard: true,
  notes: true,
  practice_tests: true,
  homework: true,
  attendance: true,
  fees: true,
  notifications: true,
  profile: true,
  settings: true,
  study_timer: true,
  global_search: true,
};

const OFFLINE_CACHE_KEYS = {
  STUDENT_PROFILE: "atlas_portal_cached_student_",
  HOMEWORK: "atlas_portal_cached_homework_",
  NOTIFICATIONS: "atlas_portal_cached_notifications_",
  FEATURE_FLAGS: "atlas_portal_cached_feature_flags",
  MAINTENANCE: "atlas_portal_cached_maintenance",
  LAST_SYNC: "atlas_portal_last_sync_timestamp",
};

export const studentPortalService = {
  // Feature Flags
  async getFeatureFlags(): Promise<StudentPortalFeatureFlags> {
    try {
      const db = await getFirebaseDb();
      if (!db) {
        const cached = safeLocalStorageGetItem(OFFLINE_CACHE_KEYS.FEATURE_FLAGS);
        return cached ? JSON.parse(cached) : DEFAULT_FEATURE_FLAGS;
      }
      const docRef = doc(db, "system_settings", "feature_flags");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const flags = { ...DEFAULT_FEATURE_FLAGS, ...snap.data() };
        safeLocalStorageSetItem(OFFLINE_CACHE_KEYS.FEATURE_FLAGS, JSON.stringify(flags));
        return flags;
      }
    } catch (e) {
      console.warn("[studentPortalService] Failed to fetch feature flags, using cached/defaults:", e);
    }
    const cached = safeLocalStorageGetItem(OFFLINE_CACHE_KEYS.FEATURE_FLAGS);
    return cached ? JSON.parse(cached) : DEFAULT_FEATURE_FLAGS;
  },

  subscribeToFeatureFlags(callback: (flags: StudentPortalFeatureFlags) => void): () => void {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const db = await getFirebaseDb();
        if (!db) return;
        const docRef = doc(db, "system_settings", "feature_flags");
        unsub = onSnapshot(
          docRef,
          (snap) => {
            if (snap.exists()) {
              const flags = { ...DEFAULT_FEATURE_FLAGS, ...snap.data() } as StudentPortalFeatureFlags;
              safeLocalStorageSetItem(OFFLINE_CACHE_KEYS.FEATURE_FLAGS, JSON.stringify(flags));
              callback(flags);
            } else {
              callback(DEFAULT_FEATURE_FLAGS);
            }
          },
          (err) => {
            console.warn("[studentPortalService] Feature flags realtime listener error:", err);
          }
        );
      } catch (err) {
        console.warn("[studentPortalService] Failed to subscribe to feature flags:", err);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  },

  // Maintenance Mode
  async getMaintenanceConfig(): Promise<PortalMaintenanceConfig> {
    try {
      const db = await getFirebaseDb();
      if (!db) {
        const cached = safeLocalStorageGetItem(OFFLINE_CACHE_KEYS.MAINTENANCE);
        return cached ? JSON.parse(cached) : { isMaintenanceMode: false };
      }
      const docRef = doc(db, "system_settings", "maintenance");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const config = snap.data() as PortalMaintenanceConfig;
        safeLocalStorageSetItem(OFFLINE_CACHE_KEYS.MAINTENANCE, JSON.stringify(config));
        return config;
      }
    } catch (e) {
      console.warn("[studentPortalService] Failed to check maintenance mode:", e);
    }
    const cached = safeLocalStorageGetItem(OFFLINE_CACHE_KEYS.MAINTENANCE);
    return cached ? JSON.parse(cached) : { isMaintenanceMode: false };
  },

  subscribeToMaintenanceConfig(callback: (config: PortalMaintenanceConfig) => void): () => void {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const db = await getFirebaseDb();
        if (!db) return;
        const docRef = doc(db, "system_settings", "maintenance");
        unsub = onSnapshot(
          docRef,
          (snap) => {
            if (snap.exists()) {
              const config = snap.data() as PortalMaintenanceConfig;
              safeLocalStorageSetItem(OFFLINE_CACHE_KEYS.MAINTENANCE, JSON.stringify(config));
              callback(config);
            } else {
              callback({ isMaintenanceMode: false });
            }
          },
          (err) => {
            console.warn("[studentPortalService] Maintenance realtime listener error:", err);
          }
        );
      } catch (err) {
        console.warn("[studentPortalService] Failed to subscribe to maintenance status:", err);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  },

  // Homework Module
  async getStudentHomework(studentId: string, classGrade: string): Promise<StudentHomeworkItem[]> {
    try {
      const db = await getFirebaseDb();
      if (!db) {
        const cached = safeLocalStorageGetItem(`${OFFLINE_CACHE_KEYS.HOMEWORK}${studentId}`);
        return cached ? JSON.parse(cached) : [];
      }

      // Query homework matching student's class grade
      const hwCol = collection(db, "homework");
      const q = query(hwCol, orderBy("dueDate", "asc"));
      const snap = await getDocs(q);

      const items: StudentHomeworkItem[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d.classGrade || d.classGrade === classGrade || d.classGrade === "all") {
          const studentSub = d.submissions?.[studentId] || {};
          items.push({
            id: docSnap.id,
            classGrade: d.classGrade || classGrade,
            subject: d.subject || "General",
            title: d.title || "Homework Assignment",
            description: d.description || "",
            dueDate: d.dueDate || new Date().toISOString(),
            assignedBy: d.assignedBy || "Tutor",
            createdAt: d.createdAt || new Date().toISOString(),
            attachments: d.attachments || [],
            status: studentSub.status || (studentSub.submittedAt ? "submitted" : "pending"),
            submissionDate: studentSub.submittedAt,
            submissionRemarks: studentSub.remarks,
            submissionAttachmentUrl: studentSub.attachmentUrl,
            teacherRemarks: studentSub.teacherRemarks,
            grade: studentSub.grade,
          });
        }
      });

      safeLocalStorageSetItem(`${OFFLINE_CACHE_KEYS.HOMEWORK}${studentId}`, JSON.stringify(items));
      return items;
    } catch (e) {
      console.warn("[studentPortalService] Error getting homework, falling back to cache:", e);
      const cached = safeLocalStorageGetItem(`${OFFLINE_CACHE_KEYS.HOMEWORK}${studentId}`);
      return cached ? JSON.parse(cached) : [];
    }
  },

  subscribeToStudentHomework(
    studentId: string,
    classGrade: string,
    callback: (items: StudentHomeworkItem[]) => void
  ): () => void {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const db = await getFirebaseDb();
        if (!db) return;

        const hwCol = collection(db, "homework");
        const q = query(hwCol, orderBy("dueDate", "asc"));

        unsub = onSnapshot(
          q,
          (snap) => {
            const items: StudentHomeworkItem[] = [];
            snap.forEach((docSnap) => {
              const d = docSnap.data();
              if (!d.classGrade || d.classGrade === classGrade || d.classGrade === "all") {
                const studentSub = d.submissions?.[studentId] || {};
                items.push({
                  id: docSnap.id,
                  classGrade: d.classGrade || classGrade,
                  subject: d.subject || "General",
                  title: d.title || "Homework Assignment",
                  description: d.description || "",
                  dueDate: d.dueDate || new Date().toISOString(),
                  assignedBy: d.assignedBy || "Tutor",
                  createdAt: d.createdAt || new Date().toISOString(),
                  attachments: d.attachments || [],
                  status: studentSub.status || (studentSub.submittedAt ? "submitted" : "pending"),
                  submissionDate: studentSub.submittedAt,
                  submissionRemarks: studentSub.remarks,
                  submissionAttachmentUrl: studentSub.attachmentUrl,
                  teacherRemarks: studentSub.teacherRemarks,
                  grade: studentSub.grade,
                });
              }
            });

            safeLocalStorageSetItem(`${OFFLINE_CACHE_KEYS.HOMEWORK}${studentId}`, JSON.stringify(items));
            callback(items);
          },
          (err) => {
            console.warn("[studentPortalService] Homework realtime error:", err);
          }
        );
      } catch (err) {
        console.warn("[studentPortalService] Failed to subscribe to homework:", err);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  },

  async submitStudentHomework(
    homeworkId: string,
    studentId: string,
    submissionData: {
      remarks?: string;
      attachmentUrl?: string;
      attachmentName?: string;
    }
  ): Promise<void> {
    const db = await getFirebaseDb();
    if (!db) throw new Error("Database offline. Please check your connection.");

    const now = new Date().toISOString();
    const docRef = doc(db, "homework", homeworkId);

    await updateDoc(docRef, {
      [`submissions.${studentId}`]: {
        studentId,
        submittedAt: now,
        status: "submitted",
        remarks: submissionData.remarks || "",
        attachmentUrl: submissionData.attachmentUrl || "",
        attachmentName: submissionData.attachmentName || "",
      },
      updatedAt: now,
    });
  },

  // Notifications Module
  async getStudentNotifications(studentId: string, classGrade: string): Promise<StudentNotification[]> {
    try {
      const db = await getFirebaseDb();
      if (!db) {
        const cached = safeLocalStorageGetItem(`${OFFLINE_CACHE_KEYS.NOTIFICATIONS}${studentId}`);
        return cached ? JSON.parse(cached) : [];
      }

      const notifCol = collection(db, "notifications");
      const q = query(notifCol, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      const items: StudentNotification[] = [];
      const readSet = new Set<string>(
        JSON.parse(safeLocalStorageGetItem(`read_notifs_${studentId}`) || "[]")
      );

      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (
          !d.targetStudentId ||
          d.targetStudentId === studentId ||
          d.targetClass === classGrade ||
          d.targetClass === "all"
        ) {
          items.push({
            id: docSnap.id,
            title: d.title || "Notification",
            body: d.body || "",
            category: d.category || "general",
            createdAt: d.createdAt || new Date().toISOString(),
            read: d.readBy?.includes(studentId) || readSet.has(docSnap.id),
            linkTab: d.linkTab,
            targetId: d.targetId,
            priority: d.priority || "medium",
          });
        }
      });

      safeLocalStorageSetItem(`${OFFLINE_CACHE_KEYS.NOTIFICATIONS}${studentId}`, JSON.stringify(items));
      return items;
    } catch (e) {
      console.warn("[studentPortalService] Failed to get notifications:", e);
      const cached = safeLocalStorageGetItem(`${OFFLINE_CACHE_KEYS.NOTIFICATIONS}${studentId}`);
      return cached ? JSON.parse(cached) : [];
    }
  },

  subscribeToStudentNotifications(
    studentId: string,
    classGrade: string,
    callback: (items: StudentNotification[]) => void
  ): () => void {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const db = await getFirebaseDb();
        if (!db) return;

        const notifCol = collection(db, "notifications");
        const q = query(notifCol, orderBy("createdAt", "desc"));

        unsub = onSnapshot(
          q,
          (snap) => {
            const items: StudentNotification[] = [];
            const readSet = new Set<string>(
              JSON.parse(safeLocalStorageGetItem(`read_notifs_${studentId}`) || "[]")
            );

            snap.forEach((docSnap) => {
              const d = docSnap.data();
              if (
                !d.targetStudentId ||
                d.targetStudentId === studentId ||
                d.targetClass === classGrade ||
                d.targetClass === "all"
              ) {
                items.push({
                  id: docSnap.id,
                  title: d.title || "Notification",
                  body: d.body || "",
                  category: d.category || "general",
                  createdAt: d.createdAt || new Date().toISOString(),
                  read: d.readBy?.includes(studentId) || readSet.has(docSnap.id),
                  linkTab: d.linkTab,
                  targetId: d.targetId,
                  priority: d.priority || "medium",
                });
              }
            });

            safeLocalStorageSetItem(`${OFFLINE_CACHE_KEYS.NOTIFICATIONS}${studentId}`, JSON.stringify(items));
            callback(items);
          },
          (err) => {
            console.warn("[studentPortalService] Notifications realtime error:", err);
          }
        );
      } catch (err) {
        console.warn("[studentPortalService] Failed to subscribe to notifications:", err);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  },

  async markNotificationAsRead(studentId: string, notificationId: string): Promise<void> {
    try {
      const readSet = new Set<string>(
        JSON.parse(safeLocalStorageGetItem(`read_notifs_${studentId}`) || "[]")
      );
      readSet.add(notificationId);
      safeLocalStorageSetItem(`read_notifs_${studentId}`, JSON.stringify(Array.from(readSet)));

      const db = await getFirebaseDb();
      if (!db) return;

      const docRef = doc(db, "notifications", notificationId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const curRead = snap.data().readBy || [];
        if (!curRead.includes(studentId)) {
          await updateDoc(docRef, {
            readBy: [...curRead, studentId],
          });
        }
      }
    } catch (e) {
      console.warn("[studentPortalService] Error marking notification as read:", e);
    }
  },

  async markAllNotificationsAsRead(studentId: string, notifIds: string[]): Promise<void> {
    try {
      const readSet = new Set<string>(
        JSON.parse(safeLocalStorageGetItem(`read_notifs_${studentId}`) || "[]")
      );
      notifIds.forEach((id) => readSet.add(id));
      safeLocalStorageSetItem(`read_notifs_${studentId}`, JSON.stringify(Array.from(readSet)));

      const db = await getFirebaseDb();
      if (!db) return;

      for (const id of notifIds) {
        try {
          const docRef = doc(db, "notifications", id);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const curRead = snap.data().readBy || [];
            if (!curRead.includes(studentId)) {
              await updateDoc(docRef, {
                readBy: [...curRead, studentId],
              });
            }
          }
        } catch {
          // ignore single failure
        }
      }
    } catch (e) {
      console.warn("[studentPortalService] Error marking all notifications read:", e);
    }
  },

  // Student Profile Updates (Editable only: Phone, Email, Password)
  async updateStudentContactInfo(
    studentId: string,
    updates: {
      phone?: string;
      email?: string;
      password?: string;
    }
  ): Promise<void> {
    const db = await getFirebaseDb();
    if (!db) throw new Error("Database offline. Changes could not be saved.");

    const docRef = doc(db, "students", studentId);
    const now = new Date().toISOString();

    const payload: Record<string, any> = {
      updatedAt: now,
    };

    if (typeof updates.phone === "string") payload.phone = updates.phone.trim();
    if (typeof updates.email === "string") payload.email = updates.email.trim();
    if (typeof updates.password === "string" && updates.password.trim()) {
      payload.password = updates.password.trim();
    }

    await updateDoc(docRef, payload);
  },

  // Cache stats
  getCacheStats(): { itemsCount: number; sizeBytes: number; lastSync: string } {
    let count = 0;
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("atlas_")) {
        count++;
        const val = localStorage.getItem(key) || "";
        bytes += key.length + val.length * 2;
      }
    }
    const lastSync = safeLocalStorageGetItem(OFFLINE_CACHE_KEYS.LAST_SYNC) || new Date().toISOString();
    return { itemsCount: count, sizeBytes: bytes, lastSync };
  },

  clearOfflineCache(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("atlas_portal_cached_") || key.startsWith("read_notifs_"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => safeLocalStorageRemoveItem(k));
    safeLocalStorageSetItem(OFFLINE_CACHE_KEYS.LAST_SYNC, new Date().toISOString());
  },
};
