import React, { useState } from 'react';
import { GitBranch, GitMerge, Server, Shield, Cloud, Globe, CheckCircle2, Search } from 'lucide-react';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumInput,
  PremiumBadge,
} from '../components/shared/UIPrimitives';

const INTEGRATIONS = [
  { id: 'github', name: 'GitHub', desc: 'Repositories, Actions CI/CD, and PR integration.', category: 'Source Control', icon: <GitBranch size={20} className="text-purple-400" /> },
  { id: 'gitlab', name: 'GitLab', desc: 'GitLab CI/CD pipelines and code review.', category: 'Source Control', icon: <GitMerge size={20} className="text-orange-400" /> },
  { id: 'k8s', name: 'Kubernetes', desc: 'Live cluster orchestration, pod metrics, and manifests.', category: 'Infrastructure', icon: <Server size={20} className="text-blue-400" /> },
  { id: 'aws', name: 'AWS EKS & Route53', desc: 'Amazon Web Services cloud resources & DNS.', category: 'Cloud Provider', icon: <Cloud size={20} className="text-amber-400" /> },
  { id: 'gcp', name: 'GCP GKE', desc: 'Google Cloud Platform Kubernetes Engine.', category: 'Cloud Provider', icon: <Globe size={20} className="text-cyan-400" /> },
  { id: 'vault', name: 'HashiCorp Vault', desc: 'Encrypted secrets engine and dynamic tokens.', category: 'Security', icon: <Shield size={20} className="text-emerald-400" /> },
];

export default function PlatformsPage() {
  const [search, setSearch] = useState('');

  const filtered = INTEGRATIONS.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Cloud className="text-purple-500" size={24} />
            Connected Platform Integrations
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage Git providers, cloud platforms, Kubernetes clusters, and secrets engines.
          </p>
        </div>

        <div className="max-w-md">
          <PremiumInput
            icon={<Search size={16} />}
            placeholder="Search platform integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <GlassCard key={item.id} className="p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <PremiumBadge variant="purple">{item.category}</PremiumBadge>
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{item.name}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Active
                </span>
                <PremiumButton size="sm" variant="secondary">
                  Configure
                </PremiumButton>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
