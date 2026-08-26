import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser,
  Unsubscribe,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase.config";
import { AuthUser, UserRole } from "../../../shared/types/auth.types";
import { logger } from "../../../shared/utils/logger";

export const authService = {
  async loginWithEmail(email: string, pass: string): Promise<AuthUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const fbUser = userCredential.user;

      // Fetch user profile from Firestore users collection
      const userDocRef = doc(db, "users", fbUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let role: UserRole = "admin";
      let studentId: string | undefined;
      let teacherId: string | undefined;
      let classId: string | undefined;

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        role = userData.role || "admin";
        studentId = userData.studentId;
        teacherId = userData.teacherId;
        classId = userData.classId;
      }

      const authUser: AuthUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || email.split("@")[0],
        role,
        photoURL: fbUser.photoURL,
        studentId,
        teacherId,
        classId,
      };

      logger.info("User logged in successfully", { uid: fbUser.uid, role });
      return authUser;
    } catch (error: any) {
      logger.error("Login failed", error, { email });
      throw new Error(error.message || "Failed to log in. Please check your credentials.");
    }
  },

  async logout(): Promise<void> {
    try {
      await firebaseSignOut(auth);
      logger.info("User logged out successfully");
    } catch (error: any) {
      logger.error("Logout failed", error);
      throw error;
    }
  },

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      logger.info("Password reset email sent", { email });
    } catch (error: any) {
      logger.error("Password reset failed", error, { email });
      throw new Error(error.message || "Failed to send password reset email.");
    }
  },

  onAuthStateChange(callback: (user: AuthUser | null) => void): Unsubscribe {
    return firebaseOnAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        callback(null);
        return;
      }

      try {
        const userDocRef = doc(db, "users", fbUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let role: UserRole = "admin";
        let studentId: string | undefined;
        let teacherId: string | undefined;
        let classId: string | undefined;

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          role = userData.role || "admin";
          studentId = userData.studentId;
          teacherId = userData.teacherId;
          classId = userData.classId;
        }

        const authUser: AuthUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "User",
          role,
          photoURL: fbUser.photoURL,
          studentId,
          teacherId,
          classId,
        };

        callback(authUser);
      } catch (e) {
        logger.error("Error fetching user profile during auth state change", e);
        callback({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || "User",
          role: "admin",
        });
      }
    });
  },

  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  },
};
