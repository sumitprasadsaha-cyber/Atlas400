import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  Download,
  Filter,
  RefreshCw,
  Calendar,
  User,
  Activity,
  ChevronRight,
  Eye,
  X
} from "lucide-react";
import { AdminAuditRecord } from "../../types";
import { adminService } from "../../lib/adminService";

export const AdminAuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AdminAuditRecord | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    const data = await adminService.getAuditLogs({ limitCount: 200 });
    setLogs(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const distinctModules = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.resource) set.add(l.resource);
    });
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const matchSearch =
        l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.resourceName && l.resourceName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.resourceId && l.resourceId.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchModule = moduleFilter === "all" || l.resource === moduleFilter;

      return matchSearch && matchModule;
    });
  }, [logs, searchTerm, moduleFilter]);

  const handleExportCsv = () => {
    const headers = ["Timestamp", "Admin Email", "Action", "Resource", "Resource Name", "Resource ID"];
    const rows = filteredLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.adminEmail}"`,
      `"${l.action}"`,
      `"${l.resource}"`,
      `"${l.resourceName || ""}"`,
      `"${l.resourceId || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Atlas_Audit_Logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-audit-logs-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Administrative Audit Trail & Security Logs
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Immutable tracking of changes to students, fees, attendance, academic syllabi, notes, and feature flags
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync Trail</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by action, administrator email, student name, or resource ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
          />
        </div>

        <div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs cursor-pointer"
          >
            <option value="all">All Modules ({logs.length})</option>
            {distinctModules.map((m) => (
              <option key={m} value={m}>
                {m.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Admin</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Resource Target</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    No audit records matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(l.timestamp).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {l.adminEmail}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        {l.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">{l.resourceName || l.resourceId || "—"}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5">({l.resource})</span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Payload</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Audit Record Payload
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  ID: {selectedLog.id} • {selectedLog.timestamp}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
                <div><span className="text-slate-400">Action:</span> <strong className="text-blue-600">{selectedLog.action}</strong></div>
                <div><span className="text-slate-400">Admin:</span> <strong>{selectedLog.adminEmail}</strong></div>
                <div><span className="text-slate-400">Resource:</span> <strong>{selectedLog.resource}</strong> ({selectedLog.resourceId || "N/A"})</div>
              </div>

              {selectedLog.previousValue && (
                <div>
                  <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">Previous State:</div>
                  <pre className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] font-mono overflow-x-auto text-slate-700 dark:text-slate-300">
                    {JSON.stringify(selectedLog.previousValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">Updated State:</div>
                  <pre className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-[11px] font-mono overflow-x-auto text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
