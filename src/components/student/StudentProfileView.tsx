import React, { useState } from "react";
import {
  User,
  Phone,
  Mail,
  Lock,
  BookOpen,
  Calendar,
  ShieldCheck,
  Camera,
  Save,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Sparkles,
  Key,
  Smartphone,
  Eye,
  EyeOff,
} from "lucide-react";
import { Student } from "../../types";
import { studentPortalService } from "../../lib/studentPortalService";
import { formatDisplayDate } from "../../utils/studentFormatters";

interface StudentProfileViewProps {
  student: Student;
  onOpenAvatarModal?: () => void;
  onRefresh?: () => void;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  student,
  onOpenAvatarModal,
  onRefresh,
}) => {
  const [phone, setPhone] = useState(student.phone || "");
  const [email, setEmail] = useState(student.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    if (newPassword && newPassword !== confirmPassword) {
      setSaveErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setSaveErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setIsSaving(true);
    try {
      await studentPortalService.updateStudentContactInfo(student.id, {
        phone,
        email,
        password: newPassword || undefined,
      });

      setSaveSuccessMsg("Profile information updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setSaveErrorMsg(`Update failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="student-profile-view" className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. Header Profile Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div
              onClick={onOpenAvatarModal}
              className="relative group cursor-pointer shrink-0"
              title="Change avatar photo"
            >
              {student.avatarUrl ? (
                <img
                  src={student.avatarUrl}
                  alt={student.name}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-3xl object-cover border-2 border-indigo-100 dark:border-indigo-900 shadow-md group-hover:opacity-90 transition"
                />
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-md">
                  {student.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                <Camera className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {student.name}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                    student.serviceStatus === "active" || !student.serviceStatus
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  }`}
                >
                  {student.serviceStatus || "active"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Student ID: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{student.rollNo || student.id}</span>
              </p>
              <div className="flex items-center space-x-2 text-xs text-slate-500 pt-0.5">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{student.classGrade}</span>
                <span>•</span>
                <span>Enrolled: {(student.enrolledSubjects || []).length} Subjects</span>
              </div>
            </div>
          </div>

          {/* Quick ID Badge preview button */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center space-x-3 shrink-0">
            <QrCode className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <div className="text-xs">
              <div className="font-bold text-slate-900 dark:text-white">Digital Pass</div>
              <div className="text-[10px] text-slate-400 font-mono">VERIFIED</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Read-Only Academic & Administrative Credentials */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Official Academic Record (Protected)
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          These fields are maintained by the academy administration and cannot be modified directly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Roll Number</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">{student.rollNo || student.id.slice(-6)}</div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Class / Batch</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{student.classGrade}</div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registration Date</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {student.registrationDate ? formatDisplayDate(student.registrationDate) : "Enrolled"}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parent / Guardian Contact</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{student.parentPhone || "Not Specified"}</div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-1 sm:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrolled Subjects</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {(student.enrolledSubjects || []).map((sub) => (
                <span key={sub} className="px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {sub}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Editable Student Contact Info & Password */}
      <form onSubmit={handleSaveChanges} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center space-x-2">
          <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Editable Contact & Login Security
          </h2>
        </div>

        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 rounded-xl text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {saveErrorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{saveErrorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Student Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@atlas.edu"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Change Account Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep unchanged"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Confirm New Password
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Updating Profile..." : "Save Changes"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
