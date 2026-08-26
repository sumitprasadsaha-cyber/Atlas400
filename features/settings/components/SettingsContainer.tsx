import React from "react";
import { useSettings } from "../hooks/useSettings";
import { ShieldCheck, Database, HardDrive, Cpu } from "lucide-react";

export const SettingsContainer: React.FC = () => {
  const { settings, isLoading, error } = useSettings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span>Loading system configurations...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">System Architecture & Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Atlas 2.0 configuration manifest and runtime providers</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Application Architecture</div>
              <div className="text-xs text-slate-500">Atlas 2.0 (Phase 1 Foundation)</div>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md">
            v{settings?.version || "5.0.0"}
          </span>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Primary Database & Auth</div>
              <div className="text-xs text-slate-500">Google Cloud Firestore & Firebase Auth</div>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md">
            Active
          </span>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Binary Storage Engine</div>
              <div className="text-xs text-slate-500">Cloudflare R2 Object Storage (Presigned Direct I/O)</div>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md">
            Active
          </span>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Security Model</div>
              <div className="text-xs text-slate-500">Zero client secrets, serverless signed R2 URL broker</div>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md">
            Enforced
          </span>
        </div>
      </div>
    </div>
  );
};
