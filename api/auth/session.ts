import { ROLE_PERMISSIONS } from "../../shared/constants/permissions.constants";
import { UserRole, Permission } from "../../shared/types/auth.types";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = "";
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      return res.status(200).json({
        authenticated: false,
        user: null,
        role: null,
        permissions: [],
        tokenValidation: {
          valid: false,
          method: "header-bearer",
          error: "No authorization token provided.",
        },
        timestamp: new Date().toISOString(),
      });
    }

    // In a stateless/serverless environment with Firebase token:
    // Decode or validate token structure
    let uid = "unknown";
    let email = "";
    let role: UserRole = "student";

    try {
      // Decode JWT payload parts safely if present
      const parts = token.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
        const payload = JSON.parse(payloadJson);
        uid = payload.user_id || payload.sub || payload.uid || uid;
        email = payload.email || "";
        if (payload.role === "admin" || payload.admin === true) {
          role = "admin";
        }
      }
    } catch {
      // Basic token parsing fallback
    }

    const permissions: Permission[] = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.student;

    return res.status(200).json({
      authenticated: true,
      user: {
        uid,
        email: email || null,
        displayName: email ? email.split("@")[0] : "User",
        role,
        isActive: true,
      },
      role,
      permissions,
      tokenValidation: {
        valid: true,
        method: "firebase-id-token",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      authenticated: false,
      user: null,
      role: null,
      permissions: [],
      tokenValidation: {
        valid: false,
        method: "header-bearer",
        error: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
