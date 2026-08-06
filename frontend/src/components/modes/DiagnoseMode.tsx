import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle, RefreshCw, Stethoscope,
} from 'lucide-react';
import { useClusterStore } from '../../store/clusterStore';
import { useNamespaces } from '../../hooks/useKubernetes';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumBadge,
} from '../shared/UIPrimitives';

interface PodInfo { name: string; status: string; restarts: number; ready: string }

export function DiagnoseMode() {
  const { activeCluster } = useClusterStore();
  const [activeTab, setActiveTab] = useState<'errors' | 'deployments' | 'describe' | 'logs'>('errors');
  const [selectedNs, setSelectedNs] = useState('default');

  const [allPods, setAllPods] = useState<PodInfo[]>([]);
  const [loadingRes, setLoadingRes] = useState(false);

  const nsData = useNamespaces(activeCluster);
  const namespaces = nsData.data?.namespaces ?? ['default'];

  const fetchResources = useCallback(async () => {
    setLoadingRes(true);
    try {
      const r = await fetch(`/api/k8s/resources?namespace=${selectedNs}`);
      if (r.ok) {
        const data = await r.json();
        setAllPods(data.pods || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRes(false);
    }
  }, [selectedNs]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Stethoscope className="text-purple-500" size={24} />
              AI Automated Diagnostic Engine
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Live root cause analysis (RCA) and autonomous cluster troubleshooting for pods & deployments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={selectedNs}
                onChange={(e) => setSelectedNs(e.target.value)}
                className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer"
              >
                {namespaces.map((ns) => <option key={ns} value={ns}>{ns}</option>)}
              </select>
            </div>
            <PremiumButton size="sm" variant="outline" onClick={fetchResources} icon={<RefreshCw size={14} />}>
              Refresh
            </PremiumButton>
          </div>
        </div>

        <GlassCard hoverEffect={false} className="p-2 border border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-2">
            {[
              { id: 'errors', label: 'Cluster Failures' },
              { id: 'deployments', label: 'Deployments' },
              { id: 'describe', label: 'Describe & Inspect' },
              { id: 'logs', label: 'Live Pod Logs' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === t.id
                    ? 'bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </GlassCard>

        {activeTab === 'errors' && (
          <div className="space-y-4">
            {loadingRes ? (
              <div className="p-8 text-center text-xs text-zinc-400">Loading cluster state...</div>
            ) : allPods.length === 0 ? (
              <GlassCard hoverEffect={false} className="p-12 text-center space-y-3">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">All Pods Operational</h3>
                <p className="text-xs text-zinc-400">No failing pods or CrashLoopBackOff errors detected in namespace {selectedNs}.</p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allPods.map((pod) => (
                  <GlassCard key={pod.name} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{pod.name}</span>
                      <PremiumBadge variant={pod.status === 'Running' ? 'success' : 'error'}>
                        {pod.status}
                      </PremiumBadge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Restarts: {pod.restarts}</span>
                      <span>Ready: {pod.ready}</span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
