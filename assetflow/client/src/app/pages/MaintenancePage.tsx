import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Wrench, Plus, Check, X, Play, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium leading-snug ${className}`}>{children}</span>;
}

const STATUS_COLORS = {
  Pending: 'border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20',
  Approved: 'border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20',
  TechnicianAssigned: 'border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20',
  InProgress: 'border-cyan-200 dark:border-cyan-800/40 bg-cyan-50/50 dark:bg-cyan-950/20',
  Resolved: 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20',
  Rejected: 'border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/20',
};

const PRIORITY_BADGE = {
  High: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',
};

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const { isManager } = useAuth();
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(false);
  const [formData, setFormData] = useState({ priority: 'Medium' });
  const [view, setView] = useState('board');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [m, a, e] = await Promise.all([api.getMaintenanceRequests(), api.getAssets(), api.getEmployees()]);
      setRequests(m.requests);
      setAssets(a.assets);
      setEmployees(e.employees);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const create = async () => {
    try {
      await api.createMaintenanceRequest({ assetId: parseInt(formData.assetId), description: formData.description, priority: formData.priority });
      setModal(false);
      load();
    } catch (err) { alert(err.message); }
  };

  const approve = async (id) => { try { await api.approveMaintenance(id); load(); } catch (e) { alert(e.message); } };
  const reject = async (id) => { try { await api.rejectMaintenance(id); load(); } catch (e) { alert(e.message); } };
  const assign = async (id) => {
    const techId = prompt('Technician Employee ID:');
    if (techId) { try { await api.assignTechnician(id, parseInt(techId)); load(); } catch (e) { alert(e.message); } }
  };
  const start = async (id) => { try { await api.startMaintenance(id); load(); } catch (e) { alert(e.message); } };
  const resolve = async (id) => { try { await api.resolveMaintenance(id); load(); } catch (e) { alert(e.message); } };

  const columns = [
    { key: 'Pending', label: 'Pending', icon: Clock, color: 'text-amber-600' },
    { key: 'Approved', label: 'Approved', icon: Check, color: 'text-blue-600' },
    { key: 'TechnicianAssigned', label: 'Technician Assigned', icon: Wrench, color: 'text-violet-600' },
    { key: 'InProgress', label: 'In Progress', icon: Play, color: 'text-cyan-600' },
    { key: 'Resolved', label: 'Resolved', icon: CheckCircle, color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          <button onClick={() => setView('board')} className={`h-8 px-3 text-xs rounded-lg font-medium ${view === 'board' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'}`}>Board</button>
          <button onClick={() => setView('list')} className={`h-8 px-3 text-xs rounded-lg font-medium ${view === 'list' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'}`}>List</button>
        </div>
        <button onClick={() => { setFormData({ priority: 'Medium' }); setModal(true); }}
          className="ml-auto flex items-center gap-1.5 h-9 px-4 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">
          <Plus className="w-4 h-4" /> Raise Request
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : view === 'board' ? (
        <div className="grid grid-cols-5 gap-3">
          {columns.map(col => {
            const Icon = col.icon;
            const items = requests.filter(r => r.status === col.key);
            return (
              <div key={col.key} className="space-y-2">
                <div className="flex items-center gap-2 px-1 pb-2">
                  <Icon className={`w-4 h-4 ${col.color}`} />
                  <span className="text-xs font-semibold text-foreground">{col.label}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground font-['JetBrains_Mono',monospace]">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {items.map(req => (
                    <div key={req.id} className={`border rounded-xl p-3 hover:-translate-y-1 hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer ${STATUS_COLORS[req.status]}`}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Badge className={PRIORITY_BADGE[req.priority]}>{req.priority}</Badge>
                        <span className="text-[10px] text-muted-foreground font-['JetBrains_Mono',monospace]">{req.assetTag}</span>
                      </div>
                      <div className="text-xs font-medium text-foreground leading-snug mb-1">{req.assetName}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{req.description}</div>
                      <div className="text-[10px] text-muted-foreground mt-2">{req.reportedByName} · {new Date(req.createdAt).toLocaleDateString()}</div>
                      
                      {/* Actions */}
                      <div className="flex gap-1.5 mt-3">
                        {req.status === 'Pending' && isManager && (
                          <>
                            <button onClick={() => approve(req.id)} className="h-6 px-2 text-[10px] bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700">Approve</button>
                            <button onClick={() => reject(req.id)} className="h-6 px-2 text-[10px] border border-border rounded font-medium hover:bg-muted text-muted-foreground">Reject</button>
                          </>
                        )}
                        {req.status === 'Approved' && isManager && (
                          <button onClick={() => assign(req.id)} className="h-6 px-2 text-[10px] bg-violet-600 text-white rounded font-medium hover:bg-violet-700">Assign Tech</button>
                        )}
                        {(req.status === 'TechnicianAssigned') && (
                          <button onClick={() => start(req.id)} className="h-6 px-2 text-[10px] bg-cyan-600 text-white rounded font-medium hover:bg-cyan-700">Start</button>
                        )}
                        {req.status === 'InProgress' && isManager && (
                          <button onClick={() => resolve(req.id)} className="h-6 px-2 text-[10px] bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700">Resolve</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/40">
              {['Asset', 'Description', 'Priority', 'Status', 'Reported By', 'Date', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {requests.map((req, i) => (
                <tr key={req.id} className={`border-b border-border last:border-0 hover:bg-muted/25 ${i % 2 ? 'bg-muted/10' : ''}`}>
                  <td className="px-4 py-3"><div className="font-medium text-foreground text-sm">{req.assetName}</div><div className="text-[11px] text-muted-foreground font-['JetBrains_Mono',monospace]">{req.assetTag}</div></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-48 truncate">{req.description}</td>
                  <td className="px-4 py-3"><Badge className={PRIORITY_BADGE[req.priority]}>{req.priority}</Badge></td>
                  <td className="px-4 py-3"><Badge className="bg-secondary text-secondary-foreground">{req.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{req.reportedByName}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-['JetBrains_Mono',monospace]">{new Date(req.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {req.status === 'Pending' && isManager && <><button onClick={() => approve(req.id)} className="h-6 px-2 text-[10px] bg-emerald-600 text-white rounded">Approve</button><button onClick={() => reject(req.id)} className="h-6 px-2 text-[10px] border border-border rounded">Reject</button></>}
                      {req.status === 'InProgress' && isManager && <button onClick={() => resolve(req.id)} className="h-6 px-2 text-[10px] bg-emerald-600 text-white rounded">Resolve</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Raise Request Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Raise Maintenance Request">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Asset *</label>
            <select value={formData.assetId || ''} onChange={e => set('assetId', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
              <option value="">Select asset...</option>
              {assets.filter(a => !['Retired','Disposed'].includes(a.status)).map(a => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description *</label>
            <textarea value={formData.description || ''} onChange={e => set('description', e.target.value)}
              className="w-full h-24 px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
              placeholder="Describe the issue..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Priority</label>
            <div className="flex gap-2">
              {['Low', 'Medium', 'High'].map(p => (
                <button key={p} onClick={() => set('priority', p)}
                  className={`flex-1 h-9 text-sm rounded-lg border font-medium transition-colors ${formData.priority === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={create} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Submit Request</button>
            <button onClick={() => setModal(false)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
