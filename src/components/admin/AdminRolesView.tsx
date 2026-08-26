import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Users,
  Lock,
  Save,
  RotateCcw
} from "lucide-react";
import { AdminRoleDefinition } from "../../types";
import { adminService } from "../../lib/adminService";

export const AdminRolesView: React.FC = () => {
  const [roles, setRoles] = useState<AdminRoleDefinition[]>([]);
  const [selectedRole, setSelectedRole] = useState<AdminRoleDefinition | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    const loadRoles = async () => {
      const list = await adminService.getRoles();
      if (active) {
        setRoles(list);
        setSelectedRole(list[0] || null);
      }
    };
    loadRoles();
    return () => {
      active = false;
    };
  }, []);

  const permissionKeys = [
    { key: "canManageStudents", label: "Manage Students (Admissions, Suspension, Profile)" },
    { key: "canManageAcademics", label: "Manage Academics (Courses, Batches, Subjects)" },
    { key: "canManageNotes", label: "Manage Notes (R2 PDF Uploads, Delete, Categorization)" },
    { key: "canManageTests", label: "Manage Practice Tests (Create, Publish, Results)" },
    { key: "canManageHomework", label: "Manage Homework (Assign Tasks, Grade Submissions)" },
    { key: "canManageAttendance", label: "Manage Attendance (Mark Roll, Bulk Present/Absent)" },
    { key: "canManageFees", label: "Manage Fees (Collect Dues, Issue Receipts, Ledger)" },
    { key: "canManageAnnouncements", label: "Manage Announcements & Broadcast Alerts" },
    { key: "canManageSettings", label: "Manage System Settings & Feature Flags" },
    { key: "canViewAuditLogs", label: "View System Audit Logs & Telemetry" },
    { key: "canManageStorage", label: "Manage Cloudflare R2 Storage & File Repair" },
  ];

  const handleTogglePermission = (key: string) => {
    if (!selectedRole) return;
    setSelectedRole({
      ...selectedRole,
      permissions: {
        ...selectedRole.permissions,
        [key]: !selectedRole.permissions[key],
      },
    });
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    const saved = await adminService.saveRole(selectedRole, "admin@atlas.tuition");
    setRoles((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-roles-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Role-Based Access Control (RBAC) Matrix
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Define administrative roles, assign granular module permissions, and safeguard student data
          </p>
        </div>

        {selectedRole && (
          <button
            onClick={handleSaveRole}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/20"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Role Permissions"}</span>
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Role permissions updated and recorded in audit log successfully!</span>
        </div>
      )}

      {/* Role Selection & Permission Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            System Roles
          </h3>
          <div className="space-y-2">
            {roles.map((r) => {
              const isSelected = selectedRole?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRole(r)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-50/60 border-blue-500 dark:bg-blue-950/30 dark:border-blue-500"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                      {r.name}
                    </div>
                    {r.isSystem && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        System Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {r.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Permissions Checkbox Grid */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          {selectedRole ? (
            <>
              <div className="border-b border-slate-150 dark:border-slate-800 pb-4">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Permissions for {selectedRole.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure specific administrative abilities for users assigned to this role
                </p>
              </div>

              <div className="space-y-2.5">
                {permissionKeys.map((p) => {
                  const isChecked = !!selectedRole.permissions[p.key];
                  return (
                    <label
                      key={p.key}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-150 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {p.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePermission(p.key)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Select a role from the left list to view or edit permissions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
