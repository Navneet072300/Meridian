import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch, Search, Loader2, Copy, Check,
  Server, Container, Shield, Database, Globe, Lock,
  Zap, Cloud, Package, Settings2, RefreshCw,
  Layers, Sparkles, ArrowRight,
} from 'lucide-react';
import { useStream } from '../../hooks/useStream';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumInput,
  PremiumBadge,
} from '../shared/UIPrimitives';

interface Repo {
  id: number; full_name: string; name: string; description: string;
  private: boolean; language: string; default_branch: string; updated_at: string;
}

interface DetectedService {
  name: string; path: string; language: string; framework: string; port: number;
}

interface ScanResult {
  language: string; framework: string; build_tool: string; port: number;
  app_name: string; default_branch: string; private: boolean;
  has_dockerfile: boolean; has_compose: boolean;
  services: DetectedService[];
}

interface Choices {
  ciTool: string | null;
  cdTool: string | null;
  configTool: string | null;
  environments: string[];
  vault: string | null;
  registry: string | null;
}

interface GeneratedFile { path: string; content: string }

type Step = 'repo' | 'scan' | 'pipeline' | 'generate';

const STEPS: { id: Step; label: string }[] = [
  { id: 'repo',     label: 'Repository' },
  { id: 'scan',     label: 'Scan' },
  { id: 'pipeline', label: 'CI / CD' },
  { id: 'generate', label: 'Generate' },
];

const CI_OPTIONS = [
  { id: 'github-actions', label: 'GitHub Actions', sub: 'Built-in CI for GitHub repos.', badge: 'Recommended', icon: <GitBranch size={20} className="text-purple-400" /> },
  { id: 'gitlab-ci',      label: 'GitLab CI',      sub: 'Built-in GitLab CI pipeline.', icon: <Layers size={20} className="text-amber-400" /> },
  { id: 'jenkins',        label: 'Jenkins',         sub: 'Self-hosted open-source CI/CD.', icon: <Server size={20} className="text-blue-400" /> },
];

const CONFIG_OPTIONS = [
  { id: 'helm',      label: 'Helm',      sub: 'K8s package manager with per-env values files.', badge: 'Recommended', icon: <Package size={20} className="text-indigo-400" /> },
  { id: 'kustomize', label: 'Kustomize', sub: 'Native K8s overlay system with patch-based customization.', icon: <Settings2 size={20} className="text-purple-400" /> },
];

function parsePipelineFiles(raw: string): GeneratedFile[] {
  const map = new Map<string, string>();
  const parts = raw.split(/---\s*FILE:\s*(.+?)\s*---/);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const path = parts[i].trim();
    const content = parts[i + 1].trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '');
    map.set(path, content);
  }
  return Array.from(map.entries()).map(([path, content]) => ({ path, content }));
}

