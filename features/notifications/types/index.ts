export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  targetRole?: "all" | "student" | "teacher" | "admin";
  targetClassId?: string;
  createdAt: string;
  read?: boolean;
}
