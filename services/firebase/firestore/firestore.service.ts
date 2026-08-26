import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  onSnapshot,
  QueryConstraint,
  DocumentData,
  Unsubscribe,
  writeBatch,
  runTransaction,
  Transaction,
  WriteBatch,
} from "firebase/firestore";
import { db, auth } from "../config/firebase.config";
import { CollectionName } from "./collections";
import { logger } from "../../../shared/utils/logger";
import { DatabaseError } from "../../../shared/errors";

export enum FirestoreOperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: FirestoreOperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: FirestoreOperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const errMessage = error instanceof Error ? error.message : String(error);

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };

  logger.error(`Firestore Error [${operationType}] on [${path}]:`, error, errInfo as unknown as Record<string, unknown>);
  throw new DatabaseError(JSON.stringify(errInfo));
}

export const firestoreService = {
  async getDocument<T = DocumentData>(collectionName: CollectionName, id: string): Promise<T | null> {
    const docPath = `${collectionName}/${id}`;
    try {
      const docRef = doc(db, collectionName, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as unknown as T;
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.GET, docPath);
    }
  },

  async setDocument<T extends Record<string, any>>(
    collectionName: CollectionName,
    id: string,
    data: T,
    merge: boolean = true
  ): Promise<void> {
    const docPath = `${collectionName}/${id}`;
    try {
      const docRef = doc(db, collectionName, id);
      const now = new Date().toISOString();
      const payload = {
        ...data,
        updatedAt: now,
        createdAt: data.createdAt || now,
      };
      await setDoc(docRef, payload, { merge });
      logger.debug(`Document written: ${docPath}`);
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.WRITE, docPath);
    }
  },

  async updateDocument<T extends Record<string, any>>(
    collectionName: CollectionName,
    id: string,
    data: Partial<T>
  ): Promise<void> {
    const docPath = `${collectionName}/${id}`;
    try {
      const docRef = doc(db, collectionName, id);
      const payload = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(docRef, payload);
      logger.debug(`Document updated: ${docPath}`);
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.UPDATE, docPath);
    }
  },

  async deleteDocument(collectionName: CollectionName, id: string): Promise<void> {
    const docPath = `${collectionName}/${id}`;
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      logger.debug(`Document deleted: ${docPath}`);
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.DELETE, docPath);
    }
  },

  async getCollection<T = DocumentData>(
    collectionName: CollectionName,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    try {
      const colRef = collection(db, collectionName);
      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as T[];
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.LIST, collectionName);
    }
  },

  subscribeToCollection<T = DocumentData>(
    collectionName: CollectionName,
    constraints: QueryConstraint[],
    onUpdate: (items: T[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const colRef = collection(db, collectionName);
    const q = query(colRef, ...constraints);

    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as T[];
        onUpdate(items);
      },
      (error) => {
        logger.error(`Realtime subscription error for ${collectionName}`, error);
        if (onError) onError(error);
        else handleFirestoreError(error, FirestoreOperationType.LIST, collectionName);
      }
    );
  },

  subscribeToDocument<T = DocumentData>(
    collectionName: CollectionName,
    id: string,
    onUpdate: (item: T | null) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const docPath = `${collectionName}/${id}`;
    const docRef = doc(db, collectionName, id);

    return onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          onUpdate(null);
          return;
        }
        onUpdate({ id: snap.id, ...snap.data() } as unknown as T);
      },
      (error) => {
        logger.error(`Realtime document subscription error for ${docPath}`, error);
        if (onError) onError(error);
        else handleFirestoreError(error, FirestoreOperationType.GET, docPath);
      }
    );
  },

  createBatch(): WriteBatch {
    return writeBatch(db);
  },

  async runInTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T> {
    try {
      return await runTransaction(db, updateFunction);
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.WRITE, "transaction");
    }
  },
};
