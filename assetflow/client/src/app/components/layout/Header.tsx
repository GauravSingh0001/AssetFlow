import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { Search, Bell, Moon, Sun } from 'lucide-react';

const ROUTE_META = {
  '/': { title: 'Dashboard', sub: 'Overview of assets, utilization, and operations' },
  '/organization': { title: 'Organization Setup', sub: 'Manage departments, categories, and employees' },
  '/assets': { title: 'Asset Directory', sub: 'Search, filter, and manage the full asset registry' },
  '/allocation': { title: 'Allocation & Transfer', sub: 'Assign assets and manage transfer requests' },
  '/booking': { title: 'Resource Booking', sub: 'Schedule and manage shared resource reservations' },
  '/maintenance': { title: 'Maintenance', sub: 'Track and manage maintenance requests' },
  '/audit': { title: 'Asset Audit', sub: 'Conduct audits and resolve discrepancies' },
  '/reports': { title: 'Reports & Analytics', sub: 'View utilization trends and export data' },
  '/notifications': { title: 'Notifications & Activity', sub: 'View alerts and audit trail' },
};

export default function Header({ dark, setDark }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  const meta = ROUTE_META[location.pathname] || { title: 'AssetFlow', sub: '' };
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';

  useEffect(() => {
    api.getNotifications(true).then(d => setUnreadCount(d.unreadCount)).catch(() => {});
  }, [location.pathname]);

  return (
    <header className="h-16 flex-shrink-0 bg-card border-b border-border flex items-center px-6 gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-semibold text-foreground leading-none">{meta.title}</h1>
        <p className="text-xs text-muted-foreground mt-1 leading-none truncate">{meta.sub}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setDark(!dark)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted hover:scale-105 hover:rotate-12 active:scale-95 transition-all duration-300"
        >
          {dark ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
        </button>
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground ml-1">
          {initials}
        </div>
      </div>
    </header>
  );
}
