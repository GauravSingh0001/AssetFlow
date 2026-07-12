import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({ children }) {
  const { loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const toggleDark = (isDark) => {
    setDark(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Sync theme class on load
  useState(() => {
    const saved = localStorage.getItem('theme') === 'dark';
    if (saved) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  const applyColors = (settings) => {
    if (!settings) return;
    const doc = document.documentElement;
    if (settings.primary_color) doc.style.setProperty('--primary', settings.primary_color);
    if (settings.accent_color) {
      doc.style.setProperty('--accent', settings.accent_color);
      doc.style.setProperty('--ring', settings.accent_color);
    }
    if (settings.sidebar_color) doc.style.setProperty('--sidebar', settings.sidebar_color);
  };

  const loadSettings = async () => {
    try {
      const res = await api.getSystemSettings();
      if (res.settings) {
        applyColors(res.settings);
        localStorage.setItem('custom_company_name', res.settings.company_name || 'AssetFlow');
        localStorage.setItem('custom_company_logo', res.settings.company_logo || '');
        localStorage.setItem('custom_company_icon', res.settings.company_icon || 'Boxes');
        localStorage.setItem('custom_primary_color', res.settings.primary_color || '#1B3568');
        localStorage.setItem('custom_accent_color', res.settings.accent_color || '#2563EB');
        localStorage.setItem('custom_sidebar_color', res.settings.sidebar_color || '#1B3568');
        // Trigger storage update
        window.dispatchEvent(new Event('storage'));
      }
    } catch (err) {
      console.error('Failed to load system branding settings:', err);
    }
  };

  useEffect(() => {
    loadSettings();

    const handleStorageChange = () => {
      const settings = {
        primary_color: localStorage.getItem('custom_primary_color'),
        accent_color: localStorage.getItem('custom_accent_color'),
        sidebar_color: localStorage.getItem('custom_sidebar_color')
      };
      applyColors(settings);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header dark={dark} setDark={toggleDark} />
          <main className="flex-1 overflow-y-auto p-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-background">
            <div className="max-w-7xl mx-auto space-y-4">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
