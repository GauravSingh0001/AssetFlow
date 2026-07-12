import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, X, CalendarDays } from 'lucide-react';

const BOOKING_COLORS = ['bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950/70 dark:border-blue-600/40 dark:text-blue-300',
  'bg-violet-50 border-violet-300 text-violet-800 dark:bg-violet-950/70 dark:border-violet-600/40 dark:text-violet-300',
  'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/70 dark:border-emerald-600/40 dark:text-emerald-300',
  'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/70 dark:border-amber-600/40 dark:text-amber-300',
  'bg-cyan-50 border-cyan-300 text-cyan-800 dark:bg-cyan-950/70 dark:border-cyan-600/40 dark:text-cyan-300'];

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

function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${className}`}>{children}</span>;
}

export default function BookingPage() {
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedRes, setSelectedRes] = useState(null);
  const [modal, setModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const load = async () => {
    try {
      const [r, b] = await Promise.all([api.getBookableResources(), api.getBookings()]);
      setResources(r.resources);
      setBookings(b.bookings);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const book = async () => {
    setError('');
    try {
      const startTime = `${formData.date} ${formData.startTime}`;
      const endTime = `${formData.date} ${formData.endTime}`;
      await api.createBooking({ assetId: parseInt(formData.resourceId), startTime, endTime, purpose: formData.purpose });
      setModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const cancel = async (id) => {
    if (!confirm('Cancel this booking?')) return;
    try { await api.cancelBooking(id); load(); } catch (e) { alert(e.message); }
  };

  // Generate week days
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtDate = (d) => d.toISOString().split('T')[0];

  const displayed = selectedRes ? resources.filter(r => r.id === selectedRes) : resources;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setSelectedRes(null)}
          className={`h-8 px-3 text-xs rounded-lg border font-medium transition-colors ${!selectedRes ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
          All Resources
        </button>
        {resources.map(r => (
          <button key={r.id} onClick={() => setSelectedRes(selectedRes === r.id ? null : r.id)}
            className={`h-8 px-3 text-xs rounded-lg border font-medium transition-colors ${selectedRes === r.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
            {r.name}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setWeekOffset(p => p - 1)} className="h-8 w-8 flex items-center justify-center border border-border rounded-lg hover:bg-muted text-xs">←</button>
          <button onClick={() => setWeekOffset(0)} className="h-8 px-3 text-xs border border-border rounded-lg hover:bg-muted font-medium">Today</button>
          <button onClick={() => setWeekOffset(p => p + 1)} className="h-8 w-8 flex items-center justify-center border border-border rounded-lg hover:bg-muted text-xs">→</button>
          <button onClick={() => { setFormData({}); setError(''); setModal(true); }}
            className="flex items-center gap-1.5 h-8 px-3 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium">
            <Plus className="w-3.5 h-3.5" /> New Booking
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid border-b border-border" style={{ gridTemplateColumns: '172px repeat(5, minmax(0, 1fr))' }}>
            <div className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-r border-border bg-muted/40">Resource</div>
            {weekDays.map((d, i) => (
              <div key={i} className={`px-3 py-3 text-[11px] font-semibold text-muted-foreground text-center bg-muted/40 ${i < 4 ? 'border-r border-border' : ''} ${fmtDate(d) === fmtDate(today) ? '!text-accent font-bold' : ''}`}>
                {fmtDay(d)}
              </div>
            ))}
          </div>

          {displayed.map((resource, ri) => {
            const resourceBookings = bookings.filter(b => b.assetId === resource.id);
            return (
              <div key={resource.id} className={`grid border-b border-border last:border-0 ${ri % 2 ? 'bg-muted/5' : ''}`}
                style={{ gridTemplateColumns: '172px repeat(5, minmax(0, 1fr))' }}>
                <div className="px-4 py-4 border-r border-border flex items-start">
                  <span className="text-xs font-semibold text-foreground leading-snug">{resource.name}</span>
                </div>
                {weekDays.map((day, di) => {
                  const dayStr = fmtDate(day);
                  const dayBookings = resourceBookings.filter(b => b.startTime.startsWith(dayStr) && b.status !== 'Cancelled');
                  return (
                    <div key={di} className={`px-2 py-2 min-h-[72px] space-y-1.5 ${di < 4 ? 'border-r border-border' : ''}`}>
                      {dayBookings.length === 0 ? (
                        <div className="h-full min-h-[56px] flex items-center justify-center">
                          <div onClick={() => { setFormData({ resourceId: resource.id, date: dayStr }); setError(''); setModal(true); }}
                            className="w-full h-full min-h-[56px] border border-dashed border-border/50 rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors group">
                            <Plus className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
                          </div>
                        </div>
                      ) : dayBookings.map((b, bi) => (
                        <div key={b.id} className={`rounded-lg border px-2.5 py-2 cursor-pointer hover:opacity-80 transition-opacity ${BOOKING_COLORS[ri % BOOKING_COLORS.length]}`}
                          onClick={() => b.status === 'Upcoming' && cancel(b.id)}>
                          <div className="text-[11px] font-semibold leading-snug truncate">{b.purpose || 'Booking'}</div>
                          <div className="text-[10px] opacity-60 mt-0.5 truncate">{b.bookedByName} · {b.startTime.split(' ')[1]}–{b.endTime.split(' ')[1]}</div>
                          {b.status === 'Upcoming' && <div className="text-[9px] mt-1 opacity-50">Click to cancel</div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Book Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Book Resource">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1.5">Resource *</label>
            <select value={formData.resourceId || ''} onChange={e => set('resourceId', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
              <option value="">Select...</option>
              {resources.map(r => <option key={r.id} value={r.id}>{r.name} — {r.location}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Date *</label>
            <input type="date" value={formData.date || ''} onChange={e => set('date', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Start Time *</label>
              <input type="time" value={formData.startTime || ''} onChange={e => set('startTime', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">End Time *</label>
              <input type="time" value={formData.endTime || ''} onChange={e => set('endTime', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Purpose</label>
            <input value={formData.purpose || ''} onChange={e => set('purpose', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50" placeholder="Meeting, lab session, etc." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={book} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Book Resource</button>
            <button onClick={() => setModal(false)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
