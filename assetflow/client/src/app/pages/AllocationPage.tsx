import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { ArrowLeftRight, Search, Check, X, AlertTriangle, Clock, Package } from 'lucide-react';

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

export default function AllocationPage() {
  const { isManager, isDeptHead } = useAuth();
  const [tab, setTab] = useState('active');
  const [allocations, setAllocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [al, tr, as, em] = await Promise.all([
        api.getAllocations(), api.getTransfers(), api.getAssets(), api.getEmployees()
      ]);
      setAllocations(al.allocations);
      setTransfers(tr.transfers);
      setAssets(as.assets);
      setEmployees(em.employees);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const allocate = async () => {
    setError('');
    try {
      await api.createAllocation(formData);
      setModal(null);
      load();
    } catch (err) {
      if (err.message.includes('currently held by')) {
        setError(err.message);
      } else {
        alert(err.message);
      }
    }
  };

  const returnAsset = async (allocationId) => {
    const notes = prompt('Condition notes on return (optional):');
    try {
      await api.returnAsset(allocationId, notes || '');
      load();
    } catch (err) { alert(err.message); }
  };

  const requestTransfer = async () => {
    try {
      await api.createTransfer({ assetId: formData.assetId, toEmployeeId: parseInt(formData.toEmployeeId) });
      setModal(null);
      setError('');
      load();
    } catch (err) { alert(err.message); }
  };

  const approveTransfer = async (id) => { try { await api.approveTransfer(id); load(); } catch (e) { alert(e.message); } };
  const rejectTransfer = async (id) => { try { await api.rejectTransfer(id); load(); } catch (e) { alert(e.message); } };

  const activeAllocations = allocations.filter(a => a.status === 'Active' || a.status === 'Overdue');
  const returnedAllocations = allocations.filter(a => a.status === 'Returned');
  const overdueAllocations = allocations.filter(a => a.status === 'Overdue' || (a.status === 'Active' && a.expectedReturnDate && new Date(a.expectedReturnDate) < new Date()));
  const pendingTransfers = transfers.filter(t => t.status === 'Pending');

  const TABS = [
    ['active', `Active (${activeAllocations.length})`],
    ['overdue', `Overdue (${overdueAllocations.length})`],
    ['transfers', `Transfers (${pendingTransfers.length})`],
    ['history', `History (${returnedAllocations.length})`],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center border-b border-border flex-1">
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        {isManager && (
          <button onClick={() => { setFormData({}); setError(''); setModal('allocate'); }}
            className="flex items-center gap-1.5 h-9 px-4 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium">
            <Package className="w-4 h-4" /> Allocate Asset
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Active/Overdue Allocations */}
          {(tab === 'active' || tab === 'overdue') && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/40">
                  {['Asset', 'Assigned To', 'Department', 'Allocated', 'Expected Return', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(tab === 'active' ? activeAllocations : overdueAllocations).map((al, i) => (
                    <tr key={al.id} className={`border-b border-border last:border-0 hover:bg-muted/25 transition-colors ${i % 2 ? 'bg-muted/10' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground text-sm">{al.assetName}</div>
                        <div className="text-[11px] text-muted-foreground font-['JetBrains_Mono',monospace]">{al.assetTag}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{al.employeeName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{al.departmentName || '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-['JetBrains_Mono',monospace]">{new Date(al.allocatedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs font-['JetBrains_Mono',monospace]">
                        {al.expectedReturnDate ? (
                          <span className={new Date(al.expectedReturnDate) < new Date() ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground'}>
                            {new Date(al.expectedReturnDate).toLocaleDateString()}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={al.status === 'Overdue' || (al.expectedReturnDate && new Date(al.expectedReturnDate) < new Date()) ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'}>
                          {al.status === 'Overdue' || (al.expectedReturnDate && new Date(al.expectedReturnDate) < new Date()) ? 'Overdue' : al.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => returnAsset(al.id)}
                            className="h-7 px-3 text-xs bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 font-medium">
                            Return
                          </button>
                          <button onClick={() => { setFormData({ assetId: al.assetId }); setModal('transfer'); }}
                            className="h-7 px-3 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 font-medium">
                            Transfer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(tab === 'active' ? activeAllocations : overdueAllocations).length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No {tab} allocations</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Transfers */}
          {tab === 'transfers' && (
            <div className="space-y-3">
              {transfers.map(tr => (
                <div key={tr.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className="bg-secondary text-secondary-foreground">{tr.assetTag}</Badge>
                        <Badge className={tr.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400' : tr.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'}>{tr.status}</Badge>
                      </div>
                      <div className="text-sm font-medium text-foreground">{tr.assetName}</div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{tr.fromEmployeeName}</span>
                        <ArrowLeftRight className="w-3 h-3" />
                        <span>{tr.toEmployeeName}</span>
                        <span className="ml-2"><Clock className="w-3 h-3 inline mr-0.5" />{new Date(tr.requestedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {tr.status === 'Pending' && isDeptHead && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => approveTransfer(tr.id)}
                          className="flex items-center gap-1 h-8 px-3 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => rejectTransfer(tr.id)}
                          className="flex items-center gap-1 h-8 px-3 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted font-medium">
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {transfers.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">No transfer requests</div>
              )}
            </div>
          )}

          {/* History */}
          {tab === 'history' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/40">
                  {['Asset', 'Employee', 'Allocated', 'Returned', 'Condition Notes'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {returnedAllocations.map((al, i) => (
                    <tr key={al.id} className={`border-b border-border last:border-0 ${i % 2 ? 'bg-muted/10' : ''}`}>
                      <td className="px-4 py-3 font-medium text-foreground">{al.assetName}<br/><span className="text-[11px] text-muted-foreground font-['JetBrains_Mono',monospace]">{al.assetTag}</span></td>
                      <td className="px-4 py-3 text-sm text-foreground">{al.employeeName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-['JetBrains_Mono',monospace]">{new Date(al.allocatedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-['JetBrains_Mono',monospace]">{al.actualReturnDate ? new Date(al.actualReturnDate).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground italic">{al.returnConditionNotes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Allocate Modal */}
      <Modal open={modal === 'allocate'} onClose={() => { setModal(null); setError(''); }} title="Allocate Asset">
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 text-sm text-red-600 dark:text-red-400">
              <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</div>
              <button onClick={() => setModal('transfer')} className="mt-2 h-7 px-3 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Request Transfer Instead
              </button>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Asset *</label>
            <select value={formData.assetId || ''} onChange={e => set('assetId', parseInt(e.target.value))}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
              <option value="">Select asset...</option>
              {assets.filter(a => a.status === 'Available').map(a => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Assign To *</label>
            <select value={formData.employeeId || ''} onChange={e => set('employeeId', parseInt(e.target.value))}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
              <option value="">Select employee...</option>
              {employees.filter(e => e.status === 'Active').map(e => <option key={e.id} value={e.id}>{e.name} ({e.departmentName || 'No dept'})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Expected Return Date</label>
            <input type="date" value={formData.expectedReturnDate || ''} onChange={e => set('expectedReturnDate', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={allocate} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Allocate</button>
            <button onClick={() => { setModal(null); setError(''); }} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Transfer Modal */}
      <Modal open={modal === 'transfer'} onClose={() => setModal(null)} title="Request Transfer">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Asset</label>
            <select value={formData.assetId || ''} onChange={e => set('assetId', parseInt(e.target.value))}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
              <option value="">Select asset...</option>
              {assets.filter(a => a.status === 'Allocated').map(a => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Transfer To *</label>
            <select value={formData.toEmployeeId || ''} onChange={e => set('toEmployeeId', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
              <option value="">Select employee...</option>
              {employees.filter(e => e.status === 'Active').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={requestTransfer} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Submit Request</button>
            <button onClick={() => setModal(null)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
