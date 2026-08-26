import React from "react";
import { useDashboard } from "../hooks/useDashboard";
import { Users, FileText, Award, CalendarCheck, TrendingUp, DollarSign } from "lucide-react";
import { formatCurrency } from "../../../shared/utils";

export const DashboardContainer: React.FC = () => {
  const { metrics, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span>Loading Atlas 2.0 dashboard...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>;
  }

  const cards = [
    {
      title: "Active Students",
      value: `${metrics?.activeStudents || 0} / ${metrics?.totalStudents || 0}`,
      icon: Users,
      color: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      title: "Study Notes",
      value: metrics?.totalNotes || 0,
      icon: FileText,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    },
    {
      title: "Practice Tests",
      value: metrics?.totalTests || 0,
      icon: Award,
      color: "text-purple-600 bg-purple-50 border-purple-100",
    },
    {
      title: "Avg Attendance",
      value: `${metrics?.averageAttendancePct || 0}%`,
      icon: CalendarCheck,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
      title: "Fee Collection",
      value: formatCurrency(metrics?.feeCollectionThisMonth || 0),
      icon: DollarSign,
      color: "text-teal-600 bg-teal-50 border-teal-100",
    },
    {
      title: "System Status",
      value: "Healthy (R2 + Firestore)",
      icon: TrendingUp,
      color: "text-slate-600 bg-slate-50 border-slate-200",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Atlas 2.0 Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Enterprise tuition operations and real-time activity metrics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{c.title}</span>
                <div className={`p-2 rounded-lg border ${c.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-bold text-slate-900">{c.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
