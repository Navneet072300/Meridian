import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Search } from 'lucide-react';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumInput,
  PremiumBadge,
  SkeletonLoader,
} from '../components/shared/UIPrimitives';

interface AuditEntry {
  id: number;
  user_email: string;
  action: string;
  resource: string;
  ip_address: string;
  status: string;
  details: string | null;
  created_at: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
}

const ACTION_FILTERS = [
  { value: '', label: 'All Actions' },
  { value: 'pipeline.run', label: 'Pipeline' },
  { value: 'diagnose', label: 'Diagnose' },
  { value: 'kubectl', label: 'Kubectl' },
  { value: 'login', label: 'Auth' },
];

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function HistoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const LIMIT = 50;

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit-log', page, search, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      if (actionFilter) params.set('action_type', actionFilter);
      const r = await fetch(`/api/audit-log?${params}`);
      if (!r.ok) throw new Error('Failed to load history');
      return r.json();
    },
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Clock className="text-purple-500" size={24} />
            Audit Log & History
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Immutably logged record of all cluster operations, deployments, and security events ({total} entries).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <PremiumInput
              icon={<Search size={16} />}
              placeholder="Filter audit log by action or resource name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setActionFilter(f.value);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  actionFilter === f.value
                    ? 'bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <GlassCard hoverEffect={false} className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Resource Target</th>
                  <th>User / Session</th>
                  <th>Status</th>
                  <th className="text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8">
                      <div className="space-y-2 p-2">
                        {[1, 2, 3, 4].map((i) => <SkeletonLoader key={i} height="40px" />)}
                      </div>
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-xs text-zinc-400">
                      No audit history entries found.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-xs">
                          {entry.action}
                        </span>
                      </td>
                      <td className="text-xs text-zinc-400 font-mono">{entry.resource || '—'}</td>
                      <td className="text-xs text-zinc-500">{entry.user_email}</td>
                      <td>
                        <PremiumBadge variant={entry.status === 'ok' ? 'success' : 'error'}>
                          {entry.status}
                        </PremiumBadge>
                      </td>
                      <td className="text-right text-xs text-zinc-400 font-mono">
                        {timeAgo(entry.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-zinc-400">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <PremiumButton
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </PremiumButton>
              <PremiumButton
                size="sm"
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </PremiumButton>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
