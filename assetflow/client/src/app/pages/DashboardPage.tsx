import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  Package, Boxes, Wrench, CalendarDays, ArrowLeftRight, Clock,
  AlertTriangle, Plus, ArrowUpRight, ArrowDownRight, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const BAR_COLORS = ['#3B82F6', '#10B981', '#F97316', '#FBBF24', '#EC4899', '#8B5CF6'];

const TREND_DATA = [
  { month: 'Jan', value: 140 },
  { month: 'Feb', value: 380 },
  { month: 'Mar', value: 220 },
  { month: 'Apr', value: 310 },
  { month: 'May', value: 260 },
  { month: 'Jun', value: 420 }
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border p-3 rounded-xl shadow-xl space-y-0.5">
        <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">{label}</p>
        <p className="text-xs font-bold text-foreground font-mono">
          {payload[0].name}: <span className="text-primary font-extrabold">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const { user, isManager } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats().then(d => {
      setStats(d.stats);
      setActivity(d.recentActivity || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const kpiCards = [
    { label: 'Assets Available', value: stats?.assetsAvailable ?? 0, icon: Package, color: 'bg-blue-500/10 text-blue-500 border-blue-500/10', change: '+10% from last month' },
    { label: 'Assets Allocated', value: stats?.assetsAllocated ?? 0, icon: Boxes, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10', change: '+12% from last month' },
    { label: 'Under Maintenance', value: stats?.maintenanceToday ?? 0, icon: Wrench, color: 'bg-amber-500/10 text-amber-500 border-amber-500/10', change: '-2% from last month' },
    { label: 'Active Bookings', value: stats?.activeBookings ?? 0, icon: CalendarDays, color: 'bg-violet-500/10 text-violet-500 border-violet-500/10', change: '+6.4% from last month' },
    { label: 'Pending Transfers', value: stats?.pendingTransfers ?? 0, icon: ArrowLeftRight, color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/10', change: '+5% from last month' },
    { label: 'Overdue Returns', value: stats?.overdueReturns ?? 0, icon: AlertTriangle, color: stats?.overdueReturns > 0 ? 'bg-red-500/15 text-red-500 border-red-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/10', change: 'Require action' },
  ];

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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Good day, {user?.name}</h2>
        <p className="text-xs text-muted-foreground mt-1">Here is a quick summary of Sinton Agency asset performance and active operations.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card border border-border rounded-xl p-5 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group cursor-default">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 border ${card.color} group-hover:scale-105 transition-transform duration-300`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="font-['JetBrains_Mono',monospace] text-2xl font-bold text-foreground tracking-tight leading-none">{card.value}</div>
              <div className="text-xs text-muted-foreground mt-2 font-medium">{card.label}</div>
              <div className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1 font-mono">
                {card.change}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3 flex-wrap bg-card border border-border rounded-xl p-4">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-2">Quick Actions:</span>
        {isManager && (
          <button onClick={() => navigate('/assets')} className="flex items-center gap-1.5 h-9 px-4 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 active:scale-[0.97] transition-all duration-150 font-medium cursor-pointer">
            <Plus className="w-4 h-4" /> Register Asset
          </button>
        )}
        <button onClick={() => navigate('/booking')} className="flex items-center gap-1.5 h-9 px-4 text-xs border border-border rounded-lg hover:bg-muted active:scale-[0.97] transition-all duration-150 font-medium text-foreground cursor-pointer">
          <CalendarDays className="w-4 h-4" /> Book Resource
        </button>
        <button onClick={() => navigate('/maintenance')} className="flex items-center gap-1.5 h-9 px-4 text-xs border border-border rounded-lg hover:bg-muted active:scale-[0.97] transition-all duration-150 font-medium text-foreground cursor-pointer">
          <Wrench className="w-4 h-4" /> Raise Maintenance
        </button>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Asset Activity Overview</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Asset allocations trends over the last 6 months</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" name="Allocations" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorActivity)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>


        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Monthly Returns</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Resource bookings resolved by calendar month</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar name="Bookings" dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={38}>
                  {TREND_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Overdue alert */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 h-full flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Alerts & Notifications</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Critical operations requiring manual review</p>
            </div>
            {stats?.overdueReturns > 0 ? (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">Overdue Alert</span>
                  </div>
                  <p className="text-xs text-red-200/80 mt-2 font-medium">
                    {stats.overdueReturns} asset allocation{stats.overdueReturns > 1 ? 's' : ''} have exceeded their return dates.
                  </p>
                </div>
                <button onClick={() => navigate('/allocation')} className="w-full h-9 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium cursor-pointer">
                  Resolve Returns
                </button>
              </div>
            ) : (
              <div className="mt-4 p-6 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center flex-1">
                <span className="text-xs text-muted-foreground font-medium">All systems green</span>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">No overdue alerts currently active.</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Logs */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-bold text-foreground mb-4">Live System Activity</div>
          <div className="space-y-3.5">
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No recent activity logs available</p>
            ) : (
              activity.slice(0, 5).map((item, i) => (
                <div key={item.id || i} className="flex gap-3.5 items-start p-2.5 hover:bg-muted/10 rounded-lg transition-colors">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground leading-snug">{item.action}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span>{item.userName}</span>
                      <span>·</span>
                      <span className="font-mono">{timeSince(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
