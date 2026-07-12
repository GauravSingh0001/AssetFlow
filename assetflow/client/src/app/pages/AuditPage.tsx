import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Plus, X, ClipboardCheck, Lock, AlertTriangle, CheckCircle, Search } from 'lucide-react';

function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium leading-snug ${className}`}>{children}</span>;
}

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

export default function AuditPage() {
  const { isAdmin } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  const loadCycles = async () => {
    try {
      const [c, d, e] = await Promise.all([api.getAuditCycles(), api.getDepartments(), api.getEmployees()]);
      setCycles(c.cycles);
      setDepartments(d.departments);
      setEmployees(e.employees);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadCycles(); }, []);

  const loadCycleDetail = async (id) => {
    try {
      const d = await api.getAuditCycle(id);
      setSelectedCycle(d.cycle);
      setItems(d.items);
    } catch (err) { console.error(err); }
  };

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const createCycle = async () => {
    try {
      const auditorIds = formData.auditorIds ? formData.auditorIds.split(',').map(Number).filter(Boolean) : [];
      await api.createAuditCycle({ ...formData, auditorIds });
      setModal(false);
      loadCycles();
    } catch (err) { alert(err.message); }
  };

  const markItem = async (itemId, result) => {
    const notes = result !== 'Verified' ? prompt('Notes (optional):') : '';
    try {
      await api.updateAuditItem(selectedCycle.id, itemId, { result, notes: notes || '' });
      loadCycleDetail(selectedCycle.id);
    } catch (err) { alert(err.message); }
  };

  const closeCycle = async () => {
    if (!confirm('Close this audit cycle? Missing items will be marked as Lost.')) return;
    try {
      await api.closeAuditCycle(selectedCycle.id);
      setSelectedCycle(null);
      loadCycles();
    } catch (err) { alert(err.message); }
  };

  if (selectedCycle) {
    const verified = items.filter(i => i.result === 'Verified').length;
    const missing = items.filter(i => i.result === 'Missing').length;
    const damaged = items.filter(i => i.result === 'Damaged').length;
    const pending = items.filter(i => !i.result).length;
    const progress = items.length ? Math.round(((items.length - pending) / items.length) * 100) : 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedCycle(null)} className="h-8 px-3 text-xs border border-border rounded-lg hover:bg-muted font-medium">← Back</button>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground">{selectedCycle.name}</h2>
            <p className="text-xs text-muted-foreground">{selectedCycle.departmentName || 'All departments'} · {selectedCycle.startDate} to {selectedCycle.endDate}</p>
          </div>
          {selectedCycle.status === 'Open' && isAdmin && (
            <button onClick={closeCycle} className="flex items-center gap-1.5 h-9 px-4 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
              <Lock className="w-4 h-4" /> Close Cycle
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3">
          {[
            ['Total', items.length, 'bg-slate-100 dark:bg-slate-800/40'],
            ['Verified', verified, 'bg-emerald-100 dark:bg-emerald-950/40'],
            ['Missing', missing, 'bg-red-100 dark:bg-red-950/40'],
            ['Damaged', damaged, 'bg-amber-100 dark:bg-amber-950/40'],
            ['Pending', pending, 'bg-blue-100 dark:bg-blue-950/40'],
          ].map(([label, val, bg]) => (
            <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
              <div className="font-['JetBrains_Mono',monospace] text-xl font-bold text-foreground">{val}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Audit Progress</span>
            <span className="text-sm font-bold text-foreground">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/40">
              {['Asset Tag', 'Asset Name', 'Location', 'Current Status', 'Audit Result', 'Auditor', selectedCycle.status === 'Open' ? 'Actions' : ''].filter(Boolean).map(h => (
                <th key={h} className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className={`border-b border-border last:border-0 hover:bg-muted/25 ${i % 2 ? 'bg-muted/10' : ''}`}>
                  <td className="px-4 py-3 font-['JetBrains_Mono',monospace] text-xs text-accent font-semibold">{item.assetTag}</td>
                  <td className="px-4 py-3 font-medium text-foreground text-sm">{item.assetName}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{item.location || '—'}</td>
                  <td className="px-4 py-3"><Badge className="bg-secondary text-secondary-foreground">{item.currentStatus}</Badge></td>
                  <td className="px-4 py-3">
                    {item.result ? (
                      <Badge className={item.result === 'Verified' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : item.result === 'Missing' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'}>
                        {item.result}
                      </Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{item.auditorName || '—'}</td>
                  {selectedCycle.status === 'Open' && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => markItem(item.id, 'Verified')} title="Verified"
                          className="w-7 h-7 flex items-center justify-center rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 transition-colors">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                        <button onClick={() => markItem(item.id, 'Missing')} title="Missing"
                          className="w-7 h-7 flex items-center justify-center rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/30 transition-colors">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        </button>
                        <button onClick={() => markItem(item.id, 'Damaged')} title="Damaged"
                          className="w-7 h-7 flex items-center justify-center rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 transition-colors">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Discrepancy Report */}
        {(missing > 0 || damaged > 0) && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">Discrepancy Report</span>
            </div>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">{missing + damaged} asset{missing + damaged > 1 ? 's' : ''} flagged — {missing} missing, {damaged} damaged</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-foreground flex-1">Audit Cycles</h2>
        {isAdmin && (
          <button onClick={() => { setFormData({}); setModal(true); }}
            className="flex items-center gap-1.5 h-9 px-4 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">
            <Plus className="w-4 h-4" /> Create Audit Cycle
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {cycles.map(cycle => (
            <div key={cycle.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => loadCycleDetail(cycle.id)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{cycle.name}</span>
                    <Badge className={cycle.status === 'Open' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'}>
                      {cycle.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {cycle.departmentName || 'All departments'} · {cycle.startDate} to {cycle.endDate}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Auditors: {cycle.auditors?.map(a => a.name).join(', ') || 'None assigned'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-foreground font-['JetBrains_Mono',monospace]">{cycle.completedItems}/{cycle.totalItems}</div>
                  <div className="text-xs text-muted-foreground">items audited</div>
                  {cycle.discrepancies > 0 && (
                    <div className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1">{cycle.discrepancies} discrepancies</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {cycles.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">No audit cycles. Create one to get started.</div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Create Audit Cycle">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name *</label>
            <input value={formData.name || ''} onChange={e => set('name', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50" placeholder="Q4 2025 Asset Audit" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Department (scope)</label>
            <select value={formData.departmentId || ''} onChange={e => set('departmentId', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
              <option value="">All departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Location (scope)</label>
            <input value={formData.location || ''} onChange={e => set('location', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50" placeholder="e.g., HQ Floor 3" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Start Date *</label>
              <input type="date" value={formData.startDate || ''} onChange={e => set('startDate', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">End Date *</label>
              <input type="date" value={formData.endDate || ''} onChange={e => set('endDate', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Auditor IDs (comma-separated)</label>
            <input value={formData.auditorIds || ''} onChange={e => set('auditorIds', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50" placeholder="e.g., 2,3,7" />
            <p className="text-[11px] text-muted-foreground mt-1">Enter employee IDs of auditors</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={createCycle} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Create Cycle</button>
            <button onClick={() => setModal(false)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
