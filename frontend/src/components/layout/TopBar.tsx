import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Home, Zap, Search, Activity } from 'lucide-react';
import { ClusterToggle } from '../shared/ClusterToggle';
import { useClusterStore } from '../../store/clusterStore';
import { useNamespaces } from '../../hooks/useKubernetes';
import { NotificationBell, NotificationPanel } from './NotificationPanel';
import { UserMenu } from './UserMenu';
import { useAuthStore } from '../../store/authStore';
import { useQuery } from '@tanstack/react-query';

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

async function fetchUsage() {
  const r = await fetch('/api/subscription/usage', { credentials: 'include' });
  if (!r.ok) return null;
  return r.json();
}

function FreeUsageChip() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['usage'], queryFn: fetchUsage, refetchInterval: 60_000, retry: false });

  const used = data?.ai_requests?.used ?? 0;
  const limit = 50;
  const remaining = Math.max(0, limit - used);
  const pct = (used / limit) * 100;
  const colorClass = pct >= 90 ? 'text-rose-500 bg-rose-500' : pct >= 70 ? 'text-amber-500 bg-amber-500' : 'text-emerald-500 bg-emerald-500';

  return (
    <button
      type="button"
      title={`${remaining} AI requests remaining today. Click to upgrade.`}
      onClick={() => navigate('/app/subscription')}
      className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 hover:border-purple-500/40 transition-all flex-shrink-0"
    >
      <Zap size={13} className={colorClass.split(' ')[0]} fill="currentColor" />
      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
        {remaining}<span className="text-zinc-400 font-normal">/{limit} AI</span>
      </span>
      <div className="w-10 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass.split(' ')[1]} transition-all duration-300`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </button>
  );
}

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeCluster, activeNamespace, setActiveNamespace } = useClusterStore();
  const { data: nsData } = useNamespaces(activeCluster);
  const [notifOpen, setNotifOpen] = useState(false);
  const { user } = useAuthStore();
  const isFree = !user?.plan || user.plan === 'free';

  const namespaces = nsData?.namespaces ?? ['default'];
  const pageName = PAGE_NAMES[location.pathname] ?? 'Dashboard';

  return (
    <header className="h-14 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border-b border-zinc-200 dark:border-zinc-800/80 flex items-center px-4 gap-3 flex-shrink-0 z-10 select-none">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate('/app')}
          title="Home"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <Home size={15} />
        </button>
        <span className="text-zinc-300 dark:text-zinc-700 text-xs font-light">/</span>
        <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {pageName}
        </span>
      </div>

      <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />

      {/* Active Cluster Picker */}
      <ClusterToggle />

      {/* Latency / Health Chip */}
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>24ms</span>
      </div>

      <div className="flex-1" />

      {/* Search trigger */}
      <button
        type="button"
        onClick={() => navigate('/app/deploy')}
        className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 hover:border-purple-500/40 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs transition-all w-64 justify-between"
      >
        <div className="flex items-center gap-2">
          <Search size={14} className="text-zinc-400" />
          <span>Search apps, clusters, logs…</span>
        </div>
        <span className="text-[10px] font-mono font-medium text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-300/50 dark:border-zinc-700">
          ⌘K
        </span>
      </button>

      {/* Free usage chip */}
      {isFree && <FreeUsageChip />}

      {/* Namespace dropdown & user menu */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="relative inline-flex items-center">
          <select
            title="Active namespace"
            value={activeNamespace}
            onChange={(e) => setActiveNamespace(e.target.value)}
            className="bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold pl-3 pr-7 py-1.5 rounded-xl cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all"
          >
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 text-zinc-400 pointer-events-none" />
        </div>

        {/* Notifications */}
        <div className="relative">
          <NotificationBell onClick={() => setNotifOpen((o) => !o)} />
          <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
        </div>

        <UserMenu />
      </div>
    </header>
  );
}
