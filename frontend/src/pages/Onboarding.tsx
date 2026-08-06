import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Plus, Trash2, Sparkles, ArrowRight, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsBuilder } from '../hooks/useTerminology';
import { GlassCard, PremiumButton, PremiumInput, PremiumBadge, Spotlight } from '../components/shared/UIPrimitives';

const PLATFORMS = {
  cloud: [
    { id: 'aws', label: 'AWS', icon: '☁️', desc: 'Amazon Web Services' },
    { id: 'azure', label: 'Azure', icon: '⚡', desc: 'Microsoft Azure' },
    { id: 'gcp', label: 'GCP', icon: '🌐', desc: 'Google Cloud Platform' },
    { id: 'bare-metal', label: 'Bare Metal', icon: '🖥️', desc: 'Physical servers' },
    { id: 'vmware', label: 'On-Prem VMware', icon: '📦', desc: 'VMware vSphere' },
  ],
  cicd: [
    { id: 'github-actions', label: 'GitHub Actions', icon: '⚙️', desc: 'Native GitHub CI/CD' },
    { id: 'gitlab-ci', label: 'GitLab CI', icon: '🦊', desc: 'GitLab pipelines' },
    { id: 'jenkins', label: 'Jenkins', icon: '🤖', desc: 'Self-hosted CI' },
    { id: 'tekton', label: 'Tekton', icon: '🔧', desc: 'Kubernetes-native CI' },
    { id: 'drone', label: 'Drone CI', icon: '🚁', desc: 'Container-native CI' },
  ],
  gitops: [
    { id: 'argocd', label: 'ArgoCD', icon: '🐙', desc: 'Kubernetes GitOps' },
    { id: 'flux', label: 'Flux', icon: '🌊', desc: 'GitOps toolkit' },
    { id: 'none', label: 'None (direct kubectl)', icon: '⚓', desc: 'Direct cluster apply' },
  ],
  secrets: [
    { id: 'vault', label: 'HashiCorp Vault', icon: '🔐', desc: 'Dynamic secrets' },
    { id: 'aws-sm', label: 'AWS Secrets Manager', icon: '🔑', desc: 'AWS native' },
    { id: 'azure-kv', label: 'Azure Key Vault', icon: '🗝️', desc: 'Azure native' },
    { id: 'gcp-sm', label: 'GCP Secret Manager', icon: '🔒', desc: 'GCP native' },
    { id: 'k8s', label: 'Kubernetes Secrets', icon: '☸️', desc: 'Native K8s secrets' },
  ],
  monitoring: [
    { id: 'grafana', label: 'Grafana + Prometheus', icon: '📊', desc: 'Open-source stack' },
    { id: 'elk', label: 'ELK Stack', icon: '🦌', desc: 'Elastic logging' },
    { id: 'datadog', label: 'Datadog', icon: '🐕', desc: 'SaaS monitoring' },
    { id: 'newrelic', label: 'New Relic', icon: '📡', desc: 'SaaS observability' },
    { id: 'none', label: 'None', icon: '—', desc: 'Skip for now' },
  ],
  registry: [
    { id: 'ghcr', label: 'GHCR', icon: '🐙', desc: 'GitHub Container Registry' },
    { id: 'dockerhub', label: 'Docker Hub', icon: '🐳', desc: 'Docker official' },
    { id: 'ecr', label: 'AWS ECR', icon: '☁️', desc: 'Amazon ECR' },
    { id: 'acr', label: 'Azure ACR', icon: '⚡', desc: 'Azure Container Registry' },
    { id: 'gcr', label: 'GCP GCR', icon: '🌐', desc: 'Google Container Registry' },
    { id: 'self-hosted', label: 'Self-hosted', icon: '🖥️', desc: 'Harbor, Nexus, etc.' },
  ],
  cdn: [
    { id: 'cloudflare', label: 'Cloudflare', icon: '🌩️', desc: 'CDN + DNS + DDoS' },
    { id: 'route53', label: 'AWS Route53', icon: '🛣️', desc: 'AWS DNS' },
    { id: 'azure-dns', label: 'Azure DNS', icon: '🌐', desc: 'Azure DNS zones' },
    { id: 'none', label: 'None', icon: '—', desc: 'Skip for now' },
  ],
};

