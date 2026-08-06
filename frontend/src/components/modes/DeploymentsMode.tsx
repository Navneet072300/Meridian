import React, { useCallback, useEffect, useState } from 'react';
import {
  Rocket, RefreshCw, Trash2, GitBranch,
} from 'lucide-react';
import { toast } from '../../store/toastStore';
import {
  PageContainer,
  GlassCard,
  PremiumBadge,
  SkeletonLoader,
} from '../shared/UIPrimitives';

interface Deployment {
  id: number;
  repo_full_name: string;
  branch: string;
  ci_tool: string;
  deploy_target: string;
  registry: string;
  updated_at: string;
}

interface Run {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  duration_s: number | null;
  html_url: string;
  actor: string;
}

function StatusBadge({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === 'in_progress') return <PremiumBadge variant="warning" pulse>Running</PremiumBadge>;
  if (status === 'queued') return <PremiumBadge variant="purple">Queued</PremiumBadge>;
  if (conclusion === 'success') return <PremiumBadge variant="success">Passed</PremiumBadge>;
  if (conclusion === 'failure') return <PremiumBadge variant="error">Failed</PremiumBadge>;
  if (conclusion === 'cancelled') return <PremiumBadge variant="purple">Cancelled</PremiumBadge>;
  return null;
}

export function DeploymentsMode() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Deployment | null>(null);

  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const loadDeployments = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/deployments', { credentials: 'include' });
      const data = await r.json();
      setDeployments(data.deployments ?? []);
    } catch { toast.error('Failed to load deployments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDeployments(); }, [loadDeployments]);

  const loadRuns = useCallback(async (dep: Deployment) => {
    setRunsLoading(true); setRuns([]);
    try {
      const r = await fetch(`/api/deployments/${dep.id}/runs`, { credentials: 'include' });
      if (!r.ok) throw new Error((await r.json()).detail ?? 'Failed');
      const data = await r.json();
      setRuns(data.runs ?? []);
    } catch { toast.error('Failed to load runs'); }
    finally { setRunsLoading(false); }
  }, []);

  const selectDeployment = (dep: Deployment) => {
    setSelected(dep);
    loadRuns(dep);
  };

  return (
    <PageContainer className="p-0 max-w-full">
      <div className="flex h-[calc(100vh-80px)] overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl">
        <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/40 select-none">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Rocket size={16} className="text-purple-500" />
              Deployments
            </h2>
            <button onClick={loadDeployments} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1">
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => <SkeletonLoader key={i} height="50px" />)}
              </div>
            ) : deployments.length === 0 ? (
              <p className="p-4 text-xs text-zinc-400 text-center">No active deployments</p>
            ) : (
              deployments.map((d) => (
                <div
                  key={d.id}
                  onClick={() => selectDeployment(d)}
                  className={`p-3 rounded-xl cursor-pointer text-xs space-y-1 transition-all ${
                    selected?.id === d.id ? 'bg-purple-500/15 border border-purple-500/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-zinc-100">
                    <span className="truncate">{d.repo_full_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <GitBranch size={12} />
                    <span>{d.branch}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {selected ? (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Workflow Runs for {selected.repo_full_name}</h3>
              {runsLoading ? (
                <SkeletonLoader height="120px" />
              ) : runs.length === 0 ? (
                <p className="text-xs text-zinc-400">No workflow runs found.</p>
              ) : (
                <div className="space-y-2">
                  {runs.map((r) => (
                    <GlassCard key={r.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{r.name}</p>
                        <p className="text-xs text-zinc-400">{r.head_branch} ({r.head_sha.slice(0, 7)})</p>
                      </div>
                      <StatusBadge status={r.status} conclusion={r.conclusion} />
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-zinc-400">
              Select a deployment from the left sidebar to view active workflow runs.
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
