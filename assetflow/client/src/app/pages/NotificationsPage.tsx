import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Bell, Check, Wrench, ArrowLeftRight, Clock,
  AlertTriangle, ClipboardCheck, ArrowUpRight
} from 'lucide-react';

function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium leading-snug ${className}`}>{children}</span>;
}

const NOTIF_ICONS = {
  AssetAssigned: { icon: ArrowUpRight, color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400' },
  MaintenanceRequest: { icon: Wrench, color: 'text-amber-600 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400' },
  MaintenanceApproved: { icon: Check, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400' },
  MaintenanceRejected: { icon: Clock, color: 'text-red-600 bg-red-100 dark:bg-red-950/40 dark:text-red-400' },
  MaintenanceResolved: { icon: Check, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400' },
  TransferRequest: { icon: ArrowLeftRight, color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-400' },
  TransferApproved: { icon: Check, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400' },
  TransferRejected: { icon: Clock, color: 'text-red-600 bg-red-100 dark:bg-red-950/40 dark:text-red-400' },
  BookingConfirmed: { icon: ClipboardCheck, color: 'text-violet-600 bg-violet-100 dark:bg-violet-950/40 dark:text-violet-400' },
  BookingCancelled: { icon: Clock, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800/40 dark:text-slate-400' },
  OverdueReturn: { icon: AlertTriangle, color: 'text-red-600 bg-red-100 dark:bg-red-950/40 dark:text-red-400' },
  AuditDiscrepancy: { icon: AlertTriangle, color: 'text-red-600 bg-red-100 dark:bg-red-950/40 dark:text-red-400' },
  AuditAssigned: { icon: ClipboardCheck, color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400' },
};

export default function NotificationsPage() {
  const { isManager } = useAuth();
  const [activeTab, setActiveTab] = useState('notifications');
  const [notifications, setNotifications] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'notifications') {
        const res = await api.getNotifications();
        setNotifications(res.notifications || []);
      } else if (activeTab === 'activity') {
        const res = await api.getActivityLogs();
        setActivityLogs(res.logs || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const markRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  const timeSince = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'notifications'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Notifications
        </button>
        {isManager && (
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'activity'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Activity Logs & Audit Trail
          </button>
        )}
        {activeTab === 'notifications' && notifications.some(n => !n.read) && (
          <button
            onClick={markAllRead}
            className="ml-auto pb-1.5 text-xs text-accent hover:underline font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : activeTab === 'notifications' ? (
        <div className="space-y-2">
          {notifications.map((n) => {
            const meta = NOTIF_ICONS[n.type] || { icon: Bell, color: 'text-slate-600 bg-slate-100' };
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={`bg-card border rounded-xl p-4 flex gap-4 items-start transition-all cursor-pointer ${
                  n.read ? 'border-border/50 opacity-70' : 'border-accent/30 shadow-sm shadow-accent/5'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground font-medium leading-snug">{n.message}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <span>{timeSince(n.createdAt)}</span>
                    {!n.read && (
                      <>
                        <span>·</span>
                        <span className="text-accent font-semibold text-[10px] uppercase">Unread</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {notifications.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">You have no notifications.</div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['User', 'Action', 'Entity', 'Details', 'Timestamp'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activityLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/25">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-foreground">{log.userName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{log.userEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap">{log.action}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.entityType ? (
                        <Badge className="bg-secondary text-secondary-foreground font-mono">
                          {log.entityType}#{log.entityId}
                        </Badge>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {activityLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No activities logged yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