type SelectionKey = keyof typeof PLATFORMS;

function SelectionGroup({
  title, items, selected, onToggle,
}: {
  title: string;
  items: { id: string; label: string; icon: string; desc: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = selected.includes(item.id);
          return (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onToggle(item.id)}
              title={item.desc}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                active
                  ? 'bg-purple-500/15 border-purple-500 text-purple-700 dark:text-purple-300 shadow-md shadow-purple-500/10'
                  : 'bg-zinc-100/80 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {active && <CheckCircle2 size={13} className="text-purple-500 ml-1" />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

interface ClusterForm {
  name: string;
  environment: 'dev' | 'staging' | 'prod';
  connection_type: 'token' | 'kubeconfig';
  api_url: string;
  token: string;
  kubeconfig: string;
  testStatus: 'idle' | 'testing' | 'ok' | 'error';
  testMessage: string;
}

function ClusterCard({
  cluster, index, onChange, onRemove,
}: {
  cluster: ClusterForm;
  index: number;
  onChange: (c: ClusterForm) => void;
  onRemove: () => void;
}) {
  const isBuilder = useIsBuilder();
  const testConnection = async () => {
    onChange({ ...cluster, testStatus: 'testing', testMessage: '' });
    try {
      const res = await fetch('/api/platform/test-cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cluster.name || 'test',
          environment: cluster.environment,
          connection_type: cluster.connection_type,
          api_url: cluster.api_url,
          token: cluster.token,
          kubeconfig: cluster.kubeconfig,
          active: false,
        }),
      });
      const data = await res.json() as { healthy: boolean; node_count?: number; version?: string; error?: string };
      if (data.healthy) {
        onChange({
          ...cluster, testStatus: 'ok',
          testMessage: `Connected — ${data.node_count ?? '?'} nodes, Kubernetes ${data.version ?? ''}`,
        });
      } else {
        onChange({ ...cluster, testStatus: 'error', testMessage: data.error || 'Connection failed' });
      }
    } catch (e) {
      onChange({ ...cluster, testStatus: 'error', testMessage: String(e) });
    }
  };

  return (
    <GlassCard hoverEffect={false} className="p-5 space-y-4 mb-4 border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Server size={16} className="text-purple-500" />
          Cluster {index + 1}
        </span>
        {index > 0 && (
          <button onClick={onRemove} className="text-rose-500 hover:text-rose-600 p-1">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PremiumInput
          label="Cluster Name"
          value={cluster.name}
          onChange={(e) => onChange({ ...cluster, name: e.target.value })}
          placeholder="e.g. dev-aks"
        />
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Environment
          </label>
          <select
            value={cluster.environment}
            onChange={(e) => onChange({ ...cluster, environment: e.target.value as any })}
            className="w-full h-10 px-3.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          >
            <option value="dev">Development</option>
            <option value="staging">Staging</option>
            <option value="prod">Production</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {(['token', 'kubeconfig'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ ...cluster, connection_type: t })}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              cluster.connection_type === t
                ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-300'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {t === 'token' ? (isBuilder ? 'Server access key' : 'Bearer Token + API URL') : (isBuilder ? 'Server connection file' : 'Kubeconfig paste')}
          </button>
        ))}
      </div>

      {cluster.connection_type === 'token' ? (
        <div className="space-y-3">
          <PremiumInput
            label={isBuilder ? "Your server's address" : 'API Server URL'}
            value={cluster.api_url}
            onChange={(e) => onChange({ ...cluster, api_url: e.target.value })}
            placeholder={isBuilder ? 'https://1.2.3.4' : 'https://kubernetes.example.com:6443'}
          />
          <PremiumInput
            type="password"
            label={isBuilder ? 'Server access key' : 'Bearer Token'}
            value={cluster.token}
            onChange={(e) => onChange({ ...cluster, token: e.target.value })}
            placeholder="eyJhbGci..."
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {isBuilder ? 'Paste your server connection file' : 'Kubeconfig'}
          </label>
          <textarea
            rows={5}
            value={cluster.kubeconfig}
            onChange={(e) => onChange({ ...cluster, kubeconfig: e.target.value })}
            placeholder="Paste your kubeconfig YAML here..."
            className="w-full p-3 text-xs font-mono rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <PremiumButton
          size="sm"
          variant="secondary"
          onClick={testConnection}
          isLoading={cluster.testStatus === 'testing'}
        >
          Test Connection
        </PremiumButton>
        {cluster.testStatus === 'ok' && <span className="text-xs font-semibold text-emerald-500">✓ {cluster.testMessage}</span>}
        {cluster.testStatus === 'error' && <span className="text-xs font-semibold text-rose-500">✗ {cluster.testMessage}</span>}
      </div>
    </GlassCard>
  );
}

function GitHubCredentials({ value, onChange }: { value: { username: string; pat: string; status: string; msg: string }; onChange: (v: typeof value) => void }) {
  const test = async () => {
    onChange({ ...value, status: 'testing' });
    const res = await fetch('/api/platform/test-github', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pat: value.pat, username: value.username }) });
    const d = await res.json() as { success: boolean; username?: string; error?: string };
    onChange({ ...value, status: d.success ? 'ok' : 'error', msg: d.success ? `Connected as ${d.username}` : d.error || 'auth failed' });
  };
  return (
    <GlassCard hoverEffect={false} className="p-5 space-y-4 mb-4">
      <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
        🐙 GitHub Integration
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PremiumInput
          label="Username"
          value={value.username}
          onChange={(e) => onChange({ ...value, username: e.target.value })}
          placeholder="octocat"
        />
        <PremiumInput
          type="password"
          label="Personal Access Token"
          value={value.pat}
          onChange={(e) => onChange({ ...value, pat: e.target.value })}
          placeholder="ghp_..."
        />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <PremiumButton size="sm" variant="secondary" onClick={test} isLoading={value.status === 'testing'}>
          Test Connection
        </PremiumButton>
        {value.status === 'ok' && <span className="text-xs font-semibold text-emerald-500">✓ {value.msg}</span>}
        {value.status === 'error' && <span className="text-xs font-semibold text-rose-500">✗ {value.msg}</span>}
      </div>
    </GlassCard>
  );
}