export function DeployMode() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('repo');

  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const [choices, setChoices] = useState<Choices>({
    ciTool: 'github-actions',
    cdTool: 'argocd',
    configTool: 'helm',
    environments: ['dev', 'prod'],
    vault: 'none',
    registry: 'ghcr',
  });

  const [streamText, setStreamText] = useState('');
  const { loading: isStreaming, start: startStream } = useStream('/api/deploy/generate', {
    onChunk: (chunk) => setStreamText((prev) => prev + chunk),
  });

  const generatedFiles = parsePipelineFiles(streamText);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchRepos() {
      try {
        const r = await fetch('/api/repos');
        if (r.ok) {
          const data = await r.json();
          setRepos(data.repos || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingRepos(false);
      }
    }
    fetchRepos();
  }, []);

  const handleScan = async (repo: Repo) => {
    setSelectedRepo(repo);
    setScanning(true);
    setStep('scan');
    try {
      const res = await fetch(`/api/repos/scan?repo=${encodeURIComponent(repo.full_name)}`);
      if (res.ok) {
        const data = await res.json();
        setScanResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const handleGenerate = () => {
    if (!selectedRepo) return;
    setStep('generate');
    setStreamText('');
    startStream({
      repo: selectedRepo.full_name,
      scan: scanResult,
      choices,
    });
  };

  const activeFile = generatedFiles[activeFileIndex] || generatedFiles[0];

  const handleCopyCode = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Zap className="text-purple-500" size={24} />
            Autonomous Deploy Wizard
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Scan Git repositories, detect project frameworks, and generate production CI/CD pipelines.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-6 pb-2">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-xl text-xs font-semibold ${step === s.id ? 'bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300' : 'text-zinc-400'}`}>
                {idx + 1}. {s.label}
              </span>
            </div>
          ))}
        </div>

        {step === 'repo' && (
          <div className="space-y-4">
            <div className="max-w-md">
              <PremiumInput
                icon={<Search size={16} />}
                placeholder="Search repositories to deploy..."
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingRepos ? (
                <div className="col-span-full py-8 text-center text-xs text-zinc-400">Loading GitHub repositories...</div>
              ) : (
                repos
                  .filter((r) => r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
                  .map((repo) => (
                    <GlassCard key={repo.id} className="p-5 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{repo.name}</h3>
                          <PremiumBadge variant={repo.private ? 'warning' : 'info'}>{repo.private ? 'Private' : 'Public'}</PremiumBadge>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{repo.description || 'No description'}</p>
                      </div>
                      <PremiumButton size="sm" variant="primary" onClick={() => handleScan(repo)}>
                        Select Repo
                      </PremiumButton>
                    </GlassCard>
                  ))
              )}
            </div>
          </div>
        )}

        {step === 'scan' && (
          <GlassCard hoverEffect={false} className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{selectedRepo?.full_name}</h3>
                <p className="text-xs text-zinc-400">AI Codebase Analysis</p>
              </div>
              <PremiumButton variant="primary" onClick={() => setStep('pipeline')}>
                Continue to Pipeline Options
              </PremiumButton>
            </div>

            {scanning ? (
              <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-purple-500" />
                Scanning repository architecture...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Language', val: scanResult?.language || 'TypeScript' },
                  { label: 'Framework', val: scanResult?.framework || 'Next.js' },
                  { label: 'Dockerfile', val: scanResult?.has_dockerfile ? 'Detected' : 'Will Generate' },
                  { label: 'Port', val: scanResult?.port || 3000 },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{s.label}</span>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1">{s.val}</p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {step === 'pipeline' && (
          <GlassCard hoverEffect={false} className="p-6 space-y-6">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Select CI/CD Tools</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CI_OPTIONS.map((ci) => (
                <div
                  key={ci.id}
                  onClick={() => setChoices({ ...choices, ciTool: ci.id })}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    choices.ciTool === ci.id
                      ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-300'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {ci.icon}
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{ci.label}</h4>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">{ci.sub}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <PremiumButton variant="primary" onClick={handleGenerate} icon={<Sparkles size={16} />}>
                Generate CI/CD Pipeline
              </PremiumButton>
            </div>
          </GlassCard>
        )}

        {step === 'generate' && (
          <GlassCard hoverEffect={false} className="p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div className="h-10 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-3">
              <div className="flex items-center gap-1">
                {generatedFiles.map((file, idx) => (
                  <button
                    key={file.path}
                    onClick={() => setActiveFileIndex(idx)}
                    className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg ${
                      activeFileIndex === idx ? 'bg-white dark:bg-zinc-800 text-purple-500' : 'text-zinc-500'
                    }`}
                  >
                    {file.path}
                  </button>
                ))}
              </div>
              <PremiumButton size="sm" variant="ghost" onClick={handleCopyCode} icon={copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}>
                {copied ? 'Copied' : 'Copy'}
              </PremiumButton>
            </div>
            <div className="p-4 bg-zinc-950 font-mono text-xs text-zinc-100 min-h-[300px]">
              <pre>{activeFile?.content || 'Streaming generated CI/CD workflow code...'}</pre>
            </div>
          </GlassCard>
        )}
      </div>
    </PageContainer>
  );
}
