import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Download, AlertTriangle } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EF4444'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('utilization');
  const [utilizationData, setUtilizationData] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState({ byCategory: [], byAsset: [] });
  const [deptAllocationData, setDeptAllocationData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [conditionData, setConditionData] = useState({ conditionSummary: [], needsMaintenance: [] });
  const [loading, setLoading] = useState(true);

  const loadReportData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'utilization') {
        const res = await api.getAssetUtilization();
        setUtilizationData(res.data || []);
      } else if (activeTab === 'maintenance') {
        const res = await api.getMaintenanceFrequency();
        setMaintenanceData(res || { byCategory: [], byAsset: [] });
      } else if (activeTab === 'departments') {
        const res = await api.getDepartmentAllocation();
        setDeptAllocationData(res.data || []);
      } else if (activeTab === 'heatmap') {
        const res = await api.getBookingHeatmap();
        setHeatmapData(res.heatmap || []);
      } else if (activeTab === 'condition') {
        const res = await api.getAssetsCondition();
        setConditionData(res || { conditionSummary: [], needsMaintenance: [] });
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReportData();
  }, [activeTab]);

  const handleExport = async (type) => {
    try {
      const blob = await api.exportReport(type);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to export report: ' + err.message);
    }
  };

  const tabs = [
    { id: 'utilization', label: 'Asset Utilization' },
    { id: 'maintenance', label: 'Maintenance Freq' },
    { id: 'departments', label: 'Department Allocation' },
    { id: 'heatmap', label: 'Booking Heatmap' },
    { id: 'condition', label: 'Retirement & Condition' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border flex-wrap gap-2">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pb-1.5 flex gap-2">
          <button
            onClick={() => handleExport(activeTab === 'departments' ? 'allocations' : activeTab === 'maintenance' ? 'maintenance' : 'assets')}
            className="flex items-center gap-1.5 h-8 px-3 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors font-medium bg-card"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'utilization' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Asset Usage Metrics</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={utilizationData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="tag" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="totalAllocations" name="Allocations" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="totalBookings" name="Bookings" fill="#10B981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Top Idle Assets</h3>
                <div className="space-y-3">
                  {utilizationData
                    .filter(a => a.totalAllocations === 0 && a.totalBookings === 0)
                    .slice(0, 6)
                    .map(a => (
                      <div key={a.tag} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                        <div>
                          <div className="text-xs font-semibold text-foreground">{a.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{a.tag}</div>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded font-medium">Idle</span>
                      </div>
                    ))}
                  {utilizationData.filter(a => a.totalAllocations === 0 && a.totalBookings === 0).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">All assets have been active.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Maintenance Requests by Category</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={maintenanceData.byCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="requestCount" name="Total Requests" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="resolvedCount" name="Resolved" fill="#10B981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Frequent Maintenance Assets</h3>
                <div className="space-y-3">
                  {maintenanceData.byAsset.slice(0, 6).map((a, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                      <div>
                        <div className="text-xs font-semibold text-foreground">{a.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{a.tag}</div>
                      </div>
                      <span className="text-xs font-bold text-red-500 font-mono">{a.requestCount} requests</span>
                    </div>
                  ))}
                  {maintenanceData.byAsset.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No maintenance logs recorded.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'departments' && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Department-wise Allocated Assets</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptAllocationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="department" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                    <Bar dataKey="activeAssets" name="Active Assets" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'heatmap' && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">Booking Distribution Heatmap</h3>
              <p className="text-xs text-muted-foreground mb-6">Visualizing resource bookings count by Day of Week and Hour of Day.</p>
              <div className="grid grid-cols-8 gap-1.5 text-center text-xs text-muted-foreground max-w-4xl mx-auto">
                <div></div>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="font-semibold">{d}</div>
                ))}
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 8; // 8:00 to 19:00
                  const label = `${String(hour).padStart(2, '0')}:00`;
                  return (
                    <>
                      <div key={label} className="flex items-center justify-end pr-2 text-[10px] font-semibold">{label}</div>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                        const cell = heatmapData.find(h => h.day === day && h.hour === hour) || { count: 0 };
                        const opacity = cell.count > 0 ? Math.min(0.2 + cell.count * 0.2, 1) : 0;
                        return (
                          <div
                            key={`${day}-${hour}`}
                            style={{ backgroundColor: opacity > 0 ? `rgba(37, 99, 235, ${opacity})` : 'rgba(148, 163, 184, 0.08)' }}
                            className={`aspect-square rounded flex items-center justify-center font-mono text-[9px] font-bold transition-all ${
                              opacity > 0.5 ? 'text-white' : 'text-foreground'
                            }`}
                            title={`${day} at ${label}: ${cell.count} bookings`}
                          >
                            {cell.count || ''}
                          </div>
                        );
                      })}
                    </>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'condition' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Asset Condition Summary</h3>
                <div className="h-64 flex flex-col justify-center">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={conditionData.conditionSummary}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="count"
                        nameKey="condition"
                      >
                        {conditionData.conditionSummary.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap items-center gap-3 justify-center mt-2">
                    {conditionData.conditionSummary.map((d, i) => (
                      <span key={d.condition} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                        {d.condition} ({d.count})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Assets in Fair / Poor Condition (Action Required)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        {['Tag', 'Asset Name', 'Category', 'Condition', 'Location'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {conditionData.needsMaintenance.map((a, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/25">
                          <td className="px-4 py-2.5 font-mono text-xs text-accent font-semibold">{a.tag}</td>
                          <td className="px-4 py-2.5 font-medium text-foreground text-xs">{a.name}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.category}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              a.condition === 'Poor'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                            }`}>
                              {a.condition}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.location || '—'}</td>
                        </tr>
                      ))}
                      {conditionData.needsMaintenance.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">All active assets are in Good or New condition.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