const EMPTY_CLUSTER: ClusterForm = {
  name: '', environment: 'dev', connection_type: 'token',
  api_url: '', token: '', kubeconfig: '',
  testStatus: 'idle', testMessage: '',
};

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [selections, setSelections] = useState<Record<SelectionKey, string[]>>({
    cloud: ['aws'], cicd: ['github-actions'], gitops: ['argocd'],
    secrets: ['vault'], monitoring: ['grafana'], registry: ['ghcr'], cdn: ['cloudflare'],
  });

  const toggleSelection = (key: SelectionKey, id: string) => {
    setSelections((prev) => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter((x) => x !== id) : [...prev[key], id],
    }));
  };

  const [clusters, setClusters] = useState<ClusterForm[]>([{ ...EMPTY_CLUSTER }]);
  const [github, setGithub] = useState({ username: '', pat: '', status: 'idle', msg: '' });

  const canProceed = () => {
    if (step === 2) return clusters.some((c) => c.name.trim());
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await fetch('/api/platform/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusters: clusters
            .filter((c) => c.name.trim())
            .map((c, i) => ({
              name: c.name, environment: c.environment,
              connection_type: c.connection_type,
              api_url: c.api_url, token: c.token,
              kubeconfig: c.kubeconfig, active: i === 0,
            })),
          github: github.username ? { username: github.username, pat: github.pat } : undefined,
          selected_platforms: Object.values(selections).flat(),
        }),
      });
      navigate('/app');
    } finally {
      setSaving(false);
    }
  };

  const STEPS = ['Platforms', 'Clusters', 'Credentials', 'Ready'];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans select-none">
      <Spotlight fill="rgba(139, 92, 246, 0.25)" />

      <div className="w-full max-w-3xl space-y-8 relative z-10">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-xl shadow-purple-500/30">
            M
          </div>
          <span className="text-xl font-bold tracking-tight text-white">InfraPilot Setup</span>
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-6">
          {STEPS.map((label, i) => {
            const num = i + 1;
            const done = step > num;
            const active = step === num;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : active
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-400/40'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                    }`}
                  >
                    {done ? '✓' : num}
                  </div>
                  <span className={`text-[11px] font-semibold ${active ? 'text-purple-400' : 'text-zinc-500'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 sm:w-16 h-[2px] mb-4 ${done ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
                )}
              </div>
            );
          })}
        </div>

        <GlassCard glow className="p-6 sm:p-8 space-y-6 border border-white/10 dark:border-white/10">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin"
            >
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">What are you working with?</h2>
                    <p className="text-xs text-zinc-400 mt-1">Select everything in your stack — InfraPilot tailors its AI workflows accordingly.</p>
                  </div>
                  {(Object.entries(PLATFORMS) as [SelectionKey, typeof PLATFORMS.cloud][]).map(([key, items]) => (
                    <SelectionGroup key={key} title={key.toUpperCase()} items={items} selected={selections[key]} onToggle={(id) => toggleSelection(key, id)} />
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Connect your clusters</h2>
                    <p className="text-xs text-zinc-400 mt-1">Add at least one Kubernetes cluster endpoint. You can add more later in Settings.</p>
                  </div>
                  {clusters.map((c, i) => (
                    <ClusterCard key={i} cluster={c} index={i} onChange={(updated) => setClusters((prev) => prev.map((x, j) => j === i ? updated : x))} onRemove={() => setClusters((prev) => prev.filter((_, j) => j !== i))} />
                  ))}
                  <PremiumButton
                    variant="outline"
                    size="sm"
                    icon={<Plus size={14} />}
                    onClick={() => setClusters((prev) => [...prev, { ...EMPTY_CLUSTER }])}
                  >
                    Add another cluster
                  </PremiumButton>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Connect your platforms</h2>
                    <p className="text-xs text-zinc-400 mt-1">Enter credentials for the tools you selected. Stubbed integrations are pre-configured.</p>
                  </div>
                  {selections.cicd.includes('github-actions') && (
                    <GitHubCredentials value={github} onChange={setGithub} />
                  )}
                  {selections.secrets.includes('vault') && (
                    <GlassCard hoverEffect={false} className="p-4 space-y-1 border border-amber-500/20 bg-amber-500/10">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">🔐 HashiCorp Vault</span>
                        <PremiumBadge variant="warning">STUBBED</PremiumBadge>
                      </div>
                      <p className="text-xs text-amber-300">Vault integration is stubbed for demo simulation.</p>
                    </GlassCard>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">You're all set! 🎉</h2>
                    <p className="text-xs text-zinc-400 mt-1">Review your cluster connections below before launching.</p>
                  </div>
                  <div className="space-y-3">
                    {clusters.filter((c) => c.name).map((c) => (
                      <div key={c.name} className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className={c.testStatus === 'ok' ? 'text-emerald-500' : 'text-amber-500'} />
                          <span className="font-semibold text-white">{c.name}</span>
                          <span className="text-zinc-500">({c.environment})</span>
                        </div>
                        <span className={`font-semibold ${c.testStatus === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {c.testStatus === 'ok' ? 'Connected' : 'Pending First Check'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <PremiumButton
              variant="ghost"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Back
            </PremiumButton>
            {step < 4 ? (
              <PremiumButton
                variant="primary"
                disabled={!canProceed()}
                onClick={() => setStep((s) => s + 1)}
                icon={<ArrowRight size={16} />}
              >
                Continue
              </PremiumButton>
            ) : (
              <PremiumButton
                variant="primary"
                isLoading={saving}
                onClick={handleFinish}
                icon={<Sparkles size={16} />}
              >
                Launch InfraPilot
              </PremiumButton>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
