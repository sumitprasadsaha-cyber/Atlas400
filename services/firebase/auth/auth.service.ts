import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
  Unsubscribe,
} from "firebase/auth";
import { auth } from "../config/firebase.config";
import { AuthUser, LoginCredentials, UserRole } from "../../../shared/types/auth.types";
import { logger } from "../../../shared/utils/logger";
import { roleService } from "../role/role.service";
import { userService } from "../user/user.service";
import { permissionService } from "../permission/permission.service";
import { auditService } from "../audit/audit.service";
import { AuthenticationError } from "../../../shared/errors";
import { validateEmailLogin } from "../../../shared/validation/auth.schema";

export const authService = {
  /**
   * Authenticates user using Firebase Authentication with Email & Password.
   */
  async loginWithEmail(credentials: LoginCredentials): Promise<AuthUser> {
    const { email, password } = credentials;
    const validation = validateEmailLogin(email, password);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0] || "Invalid email or password.";
      throw new AuthenticationError(firstError, validation.errors);
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password || "");
      const fbUser = userCredential.user;

      // Authoritatively resolve role and profile from Firestore
      let userDoc = await userService.getUser(fbUser.uid);
      const role: UserRole = await roleService.getUserRole(fbUser.uid);

      if (!userDoc) {
        // Bootstrap initial user document if first sign in
        userDoc = await userService.createUser({
          uid: fbUser.uid,
          email: fbUser.email || email,
          displayName: fbUser.displayName || email.split("@")[0],
          role,
          isActive: true,
          photoURL: fbUser.photoURL,
        });
      } else {
        await userService.recordLogin(fbUser.uid);
      }

      const permissions = await permissionService.getUserPermissions(fbUser.uid, role);

      const authUser: AuthUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: userDoc.displayName || fbUser.displayName || email.split("@")[0],
        role,
        photoURL: fbUser.photoURL || userDoc.photoURL,
        isActive: userDoc.isActive !== false,
        studentId: userDoc.studentId,
        permissions,
      };

      // Record audit log
      await auditService.log({
        userId: fbUser.uid,
        role,
        action: role === "admin" ? "auth.admin_login" : "auth.login",
        resource: `users/${fbUser.uid}`,
        status: "success",
        metadata: { email: fbUser.email, provider: "password" },
      });

      logger.info("User authenticated successfully via Email/Password", { uid: fbUser.uid, role });
      return authUser;
    } catch (error: any) {
      logger.error("Authentication failed", error, { email });
      await auditService.log({
        userId: email || "unknown",
        role: "anonymous",
        action: "auth.login",
        resource: "auth",
        status: "failure",
        metadata: { email, error: error.message },
      });
      throw new AuthenticationError(error.message || "Invalid email or password.");
    }
  },

  /**
   * Prepared Google Sign-In method for future expansion without architectural changes.
   */
  async loginWithGoogle(): Promise<AuthUser> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const userCredential = await signInWithPopup(auth, provider);
      const fbUser = userCredential.user;

      let userDoc = await userService.getUser(fbUser.uid);
      const role: UserRole = await roleService.getUserRole(fbUser.uid);

      if (!userDoc) {
        userDoc = await userService.createUser({
          uid: fbUser.uid,
          email: fbUser.email || "",
          displayName: fbUser.displayName || "Google User",
          role,
          isActive: true,
          photoURL: fbUser.photoURL,
        });
      } else {
        await userService.recordLogin(fbUser.uid);
      }

      const permissions = await permissionService.getUserPermissions(fbUser.uid, role);

      const authUser: AuthUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: userDoc.displayName || fbUser.displayName || "User",
        role,
        photoURL: fbUser.photoURL || userDoc.photoURL,
        isActive: userDoc.isActive !== false,
        studentId: userDoc.studentId,
        permissions,
      };

      await auditService.log({
        userId: fbUser.uid,
        role,
        action: "auth.login",
        resource: `users/${fbUser.uid}`,
        status: "success",
        metadata: { email: fbUser.email, provider: "google" },
      });

      return authUser;
    } catch (error: any) {
      logger.error("Google authentication failed", error);
      throw new AuthenticationError(error.message || "Google Sign-In failed.");
    }
  },

  /**
   * Signs out the current authenticated user and writes an audit entry.
   */
  async logout(): Promise<void> {
    const currentUser = auth.currentUser;
    const uid = currentUser?.uid;
    try {
      await firebaseSignOut(auth);
      if (uid) {
        await auditService.log({
          userId: uid,
          role: "anonymous",
          action: "auth.logout",
          resource: `users/${uid}`,
          status: "success",
        });
      }
      logger.info("User signed out successfully");
    } catch (error: any) {
      logger.error("Sign out failed", error);
      throw error;
    }
  },

  /**
   * Sends password reset email.
   */
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      await auditService.log({
        userId: email,
        role: "anonymous",
        action: "auth.password_reset",
        resource: "auth/reset",
        status: "success",
        metadata: { email },
      });
      logger.info("Password reset email sent", { email });
    } catch (error: any) {
      logger.error("Password reset failed", error, { email });
      throw new AuthenticationError(error.message || "Failed to send password reset email.");
    }
  },

  /**
   * Subscribes to Firebase auth state changes and populates authoritative role and permissions.
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void): Unsubscribe {
    return firebaseOnAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        callback(null);
        return;
      }

      try {
        const userDoc = await userService.getUser(fbUser.uid);
        const role: UserRole = await roleService.getUserRole(fbUser.uid);
        const permissions = await permissionService.getUserPermissions(fbUser.uid, role);

        const authUser: AuthUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: userDoc?.displayName || fbUser.displayName || fbUser.email?.split("@")[0] || "User",
          role,
          photoURL: fbUser.photoURL || userDoc?.photoURL,
          isActive: userDoc ? userDoc.isActive !== false : true,
          studentId: userDoc?.studentId,
          permissions,
        };

        callback(authUser);
      } catch (e) {
        logger.error("Error populating auth user profile during state change", e);
        callback({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || "User",
          role: "student",
          isActive: true,
          permissions: ["student.self.read"],
        });
      }
    });
  },

  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  },
};
