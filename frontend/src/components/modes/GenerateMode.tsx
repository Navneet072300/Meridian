import React, { useState, useMemo } from 'react';
import {
  Sparkles, Code, Download, Copy, Check, Terminal,
} from 'lucide-react';
import { zipSync, strToU8 } from 'fflate';
import { useStream } from '../../hooks/useStream';
import type { GeneratedFile } from '../../types';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
} from '../shared/UIPrimitives';

const TOOLS = [
  'Terraform', 'Kubernetes', 'Ansible', 'CDK', 'Pulumi',
  'Docker', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'Helm',
  'ArgoCD', 'Nginx', 'Prometheus',
];

const CONTEXT_PILLS = [
  'AWS', 'Azure', 'GCP',
  'Docker Compose', 'Kubernetes', 'Terraform',
  'High Availability', 'Multi-AZ',
  'CI/CD', 'Monitoring',
];

function inferLanguage(filename: string): GeneratedFile['language'] {
  const lower = filename.toLowerCase();
  const base = lower.split('/').pop() ?? lower;
  const ext = base.includes('.') ? base.split('.').pop()! : '';
  const extMap: Record<string, GeneratedFile['language']> = {
    tf: 'hcl', hcl: 'hcl', yaml: 'yaml', yml: 'yaml', json: 'json', md: 'markdown', sh: 'bash', bash: 'bash',
  };
  return extMap[ext] ?? 'bash';
}

function parseLlmFiles(raw: string): GeneratedFile[] {
  const map = new Map<string, GeneratedFile>();
  const parts = raw.split(/---\s*FILE:\s*(.+?)\s*---/);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const filename = parts[i].trim();
    const content = parts[i + 1].trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '');
    map.set(filename, { path: filename, content, language: inferLanguage(filename) });
  }
  if (map.size === 0 && raw.trim()) {
    map.set('main.tf', { path: 'main.tf', content: raw.trim(), language: 'hcl' });
  }
  return Array.from(map.values());
}

export function GenerateMode() {
  const [prompt, setPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['Kubernetes', 'Helm']);
  const [selectedContext, setSelectedContext] = useState<string[]>(['AWS']);
  const [streamText, setStreamText] = useState('');

  const { loading: isStreaming, start: startStream } = useStream('/api/generate', {
    onChunk: (chunk) => setStreamText((prev) => prev + chunk),
  });

  const files = useMemo(() => parseLlmFiles(streamText), [streamText]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const activeFile = files[activeFileIndex] || files[0];

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const toggleContext = (ctx: string) => {
    setSelectedContext((prev) =>
      prev.includes(ctx) ? prev.filter((c) => c !== ctx) : [...prev, ctx]
    );
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setStreamText('');
    setActiveFileIndex(0);
    startStream({
      prompt,
      tools: selectedTools,
      context: selectedContext,
    });
  };

  const handleDownloadZip = () => {
    if (files.length === 0) return;
    const zipData: Record<string, Uint8Array> = {};
    files.forEach((f) => {
      zipData[f.path] = strToU8(f.content);
    });
    const zipped = zipSync(zipData);
    const blob = new Blob([zipped], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'infrastructure-manifests.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

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
            <Terminal className="text-purple-500" size={24} />
            AI Code & Manifest Generator
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Describe your infrastructure requirements — AI streams multi-file Terraform, Kubernetes YAML, and Helm manifests.
          </p>
        </div>

        <GlassCard glow className="p-6 space-y-4 border border-purple-500/20">
          <div className="space-y-2">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Create a production HA Kubernetes manifest for a Spring Boot microservice with HPA, PDB, ingress TLS, and Prometheus metrics scraping."
              className="w-full p-4 text-sm font-sans rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Toolchain & Provider Pills
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TOOLS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTool(t)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                    selectedTools.includes(t)
                      ? 'bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300'
                      : 'border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <PremiumButton
              onClick={handleGenerate}
              isLoading={isStreaming}
              disabled={!prompt.trim()}
              variant="primary"
              icon={<Sparkles size={16} />}
            >
              Generate Code & Manifests
            </PremiumButton>
          </div>
        </GlassCard>

        {files.length > 0 && (
          <GlassCard hoverEffect={false} className="p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div className="h-10 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-3">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {files.map((file, i) => (
                  <button
                    key={file.path}
                    onClick={() => setActiveFileIndex(i)}
                    className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg flex items-center gap-2 transition-colors ${
                      activeFileIndex === i
                        ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-300 border border-zinc-200 dark:border-zinc-700'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Code size={13} />
                    {file.path}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <PremiumButton size="sm" variant="ghost" onClick={handleCopyCode} icon={copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}>
                  {copied ? 'Copied' : 'Copy'}
                </PremiumButton>
                <PremiumButton size="sm" variant="outline" onClick={handleDownloadZip} icon={<Download size={14} />}>
                  Export ZIP
                </PremiumButton>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 font-mono text-xs text-zinc-100 overflow-x-auto min-h-[300px]">
              <pre>{activeFile?.content || 'Generating content...'}</pre>
            </div>
          </GlassCard>
        )}
      </div>
    </PageContainer>
  );
}
