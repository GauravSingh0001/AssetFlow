import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Search, Plus, MapPin, MoreHorizontal, ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';

function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium leading-snug ${className}`}>{children}</span>;
}

const STATUS_STYLES = {
  'Available': 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400',
  'Allocated': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
  'Reserved': 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400',
  'Under Maintenance': 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  'Lost': 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400',
  'Retired': 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400',
  'Disposed': 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400',
};

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-card border border-border rounded-2xl shadow-xl ${wide ? 'w-full max-w-2xl' : 'w-full max-w-lg'} max-h-[85vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AssetDirectoryPage() {
  const { isManager } = useAuth();
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [catFilter, setCatFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [detailAsset, setDetailAsset] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const PER_PAGE = 10;

  const load = async () => {
    try {
      const [a, c] = await Promise.all([api.getAssets(), api.getCategories()]);
      setAssets(a.assets);
      setCategories(c.categories);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => assets.filter(a => {
    const q = search.toLowerCase();
    return (!q || a.name.toLowerCase().includes(q) || a.tag.toLowerCase().includes(q) || a.serialNumber?.toLowerCase().includes(q)) &&
      (statusFilter === 'All' || a.status === statusFilter) &&
      (catFilter === 'All' || a.categoryId === parseInt(catFilter));
  }), [assets, search, statusFilter, catFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const visible = filtered.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const saveAsset = async () => {
    try {
      if (formData.id) await api.updateAsset(formData.id, formData);
      else await api.createAsset(formData);
      setModal(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const viewDetail = async (asset) => {
    setDetailAsset(asset);
    try {
      const d = await api.getAsset(asset.id);
      setDetailData(d);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full h-9 pl-8 pr-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            placeholder="Search by name, tag, or serial..." />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="h-9 px-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground">
          {['All', 'Available', 'Allocated', 'Reserved', 'Under Maintenance', 'Lost', 'Retired', 'Disposed'].map(s => (
            <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
          ))}
        </select>
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(0); }}
          className="h-9 px-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground">
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {isManager && (
          <button onClick={() => { setFormData({ condition: 'New' }); setModal('asset'); }}
            className="ml-auto flex items-center gap-1.5 h-9 px-4 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium">
            <Plus className="w-4 h-4" /> Register Asset
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Tag', 'Name', 'Category', 'Location', 'Status', 'Assigned To', 'Condition', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((asset, i) => (
                  <tr key={asset.id} className={`border-b border-border last:border-0 hover:bg-muted/25 transition-colors cursor-pointer ${i % 2 ? 'bg-muted/10' : ''}`}
                    onClick={() => viewDetail(asset)}>
                    <td className="px-4 py-3 font-['JetBrains_Mono',monospace] text-xs text-accent font-semibold">{asset.tag}</td>
                    <td className="px-4 py-3 font-medium text-foreground text-sm whitespace-nowrap">{asset.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{asset.categoryName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{asset.location || '—'}</span>
                    </td>
                    <td className="px-4 py-3"><Badge className={STATUS_STYLES[asset.status] || ''}>{asset.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{asset.allocatedToName || '—'}</td>
                    <td className="px-4 py-3"><Badge className={asset.condition === 'Poor' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400' : asset.condition === 'Fair' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'}>{asset.condition}</Badge></td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => viewDetail(asset)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No assets found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {filtered.length === 0 ? 'No assets' : `Showing ${page * PER_PAGE + 1}–${Math.min((page + 1) * PER_PAGE, filtered.length)} of ${filtered.length}`}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="w-7 h-7 flex items-center justify-center rounded border border-border disabled:opacity-30 hover:bg-muted transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${i === page ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-border disabled:opacity-30 hover:bg-muted transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Asset Modal */}
      <Modal open={modal === 'asset'} onClose={() => setModal(null)} title="Register New Asset">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Name *</label>
              <input value={formData.name || ''} onChange={e => set('name', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50" placeholder="Asset name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Category *</label>
              <select value={formData.categoryId || ''} onChange={e => set('categoryId', parseInt(e.target.value))}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
                <option value="">Select...</option>
                {categories.filter(c => c.status === 'Active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Serial Number</label>
              <input value={formData.serialNumber || ''} onChange={e => set('serialNumber', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50" placeholder="SN-XXX-XXXX" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Acquisition Date</label>
              <input type="date" value={formData.acquisitionDate || ''} onChange={e => set('acquisitionDate', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Acquisition Cost</label>
              <input type="number" value={formData.acquisitionCost || ''} onChange={e => set('acquisitionCost', parseFloat(e.target.value))}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Condition</label>
              <select value={formData.condition || 'New'} onChange={e => set('condition', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
                {['New', 'Good', 'Fair', 'Poor'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input value={formData.location || ''} onChange={e => set('location', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50" placeholder="e.g., HQ Floor 3" />
            </div>
            <div className="col-span-2 flex items-center gap-3 py-2">
              <input type="checkbox" id="isShared" checked={!!formData.isShared} onChange={e => set('isShared', e.target.checked)}
                className="w-4 h-4 rounded border-border" />
              <label htmlFor="isShared" className="text-sm text-foreground">Shared / Bookable Resource</label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={saveAsset} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Register Asset</button>
            <button onClick={() => setModal(null)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Asset Detail Slide-out */}
      {detailAsset && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30" onClick={() => { setDetailAsset(null); setDetailData(null); }} />
          <div className="relative w-full max-w-lg bg-card border-l border-border shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border p-5 flex items-center justify-between z-10">
              <div>
                <h3 className="text-base font-semibold text-foreground">{detailAsset.name}</h3>
                <p className="text-xs text-muted-foreground font-['JetBrains_Mono',monospace] mt-0.5">{detailAsset.tag}</p>
              </div>
              <button onClick={() => { setDetailAsset(null); setDetailData(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Category', detailData?.asset?.categoryName],
                  ['Status', detailAsset.status],
                  ['Condition', detailData?.asset?.condition],
                  ['Location', detailAsset.location],
                  ['Serial', detailData?.asset?.serialNumber || '—'],
                  ['Cost', detailData?.asset?.acquisitionCost ? `$${detailData.asset.acquisitionCost.toLocaleString()}` : '—'],
                  ['Bookable', detailAsset.isShared ? 'Yes' : 'No'],
                  ['Acquired', detailData?.asset?.acquisitionDate || '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wide">{label}</div>
                    <div className="text-sm text-foreground mt-0.5">{val}</div>
                  </div>
                ))}
              </div>

              {detailData?.allocations?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Allocation History</h4>
                  <div className="space-y-2">
                    {detailData.allocations.map(al => (
                      <div key={al.id} className="p-3 bg-muted/30 rounded-lg text-xs">
                        <div className="flex justify-between">
                          <span className="font-medium text-foreground">{al.employeeName}</span>
                          <Badge className={al.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : al.status === 'Overdue' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'}>{al.status}</Badge>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {new Date(al.allocatedAt).toLocaleDateString()} {al.actualReturnDate ? `→ ${new Date(al.actualReturnDate).toLocaleDateString()}` : ''}
                        </div>
                        {al.returnConditionNotes && <div className="text-muted-foreground mt-1 italic">"{al.returnConditionNotes}"</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailData?.maintenanceHistory?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Maintenance History</h4>
                  <div className="space-y-2">
                    {detailData.maintenanceHistory.map(m => (
                      <div key={m.id} className="p-3 bg-muted/30 rounded-lg text-xs">
                        <div className="flex justify-between">
                          <span className="font-medium text-foreground">{m.description.substring(0, 60)}{m.description.length > 60 ? '...' : ''}</span>
                          <Badge className={m.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'}>{m.status}</Badge>
                        </div>
                        <div className="text-muted-foreground mt-1">By {m.reportedByName} · {new Date(m.createdAt).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
