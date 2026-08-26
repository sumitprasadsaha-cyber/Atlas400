import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  QueryConstraint,
  DocumentData,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../config/firebase.config";
import { CollectionName } from "./collections";
import { logger } from "../../../shared/utils/logger";

export const firestoreService = {
  async getDocument<T = DocumentData>(collectionName: CollectionName, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as unknown as T;
    } catch (error) {
      logger.error(`Error getting document ${collectionName}/${id}`, error);
      throw error;
    }
  },

  async setDocument<T extends Record<string, any>>(
    collectionName: CollectionName,
    id: string,
    data: T,
    merge: boolean = true
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      const now = new Date().toISOString();
      const payload = {
        ...data,
        updatedAt: now,
        createdAt: data.createdAt || now,
      };
      await setDoc(docRef, payload, { merge });
      logger.debug(`Document saved: ${collectionName}/${id}`);
    } catch (error) {
      logger.error(`Error setting document ${collectionName}/${id}`, error);
      throw error;
    }
  },

  async updateDocument<T extends Record<string, any>>(
    collectionName: CollectionName,
    id: string,
    data: Partial<T>
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      const payload = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(docRef, payload);
      logger.debug(`Document updated: ${collectionName}/${id}`);
    } catch (error) {
      logger.error(`Error updating document ${collectionName}/${id}`, error);
      throw error;
    }
  },

  async deleteDocument(collectionName: CollectionName, id: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      logger.debug(`Document deleted: ${collectionName}/${id}`);
    } catch (error) {
      logger.error(`Error deleting document ${collectionName}/${id}`, error);
      throw error;
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
      logger.error(`Error querying collection ${collectionName}`, error);
      throw error;
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
      }
    );
  },

  subscribeToDocument<T = DocumentData>(
    collectionName: CollectionName,
    id: string,
    onUpdate: (item: T | null) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
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
        logger.error(`Realtime document subscription error for ${collectionName}/${id}`, error);
        if (onError) onError(error);
      }
    );
  },
};
