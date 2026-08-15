import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Home, Search } from 'lucide-react';
import { ClusterToggle } from '../shared/ClusterToggle';
import { useClusterStore } from '../../store/clusterStore';
import { useNamespaces } from '../../hooks/useKubernetes';
import { NotificationBell, NotificationPanel } from './NotificationPanel';
import { UserMenu } from './UserMenu';

const PAGE_NAMES: Record<string, string> = {
  '/app/deploy':       'Deploy',
  '/app/deployments':  'Deployments',
  '/app/generate':     'Generate AI',
  '/app/diagnose':     'Diagnose',
  '/app/design':       'Architecture Design',
  '/app/monitor':      'Cluster Monitor',
  '/app/platforms':    'Platforms',
  '/app/vault':        'Secrets Vault',
  '/app/resources':    'Resources',
  '/app/history':      'Audit Log & History',
  '/app/settings':     'Settings',
  '/app/profile':      'Profile',
  '/app/subscription': 'Subscription & Billing',
  '/app/help':         'Help & Docs',
  '/app/repos':        'Repositories',
};


export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeCluster, activeNamespace, setActiveNamespace } = useClusterStore();
  const { data: nsData } = useNamespaces(activeCluster);
  const [notifOpen, setNotifOpen] = useState(false);

  const namespaces = nsData?.namespaces ?? ['default'];
  const pageName = PAGE_NAMES[location.pathname] ?? 'Dashboard';

  return (
    <header
      style={{
        height: '48px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '12px',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* LEFT: Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => navigate('/app')}
          title="Home"
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            padding: '4px', borderRadius: 4, display: 'flex', alignItems: 'center',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <Home size={15} />
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: 14, userSelect: 'none', opacity: 0.6 }}>/</span>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{pageName}</span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

      {/* Cluster dropdown */}
      <ClusterToggle />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Quick Search trigger */}
      <button
        type="button"
        onClick={() => navigate('/app/deploy')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-base)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-focus)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        <Search size={13} />
        <span>Search apps, clusters, logs…</span>
        <span style={{ fontSize: '10px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-muted)' }}>
          ⌘K
        </span>
      </button>

      {/* RIGHT: Namespace + icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Namespace dropdown */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            title="Active namespace"
            value={activeNamespace}
            onChange={(e) => setActiveNamespace(e.target.value)}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 500,
              padding: '5px 26px 5px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              appearance: 'none',
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'all 0.15s ease',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        {/* Notification bell */}
        <div style={{ position: 'relative' }}>
          <NotificationBell onClick={() => setNotifOpen((o) => !o)} />
          <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
        </div>

        <UserMenu />
      </div>
    </header>
  );
}
