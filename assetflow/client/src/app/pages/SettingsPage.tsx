import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Boxes, Package, Shield, Cpu, Building2, Warehouse,
  Activity, Layers, Globe, Save, RefreshCw, Palette
} from 'lucide-react';

const ICON_MAP = {
  Boxes,
  Package,
  Shield,
  Cpu,
  Building2,
  Warehouse,
  Activity,
  Layers,
  Globe
};

const PRESET_THEMES = [
  {
    name: 'AssetFlow Navy (Default)',
    primary: '#1B3568',
    accent: '#2563EB',
    sidebar: '#1B3568'
  },
  {
    name: 'Emerald Forest',
    primary: '#064E3B',
    accent: '#10B981',
    sidebar: '#064E3B'
  },
  {
    name: 'Royal Purple',
    primary: '#4C1D95',
    accent: '#8B5CF6',
    sidebar: '#4D1A7F'
  },
  {
    name: 'Slate Minimal',
    primary: '#0F172A',
    accent: '#3B82F6',
    sidebar: '#1E293B'
  },
  {
    name: 'Burgundy Reserve',
    primary: '#5B1224',
    accent: '#E11D48',
    sidebar: '#5B1224'
  }
];

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState({
    company_name: 'AssetFlow',
    company_logo: '',
    company_icon: 'Boxes',
    primary_color: '#1B3568',
    accent_color: '#2563EB',
    sidebar_color: '#1B3568'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getSystemSettings();
      if (res.settings) {
        setSettings(prev => ({
          ...prev,
          ...res.settings
        }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handlePresetSelect = (preset) => {
    setSettings(prev => ({
      ...prev,
      primary_color: preset.primary,
      accent_color: preset.accent,
      sidebar_color: preset.sidebar
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Only administrators can change system configuration.');
      return;
    }
    setSaving(true);
    setSuccess('');
    try {
      await api.updateSystemSettings(settings);
      setSuccess('Branding settings saved successfully! Refresh page to apply system-wide.');
      
      // Instantly apply settings to current document to preview live
      document.documentElement.style.setProperty('--primary', settings.primary_color);
      document.documentElement.style.setProperty('--accent', settings.accent_color);
      document.documentElement.style.setProperty('--ring', settings.accent_color);
      document.documentElement.style.setProperty('--sidebar', settings.sidebar_color);
      
      // Update local storage so AppLayout syncs it immediately
      localStorage.setItem('custom_company_name', settings.company_name);
      localStorage.setItem('custom_company_logo', settings.company_logo);
      localStorage.setItem('custom_company_icon', settings.company_icon);
      localStorage.setItem('custom_primary_color', settings.primary_color);
      localStorage.setItem('custom_accent_color', settings.accent_color);
      localStorage.setItem('custom_sidebar_color', settings.sidebar_color);
      
      // Dispatch storage event to notify other layout components
      window.dispatchEvent(new Event('storage'));

    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    }
    setSaving(false);
  };

  const set = (k, v) => setSettings(p => ({ ...p, [k]: v }));

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const PreviewIcon = ICON_MAP[settings.company_icon] || Boxes;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Palette className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">ERP Customization & Branding</h2>
          <p className="text-xs text-muted-foreground">Modify company logo, names, icon identifiers, and dynamic system layouts.</p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-600 dark:text-emerald-400">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Branding Config</h3>
            
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Company Name</label>
              <input
                type="text"
                value={settings.company_name}
                onChange={e => set('company_name', e.target.value)}
                disabled={!isAdmin}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground"
                placeholder="AssetFlow"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Company Logo Image URL</label>
              <input
                type="text"
                value={settings.company_logo}
                onChange={e => set('company_logo', e.target.value)}
                disabled={!isAdmin}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground"
                placeholder="https://example.com/logo.png (Empty for text logo)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">App Icon</label>
                <select
                  value={settings.company_icon}
                  onChange={e => set('company_icon', e.target.value)}
                  disabled={!isAdmin}
                  className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground"
                >
                  {Object.keys(ICON_MAP).map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Sidebar Color</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={settings.sidebar_color}
                    onChange={e => set('sidebar_color', e.target.value)}
                    disabled={!isAdmin}
                    className="w-10 h-10 p-0.5 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={settings.sidebar_color}
                    onChange={e => set('sidebar_color', e.target.value)}
                    disabled={!isAdmin}
                    className="flex-1 h-10 px-3 text-xs bg-muted/50 border border-border rounded-lg text-foreground font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Primary Accent Color</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={settings.primary_color}
                    onChange={e => set('primary_color', e.target.value)}
                    disabled={!isAdmin}
                    className="w-10 h-10 p-0.5 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={settings.primary_color}
                    onChange={e => set('primary_color', e.target.value)}
                    disabled={!isAdmin}
                    className="flex-1 h-10 px-3 text-xs bg-muted/50 border border-border rounded-lg text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Highlight/Link Color</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={settings.accent_color}
                    onChange={e => set('accent_color', e.target.value)}
                    disabled={!isAdmin}
                    className="w-10 h-10 p-0.5 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={settings.accent_color}
                    onChange={e => set('accent_color', e.target.value)}
                    disabled={!isAdmin}
                    className="flex-1 h-10 px-3 text-xs bg-muted/50 border border-border rounded-lg text-foreground font-mono"
                  />
                </div>
              </div>
            </div>

            {isAdmin ? (
              <button
                type="submit"
                disabled={saving}
                className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Branding Configurations
              </button>
            ) : (
              <p className="text-xs text-red-500 font-medium text-center">Only administrators can modify customization options.</p>
            )}
          </form>
        </div>

        {/* Theme presets & Previews */}
        <div className="space-y-6">
          {/* Theme Presets */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Predefined Themes</h3>
            <div className="space-y-2">
              {PRESET_THEMES.map(theme => (
                <button
                  key={theme.name}
                  type="button"
                  onClick={() => handlePresetSelect(theme)}
                  disabled={!isAdmin}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex -space-x-1.5">
                    <span className="w-4 h-4 rounded-full border border-card" style={{ backgroundColor: theme.primary }} />
                    <span className="w-4 h-4 rounded-full border border-card" style={{ backgroundColor: theme.accent }} />
                    <span className="w-4 h-4 rounded-full border border-card" style={{ backgroundColor: theme.sidebar }} />
                  </div>
                  <span className="text-xs font-medium text-foreground">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Preview Widget */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Sidebar Preview</h3>
            <div className="rounded-xl border border-border overflow-hidden bg-background">
              {/* Header mockup */}
              <div className="h-10 bg-card border-b border-border flex items-center px-3 justify-end gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="w-4 h-4 rounded-full bg-slate-200" />
              </div>
              {/* Sidebar + Body mockup */}
              <div className="flex h-36">
                {/* Mock sidebar */}
                <div
                  style={{ backgroundColor: settings.sidebar_color }}
                  className="w-1/3 p-2 text-white flex flex-col justify-between transition-colors"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                      <PreviewIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[10px] font-bold truncate leading-none">{settings.company_name}</span>
                  </div>
                  <div className="space-y-1 my-2">
                    <div className="h-2.5 rounded bg-white/20" />
                    <div className="h-2.5 rounded bg-white/10" />
                    <div className="h-2.5 rounded bg-white/10" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-white/20" />
                    <div className="h-1.5 w-8 bg-white/10 rounded" />
                  </div>
                </div>
                {/* Mock body */}
                <div className="flex-1 p-3 bg-muted/30 space-y-2">
                  <div className="flex gap-2">
                    <div className="h-8 w-10 bg-card border border-border rounded" />
                    <div className="h-8 w-10 bg-card border border-border rounded" />
                    <div className="h-8 w-10 bg-card border border-border rounded" />
                  </div>
                  <div className="h-12 bg-card border border-border rounded-lg p-2 space-y-1.5">
                    <div className="h-2 bg-slate-200 rounded w-2/3" />
                    <div className="h-1.5 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
