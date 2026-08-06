import React, { useState } from 'react';
import 'reactflow/dist/style.css';
import { Compass, Sparkles } from 'lucide-react';
import { useStream } from '../../hooks/useStream';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
} from '../shared/UIPrimitives';

interface CloudProvider {
  id: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
}

const CLOUD_PROVIDERS: CloudProvider[] = [
  { id: 'aws',            label: 'AWS',               emoji: '☁',  color: '#ff9900', description: 'EC2, EKS, RDS, S3, Lambda…' },
  { id: 'azure',          label: 'Azure',             emoji: '⬡',  color: '#0089d6', description: 'AKS, SQL, Blob, App Service…' },
  { id: 'gcp',            label: 'Google Cloud',      emoji: '◈',  color: '#4285f4', description: 'GKE, CloudSQL, GCS, BigQuery…' },
  { id: 'oracle',         label: 'Oracle Cloud',      emoji: '◉',  color: '#c74634', description: 'OKE, Autonomous DB, OCI…' },
  { id: 'digitalocean',   label: 'DigitalOcean',      emoji: '◎',  color: '#0080ff', description: 'Droplets, DOKS, Managed DB…' },
  { id: 'system',         label: 'System Architecture',emoji: '⬡',  color: '#818cf8', description: 'Generic system / microservices' },
  { id: 'multi_cloud',    label: 'Multi-Cloud',       emoji: '⊕',  color: '#34d399', description: 'Span across cloud providers' },
  { id: 'bare_metal',     label: 'Bare Metal',        emoji: '▣',  color: '#94a3b8', description: 'On-premise / physical servers' },
];

export function DesignMode() {
  const [provider, setProvider] = useState('aws');
  const [requirements, setRequirements] = useState('');

  const { loading: isStreaming, start: startStream } = useStream('/api/design/generate', {});

  const handleGenerate = () => {
    if (!requirements.trim()) return;
    startStream({ provider, requirements });
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Compass className="text-purple-500" size={24} />
              AI Cloud Architecture Designer
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Generate interactive cloud topology diagrams, node connection maps, and cost estimates.
            </p>
          </div>
        </div>

        <GlassCard glow className="p-6 space-y-4 border border-purple-500/20">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Select Cloud Target
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CLOUD_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    provider === p.id
                      ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-300 shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="text-base mr-1.5">{p.emoji}</span>
                  <span className="text-xs font-bold">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              System Requirements & Constraints
            </label>
            <textarea
              rows={3}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="e.g. Multi-region AWS architecture with EKS, RDS PostgreSQL primary/replica, Redis ElastiCache cluster, CloudFront CDN, and WAF protection."
              className="w-full p-4 text-sm font-sans rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <PremiumButton
              onClick={handleGenerate}
              isLoading={isStreaming}
              disabled={!requirements.trim()}
              variant="primary"
              icon={<Sparkles size={16} />}
            >
              Generate Visual Topology
            </PremiumButton>
          </div>
        </GlassCard>

        <GlassCard hoverEffect={false} className="p-4 h-[500px] flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
          <div className="text-center text-zinc-400 space-y-2">
            <Compass size={40} className="mx-auto text-purple-500/40" />
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Interactive Architecture Canvas</p>
            <p className="text-xs max-w-sm">Enter cloud requirements above to render interactive ReactFlow node diagrams.</p>
          </div>
        </GlassCard>
      </div>
    </PageContainer>
  );
}
