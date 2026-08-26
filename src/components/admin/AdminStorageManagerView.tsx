import React, { useState, useEffect } from "react";
import {
  HardDrive,
  Folder,
  FileText,
  Trash2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Download,
  ExternalLink,
  CheckCircle2,
  Wrench,
  Search
} from "lucide-react";
import { ClassNote, StorageHealthOverview } from "../../types";
import { adminService } from "../../lib/adminService";

interface AdminStorageManagerViewProps {
  allNotes: ClassNote[];
}

export const AdminStorageManagerView: React.FC<AdminStorageManagerViewProps> = ({
  allNotes,
}) => {
  const [health, setHealth] = useState<StorageHealthOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [repairSuccessMessage, setRepairSuccessMessage] = useState<string | null>(null);

  const runHealthCheck = async () => {
    setIsLoading(true);
    const res = await adminService.verifyStorageHealth(allNotes);
    setHealth(res);
    setIsLoading(false);
  };

  useEffect(() => {
    runHealthCheck();
  }, [allNotes]);

  const handleFixOrphan = async (itemKey: string) => {
    if (!confirm(`Are you sure you want to clean up unreferenced file ${itemKey}?`)) return;
    await adminService.repairOrphanFile(itemKey, "admin@atlas.tuition");
    setRepairSuccessMessage(`Cleaned up orphan storage object: ${itemKey}`);
    setTimeout(() => setRepairSuccessMessage(null), 4000);
    runHealthCheck();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const filteredItems = (health?.items || []).filter((i) =>
    i.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.associatedResourceName && i.associatedResourceName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-storage-manager-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Cloudflare R2 Object Storage & File Manager
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Inspect stored syllabus PDFs, question paper banks, orphan consistency check, and bucket health
          </p>
        </div>

        <button
          onClick={runHealthCheck}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-500" : ""}`} />
          <span>Run Consistency Scan</span>
        </button>
      </div>

      {repairSuccessMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{repairSuccessMessage}</span>
        </div>
      )}

      {/* Storage Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Total Stored Objects
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {health?.totalFilesCount || 0} Files
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Across study material & tests
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            Total R2 Usage
          </span>
          <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-2">
            {health ? formatBytes(health.totalStorageBytes) : "0 MB"}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Encrypted object storage
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Referenced In DB
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {health?.referencedFilesCount || 0}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
            100% active syllabus files
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Orphan Files
          </span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {health?.orphanFilesCount || 0}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {health?.orphanFilesCount === 0 ? "Storage is pristine" : "Action recommended"}
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter files by key, chapter name, or subject..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
        />
      </div>

      {/* Storage Files Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">File / Storage Key</th>
                <th className="py-3 px-4">Associated Syllabus Item</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    No files found matching the search filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="font-mono font-bold text-slate-900 dark:text-white truncate max-w-xs">
                          {item.key}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {item.associatedResourceName || "Unreferenced / Orphan File"}
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {formatBytes(item.sizeBytes)}
                    </td>

                    <td className="py-3 px-4">
                      {item.isOrphan ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          Orphan File
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Active & Linked
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.publicUrl && (
                          <a
                            href={item.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                            title="Preview in new tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        {item.isOrphan && (
                          <button
                            onClick={() => handleFixOrphan(item.key)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                            title="Purge Orphan File"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
