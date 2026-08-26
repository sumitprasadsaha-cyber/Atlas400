import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase.config";
import { UserDoc } from "../../../shared/types/user.types";
import { COLLECTIONS } from "../firestore/collections";
import { validateUserDoc } from "../../../shared/validation/documents.schema";
import { logger } from "../../../shared/utils/logger";
import { firestoreService } from "../firestore/firestore.service";

export const userService = {
  async getUser(uid: string): Promise<UserDoc | null> {
    return await firestoreService.getDocument<UserDoc>(COLLECTIONS.USERS, uid);
  },

  async createUser(userData: Partial<UserDoc> & { uid: string; email: string }): Promise<UserDoc> {
    const validated = validateUserDoc(userData);
    await firestoreService.setDocument(COLLECTIONS.USERS, validated.uid, validated, false);
    logger.info("User created in Firestore", { uid: validated.uid, role: validated.role });
    return validated;
  },

  async updateUser(uid: string, updates: Partial<UserDoc>): Promise<void> {
    await firestoreService.updateDocument<UserDoc>(COLLECTIONS.USERS, uid, updates);
    logger.info("User updated in Firestore", { uid });
  },

  async recordLogin(uid: string): Promise<void> {
    const now = new Date().toISOString();
    await firestoreService.updateDocument(COLLECTIONS.USERS, uid, { lastLogin: now });
  },

  async setUserStatus(uid: string, isActive: boolean): Promise<void> {
    await firestoreService.updateDocument(COLLECTIONS.USERS, uid, { isActive });
  },
};
