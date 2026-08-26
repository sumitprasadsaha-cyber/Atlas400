import React from "react";
import { useNotifications } from "../hooks/useNotifications";
import { Bell, Clock } from "lucide-react";
import { getRelativeTimeString } from "../../../shared/utils";

export const NotificationsContainer: React.FC = () => {
  const { notifications, isLoading, error } = useNotifications();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span>Loading announcements...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Broadcasts & Alerts</h1>
          <p className="text-xs text-slate-500">{notifications.length} alerts</p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl">
          <Bell className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No new notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">{n.title}</h3>
                <span className="text-xs text-slate-400 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {getRelativeTimeString(n.createdAt)}
                </span>
              </div>
              <p className="text-xs text-slate-600">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
