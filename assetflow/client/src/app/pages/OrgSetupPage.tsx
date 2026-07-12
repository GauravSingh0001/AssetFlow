import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, MoreHorizontal, Users, X, Search } from 'lucide-react';

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
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium leading-snug ${className}`}>{children}</span>;
}

export default function OrgSetupPage() {
  const [tab, setTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, c, e] = await Promise.all([api.getDepartments(), api.getCategories(), api.getEmployees()]);
      setDepartments(d.departments);
      setCategories(c.categories);
      setEmployees(e.employees);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const saveDepartment = async () => {
    try {
      if (formData.id) await api.updateDepartment(formData.id, formData);
      else await api.createDepartment(formData);
      setModal(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const saveCategory = async () => {
    try {
      if (formData.id) await api.updateCategory(formData.id, formData);
      else await api.createCategory(formData);
      setModal(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const changeRole = async (empId, role) => {
    try {
      await api.updateEmployeeRole(empId, role);
      load();
    } catch (err) { alert(err.message); }
  };

  const toggleStatus = async (empId, current) => {
    try {
      await api.updateEmployeeStatus(empId, current === 'Active' ? 'Inactive' : 'Active');
      load();
    } catch (err) { alert(err.message); }
  };

  const TABS = [['departments', 'Departments'], ['categories', 'Asset Categories'], ['employees', 'Employee Directory']];

  const filteredEmployees = employees.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center border-b border-border">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
        <div className="ml-auto pb-1.5">
          {tab !== 'employees' && (
            <button onClick={() => { setFormData({}); setModal(tab === 'departments' ? 'dept' : 'cat'); }}
              className="flex items-center gap-1.5 h-8 px-3 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium">
              <Plus className="w-3.5 h-3.5" /> Add New
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Departments Tab */}
          {tab === 'departments' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Department', 'Head', 'Parent', 'Employees', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept, i) => (
                    <tr key={dept.id} className={`border-b border-border last:border-0 hover:bg-muted/25 transition-colors ${i % 2 ? 'bg-muted/10' : ''}`}>
                      <td className="px-4 py-3 font-medium text-foreground">{dept.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{dept.headName || '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{dept.parentName || '—'}</td>
                      <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-xs"><Users className="w-3.5 h-3.5 text-muted-foreground" />{dept.employeeCount}</span></td>
                      <td className="px-4 py-3">
                        <Badge className={dept.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'}>
                          {dept.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setFormData(dept); setModal('dept'); }}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Categories Tab */}
          {tab === 'categories' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Category', 'Custom Fields', 'Assets', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, i) => (
                    <tr key={cat.id} className={`border-b border-border last:border-0 hover:bg-muted/25 transition-colors ${i % 2 ? 'bg-muted/10' : ''}`}>
                      <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {cat.customFields?.length > 0 ? cat.customFields.map(f => f.label || f.name).join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3 font-['JetBrains_Mono',monospace] text-xs">{cat.assetCount}</td>
                      <td className="px-4 py-3">
                        <Badge className={cat.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'}>
                          {cat.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setFormData(cat); setModal('cat'); }}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Employee Directory Tab */}
          {tab === 'employees' && (
            <div className="space-y-4">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                  placeholder="Search employees..." />
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['Name', 'Email', 'Department', 'Role', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp, i) => (
                      <tr key={emp.id} className={`border-b border-border last:border-0 hover:bg-muted/25 transition-colors ${i % 2 ? 'bg-muted/10' : ''}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{emp.name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-['JetBrains_Mono',monospace]">{emp.email}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{emp.departmentName || '—'}</td>
                        <td className="px-4 py-3">
                          <select value={emp.role} onChange={e => changeRole(emp.id, e.target.value)}
                            className="h-7 px-2 text-xs bg-muted/50 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                            {['Employee', 'DeptHead', 'AssetManager', 'Admin'].map(r => <option key={r} value={r}>{r === 'DeptHead' ? 'Dept Head' : r === 'AssetManager' ? 'Asset Manager' : r}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={emp.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'}>
                            {emp.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleStatus(emp.id, emp.status)}
                            className={`h-7 px-3 text-xs rounded-md font-medium transition-colors ${emp.status === 'Active' ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400'}`}>
                            {emp.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Department Modal */}
      <Modal open={modal === 'dept'} onClose={() => setModal(null)} title={formData.id ? 'Edit Department' : 'Create Department'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
            <input value={formData.name || ''} onChange={e => set('name', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50" placeholder="Department name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Department Head</label>
            <select value={formData.headId || ''} onChange={e => set('headId', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
              <option value="">Select head...</option>
              {employees.filter(e => e.status === 'Active').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Parent Department</label>
            <select value={formData.parentId || ''} onChange={e => set('parentId', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
              <option value="">None (top-level)</option>
              {departments.filter(d => d.id !== formData.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {formData.id && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
              <select value={formData.status || 'Active'} onChange={e => set('status', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={saveDepartment} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Save</button>
            <button onClick={() => setModal(null)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal open={modal === 'cat'} onClose={() => setModal(null)} title={formData.id ? 'Edit Category' : 'Create Category'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
            <input value={formData.name || ''} onChange={e => set('name', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50" placeholder="Category name" />
          </div>
          {formData.id && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
              <select value={formData.status || 'Active'} onChange={e => set('status', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={saveCategory} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Save</button>
            <button onClick={() => setModal(null)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
