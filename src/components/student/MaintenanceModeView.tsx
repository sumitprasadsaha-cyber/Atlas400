import React from "react";
import { Wrench, RefreshCw, Clock, ShieldAlert } from "lucide-react";
import { PortalMaintenanceConfig } from "../../lib/studentPortalService";

interface MaintenanceModeViewProps {
  config: PortalMaintenanceConfig;
  onRetry: () => void;
  onLogout?: () => void;
}

export const MaintenanceModeView: React.FC<MaintenanceModeViewProps> = ({
  config,
  onRetry,
  onLogout,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full text-center space-y-6 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          <Wrench className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white">
            System Maintenance in Progress
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {config.message ||
              "The Atlas 2.0 Student Portal is currently undergoing planned system upgrades. Our cloud engineering team is improving database performance and storage sync."}
          </p>
        </div>

        {config.estimatedReturnTime && (
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800/80 rounded-2xl border border-slate-700 text-xs font-semibold text-amber-300">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Estimated Return: {config.estimatedReturnTime}</span>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Check Status & Retry</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
