import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Edit2,
  Trash2,
  Lock,
  Camera,
  CheckCircle2,
  XCircle,
  Archive,
  RotateCcw,
  IndianRupee,
  Phone,
  Calendar,
  BookOpen,
  Eye,
  FileSpreadsheet,
  AlertCircle,
  X,
  ChevronDown
} from "lucide-react";
import { Student, StudentServiceStatus } from "../../types";
import { adminService } from "../../lib/adminService";
import { formatCurrency } from "../../../shared/utils";

interface AdminStudentsViewProps {
  students: Student[];
  onSelectStudent: (studentId: string) => void;
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onUpdateStudentsList: (students: Student[]) => void;
  onOpenAvatarModal?: (student: Student) => void;
}

export const AdminStudentsView: React.FC<AdminStudentsViewProps> = ({
  students,
  onSelectStudent,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onUpdateStudentsList,
  onOpenAvatarModal,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "archived">("all");
  const [feeStatusFilter, setFeeStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<Student[]>([]);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);

  // Extract distinct class grades
  const distinctClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.classGrade) set.add(s.classGrade);
    });
    return Array.from(set).sort();
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(s.rollNo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone && s.phone.includes(searchTerm)) ||
        (s.classGrade && s.classGrade.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchClass = classFilter === "all" || s.classGrade === classFilter;

      let matchStatus = true;
      const status = s.serviceStatus || "active";
      if (statusFilter === "active") matchStatus = status === "active";
      else if (statusFilter === "suspended") matchStatus = status === "paused";
      else if (statusFilter === "archived") matchStatus = status === "ended";

      let matchFee = true;
      if (feeStatusFilter !== "all") {
        const statuses = Object.values(s.feeMonths || {});
        const hasUnpaid = statuses.length === 0 ? !s.feePaidThisMonth : statuses.some((st) => st === false || st === "unpaid" || (st !== "paid" && st !== true && st !== "na"));
        if (feeStatusFilter === "pending") matchFee = hasUnpaid;
        else if (feeStatusFilter === "paid") matchFee = !hasUnpaid;
      }

      return matchSearch && matchClass && matchStatus && matchFee;
    });
  }, [students, searchTerm, classFilter, statusFilter, feeStatusFilter]);

  // Toggle student active / suspended status
  const handleToggleStatus = async (student: Student) => {
    const currentStatus = student.serviceStatus || "active";
    const nextStatus: StudentServiceStatus = currentStatus === "active" ? "paused" : "active";

    const updated: Student[] = students.map((s) =>
      s.id === student.id ? { ...s, serviceStatus: nextStatus, service_status: nextStatus } : s
    );
    onUpdateStudentsList(updated);

    await adminService.recordAuditLog({
      adminId: "admin",
      adminEmail: "admin@atlas.tuition",
      action: nextStatus === "active" ? "student.reactivated" : "student.suspended",
      resource: "students",
      resourceId: student.id,
      resourceName: student.name,
      previousValue: { status: currentStatus },
      newValue: { status: nextStatus },
    });
  };

  // Archive / Restore student
  const handleToggleArchive = async (student: Student) => {
    const currentStatus = student.serviceStatus || "active";
    const nextStatus: StudentServiceStatus = currentStatus === "ended" ? "active" : "ended";

    const updated: Student[] = students.map((s) =>
      s.id === student.id ? { ...s, serviceStatus: nextStatus, service_status: nextStatus } : s
    );
    onUpdateStudentsList(updated);

    await adminService.recordAuditLog({
      adminId: "admin",
      adminEmail: "admin@atlas.tuition",
      action: nextStatus === "ended" ? "student.archived" : "student.restored",
      resource: "students",
      resourceId: student.id,
      resourceName: student.name,
      previousValue: { status: currentStatus },
      newValue: { status: nextStatus },
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const csvContent = adminService.exportStudentsToCsv(filteredStudents);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Atlas_Students_Export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle CSV file upload
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportCsvText(text);
      const parsed = adminService.parseStudentsFromCsv(text);
      setImportPreview(parsed.valid);
      setImportErrors(parsed.errors);
    };
    reader.readAsText(file);
  };

  const handleConfirmBulkImport = async () => {
    if (importPreview.length === 0) return;
    const combined = [...students, ...importPreview];
    onUpdateStudentsList(combined);

    await adminService.recordAuditLog({
      adminId: "admin",
      adminEmail: "admin@atlas.tuition",
      action: "students.bulk_imported",
      resource: "students",
      newValue: { count: importPreview.length },
    });

    setIsBulkImportOpen(false);
    setImportCsvText("");
    setImportPreview([]);
    setImportErrors([]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-students-view">
      {/* Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Student Lifecycle Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage student admissions, batch assignments, fee ledger, and account status
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export ({filteredStudents.length})</span>
          </button>

          <button
            onClick={onAddStudent}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Enroll Student</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, roll no, phone, or class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Classes ({students.length})</option>
              {distinctClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended / Paused</option>
              <option value="archived">Archived / Ended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Class / Batch</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Monthly Fee</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    No students match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const status = s.serviceStatus || "active";
                  const isArchived = status === "ended";
                  const isSuspended = status === "paused";

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Name & Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {s.avatarUrl ? (
                              <img
                                src={s.avatarUrl}
                                alt={s.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">
                                {s.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <button
                              onClick={() => onSelectStudent(s.id)}
                              className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-left"
                            >
                              {s.name}
                            </button>
                            <div className="text-[10px] text-slate-400">
                              Roll No: {s.rollNo || "N/A"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Class Grade */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                          {s.classGrade}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {s.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{s.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Fee */}
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                        {formatCurrency(s.monthlyFee || 1500)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isArchived ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Archived
                          </span>
                        ) : isSuspended ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                            Suspended
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onSelectStudent(s.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                            title="Open Student Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onEditStudent(s)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                            title="Edit Student Information"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(s)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              isSuspended
                                ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                : "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            }`}
                            title={isSuspended ? "Reactivate Student" : "Suspend Student"}
                          >
                            {isSuspended ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => handleToggleArchive(s)}
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                            title={isArchived ? "Restore Student" : "Archive Student"}
                          >
                            {isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => onDeleteStudent(s.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                            title="Delete Student Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk CSV Import Modal */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Bulk Import Students (CSV)
                </h3>
              </div>
              <button
                onClick={() => setIsBulkImportOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload a CSV file or paste formatted CSV lines. Supported columns: Name, ClassGrade, RollNo, Phone, MonthlyFee.
            </p>

            <div className="space-y-3">
              <label className="block p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center hover:border-blue-500 transition-colors cursor-pointer">
                <Upload className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Click to select .CSV file
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
              </label>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Or Paste Raw CSV Data:
                </label>
                <textarea
                  rows={4}
                  value={importCsvText}
                  onChange={(e) => {
                    setImportCsvText(e.target.value);
                    const parsed = adminService.parseStudentsFromCsv(e.target.value);
                    setImportPreview(parsed.valid);
                    setImportErrors(parsed.errors);
                  }}
                  placeholder="Name,Class,Roll,Phone,Fee&#10;Aarav Sharma,Class 10,101,9876543210,1500&#10;Diya Patel,Class 9,902,9876543211,1400"
                  className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              {importErrors.length > 0 && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Parsing Warnings:</span>
                  </div>
                  {importErrors.map((err, idx) => (
                    <div key={idx} className="text-[11px]">• {err}</div>
                  ))}
                </div>
              )}

              {importPreview.length > 0 && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs">
                  <span className="font-bold">{importPreview.length}</span> students ready to import.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-150 dark:border-slate-800">
              <button
                onClick={() => setIsBulkImportOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkImport}
                disabled={importPreview.length === 0}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl cursor-pointer"
              >
                Import {importPreview.length} Students
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
