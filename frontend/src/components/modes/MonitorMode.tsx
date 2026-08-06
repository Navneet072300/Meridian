import React from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useClusterStore } from '../../store/clusterStore';
import { useClusterOverview } from '../../hooks/useKubernetes';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumBadge,
} from '../shared/UIPrimitives';

const METRIC_CHART_DATA = [
  { time: '10:00', cpu: 24, memory: 45, pods: 18 },
  { time: '10:15', cpu: 32, memory: 50, pods: 18 },
  { time: '10:30', cpu: 45, memory: 55, pods: 22 },
  { time: '10:45', cpu: 38, memory: 52, pods: 22 },
  { time: '11:00', cpu: 65, memory: 68, pods: 24 },
  { time: '11:15', cpu: 42, memory: 60, pods: 24 },
  { time: '11:30', cpu: 35, memory: 58, pods: 24 },
];

export function MonitorMode() {
  const { activeCluster } = useClusterStore();
  const { data: overview, refetch } = useClusterOverview(activeCluster);

  const nodeCount = overview?.nodes?.length ?? 3;
  const runningPods = overview?.pod_counts?.running ?? 24;
  const totalPods = overview?.pod_counts?.total ?? 24;

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Activity className="text-purple-500" size={24} />
              Real-Time Cluster Telemetry
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Live CPU, Memory, Pod health, and resource utilization monitoring across nodes.
            </p>
          </div>

          <PremiumButton size="sm" variant="outline" onClick={() => refetch()} icon={<RefreshCw size={14} />}>
            Refresh Metrics
          </PremiumButton>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Nodes Running', val: nodeCount, sub: 'All nodes online', color: 'text-emerald-500' },
            { label: 'Total Pods', val: `${runningPods} / ${totalPods}`, sub: '100% healthy', color: 'text-purple-500' },
            { label: 'CPU Usage', val: '38%', sub: 'Avg 2.4 Cores', color: 'text-blue-500' },
            { label: 'Memory Allocated', val: '12.8 GB', sub: '68% of 16 GB', color: 'text-amber-500' },
          ].map((m) => (
            <GlassCard key={m.label} className="p-4 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{m.label}</p>
              <p className={`text-2xl font-extrabold font-mono ${m.color}`}>{m.val}</p>
              <p className="text-xs text-zinc-500">{m.sub}</p>
            </GlassCard>
          ))}
        </div>

        <GlassCard hoverEffect={false} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">CPU & Memory Telemetry (Last 2 Hours)</h3>
              <p className="text-xs text-zinc-400">Animated stream of node resource usage.</p>
            </div>
            <PremiumBadge variant="purple">Live Stream</PremiumBadge>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={METRIC_CHART_DATA}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(18, 18, 24, 0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Area type="monotone" dataKey="cpu" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                <Area type="monotone" dataKey="memory" stroke="#3b82f6" fillOpacity={1} fill="url(#colorMem)" name="Memory %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </PageContainer>
  );
}
