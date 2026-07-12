import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../lib/api';
import {
  LayoutDashboard, Package, Building2, ArrowLeftRight, CalendarDays,
  Wrench, ClipboardCheck, BarChart3, Bell, Boxes, Settings,
  LogOut, HelpCircle, ChevronLeft, Shield, Cpu, Warehouse,
  Activity, Layers, Globe
} from 'lucide-react';

const BRAND_ICONS = {
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

const getNavItems = (role) => {
  const items = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  ];
  if (role === 'Admin') {
    items.push({ path: '/organization', label: 'Organization Setup', icon: Building2 });
  }
  items.push(
    { path: '/assets', label: 'Assets', icon: Package },
    { path: '/allocation', label: 'Allocation & Transfer', icon: ArrowLeftRight },
    { path: '/booking', label: 'Resource Booking', icon: CalendarDays },
    { path: '/maintenance', label: 'Maintenance', icon: Wrench },
    { path: '/audit', label: 'Audit', icon: ClipboardCheck },
    { path: '/reports', label: 'Reports', icon: BarChart3 },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/settings', label: 'Settings', icon: Settings }
  );
  return items;
};

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [branding, setBranding] = useState({
    name: localStorage.getItem('custom_company_name') || 'AssetFlow',
    logo: localStorage.getItem('custom_company_logo') || '',
    icon: localStorage.getItem('custom_company_icon') || 'Boxes'
  });

  useEffect(() => {
    api.getNotifications(true).then(d => setUnreadCount(d.unreadCount)).catch(() => {});
    const interval = setInterval(() => {
      api.getNotifications(true).then(d => setUnreadCount(d.unreadCount)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      setBranding({
        name: localStorage.getItem('custom_company_name') || 'AssetFlow',
        logo: localStorage.getItem('custom_company_logo') || '',
        icon: localStorage.getItem('custom_company_icon') || 'Boxes'
      });
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const navItems = getNavItems(user?.role);
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';
  
  const LogoIcon = BRAND_ICONS[branding.icon] || Boxes;

  return (
    <aside className={`${collapsed ? 'w-[68px]' : 'w-[240px]'} flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300`}>
      {/* Brand */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 overflow-hidden w-full">
          {branding.logo ? (
            <img src={branding.logo} alt="Logo" className="w-9 h-9 object-contain flex-shrink-0 rounded" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <LogoIcon className="w-5 h-5 text-white/80" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white leading-none truncate">{branding.name}</div>
              <div className="text-[10px] text-sidebar-foreground/50 mt-0.5 uppercase tracking-widest leading-none">Enterprise ERM</div>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <ChevronLeft className={`w-3.5 h-3.5 text-sidebar-foreground/60 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <div className="px-2 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">Navigation</span>
          </div>
        )}
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 hover:translate-x-1 active:scale-[0.98] text-left relative ${
                isActive
                  ? 'bg-sidebar-accent text-white font-medium shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white/90'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
              {label === 'Notifications' && unreadCount > 0 && (
                <span className={`${collapsed ? 'absolute top-1 right-1' : 'ml-auto'} min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="w-8 h-8 rounded-full bg-accent/25 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-white truncate">{user?.name}</div>
                <div className="text-[11px] text-sidebar-foreground/50 truncate">
                  {user?.role === 'AssetManager' ? 'Asset Manager' : user?.role === 'DeptHead' ? 'Dept Head' : user?.role}
                </div>
              </div>
              <button onClick={logout} title="Logout"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
                <LogOut className="w-4 h-4 text-sidebar-foreground/40 hover:text-white" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
