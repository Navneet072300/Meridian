import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Server, RefreshCw } from 'lucide-react';
import { useClusterStore } from '../store/clusterStore';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumBadge,
  SkeletonLoader,
} from '../components/shared/UIPrimitives';

type Tab = 'nodes' | 'pods';

export default function ResourcesPage() {
  const { activeCluster, activeNamespace } = useClusterStore();
  const [tab, setTab] = useState<Tab>('nodes');

  const { data: nodesData, isLoading: loadingNodes, refetch: refetchNodes } = useQuery({
    queryKey: ['nodes', activeCluster],
    queryFn: async () => {
      const clusterParam = activeCluster ?? '';
      const r = await fetch(`/api/k8s/nodes?cluster=${encodeURIComponent(clusterParam)}`);
      return r.json() as Promise<{ nodes: Array<{ name: string; status: string; roles: string[]; version: string; age: string }> }>;
    },
    enabled: !!activeCluster,
  });

  const { data: podsData, isLoading: loadingPods, refetch: refetchPods } = useQuery({
    queryKey: ['pods', activeCluster, activeNamespace],
    queryFn: async () => {
      const clusterParam = activeCluster ?? '';
      const r = await fetch(`/api/k8s/pods?namespace=${activeNamespace}&cluster=${encodeURIComponent(clusterParam)}`);
      return r.json() as Promise<{ pods: Array<{ name: string; status: string; ready: string; restarts: number; age: string; image: string }> }>;
    },
    enabled: !!activeCluster,
  });

  const nodes = nodesData?.nodes || [];
  const pods = podsData?.pods || [];

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Server className="text-purple-500" size={24} />
              Kubernetes Cluster Resources
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Inspect nodes, pods, and cluster events for target cluster {activeCluster || 'default'}.
            </p>
          </div>

          <PremiumButton
            size="sm"
            variant="outline"
            onClick={() => {
              if (tab === 'nodes') refetchNodes();
              else refetchPods();
            }}
            icon={<RefreshCw size={14} />}
          >
            Refresh Data
          </PremiumButton>
        </div>

        <GlassCard hoverEffect={false} className="p-2 border border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-2">
            {[
              { id: 'nodes', label: 'Nodes' },
              { id: 'pods', label: 'Pods' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as Tab)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  tab === t.id
                    ? 'bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard hoverEffect={false} className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'nodes' ? (
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Node Name</th>
                    <th>Status</th>
                    <th>Roles</th>
                    <th>K8s Version</th>
                    <th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingNodes ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8">
                        <div className="space-y-2 p-2">
                          {[1, 2, 3].map((i) => <SkeletonLoader key={i} height="40px" />)}
                        </div>
                      </td>
                    </tr>
                  ) : nodes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-xs text-zinc-400">
                        No node telemetry available.
                      </td>
                    </tr>
                  ) : (
                    nodes.map((n) => (
                      <tr key={n.name}>
                        <td className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-xs">{n.name}</td>
                        <td>
                          <PremiumBadge variant={n.status === 'Ready' ? 'success' : 'error'}>
                            {n.status}
                          </PremiumBadge>
                        </td>
                        <td className="text-xs text-zinc-500">{n.roles?.join(', ') || 'worker'}</td>
                        <td className="font-mono text-xs text-zinc-400">{n.version}</td>
                        <td className="text-xs text-zinc-400">{n.age}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Pod Name</th>
                    <th>Status</th>
                    <th>Ready</th>
                    <th>Restarts</th>
                    <th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPods ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8">
                        <div className="space-y-2 p-2">
                          {[1, 2, 3].map((i) => <SkeletonLoader key={i} height="40px" />)}
                        </div>
                      </td>
                    </tr>
                  ) : pods.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-xs text-zinc-400">
                        No pods found in namespace {activeNamespace}.
                      </td>
                    </tr>
                  ) : (
                    pods.map((p) => (
                      <tr key={p.name}>
                        <td className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-xs">{p.name}</td>
                        <td>
                          <PremiumBadge variant={p.status === 'Running' ? 'success' : 'warning'}>
                            {p.status}
                          </PremiumBadge>
                        </td>
                        <td className="text-xs text-zinc-500">{p.ready}</td>
                        <td className={`text-xs ${p.restarts > 0 ? 'text-rose-500 font-bold' : 'text-zinc-400'}`}>{p.restarts}</td>
                        <td className="text-xs text-zinc-400">{p.age}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </GlassCard>
      </div>
    </PageContainer>
  );
}
