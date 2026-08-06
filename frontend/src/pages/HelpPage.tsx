import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle, Zap, Terminal, GitBranch, Activity, Layout, Map,
  Keyboard, ChevronRight, ExternalLink, Search,
  Bug, Lightbulb, BookOpen, Loader2, ArrowRight, Stethoscope,
  LayoutDashboard, Server, Check, Copy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumInput,
  PremiumBadge,
} from '../components/shared/UIPrimitives';

const FAQS = [
  { q: 'How do I connect my Kubernetes cluster?', a: 'Go to Platforms (sidebar) → Add Kubernetes Cluster. Enter the cluster name, environment, API server URL, and a bearer token with read access to pods and deployments.' },
  { q: 'Cluster connection status shows error or offline', a: 'Check that your API server URL is accessible and the bearer token has not expired. The service account requires get, list, watch permissions on pods and deployments.' },
  { q: 'AI generation output is taking time', a: 'Complex infrastructure generation with multi-file YAML manifests can take 15–30 seconds. Streamed code outputs will appear dynamically in the code editor.' },
  { q: 'Where do I find generated pipeline files?', a: 'In Deploy mode, once generation completes, you can download a full ZIP archive of all GitHub Actions workflows, Helm values, and Dockerfiles.' },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredFaqs = FAQS.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center mx-auto">
            <HelpCircle size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Documentation & Support Center
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Learn how to automate deployment pipelines, troubleshoot cluster issues, and manage secret vaults.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto">
          <PremiumInput
            icon={<Search size={16} />}
            placeholder="Search documentation and troubleshooting guides..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Quick Start Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {[
            { title: 'Connect Cluster', desc: 'Add K8s API server token', path: '/app/platforms', icon: <Server size={18} className="text-blue-500" /> },
            { title: 'Deploy App', desc: 'Git push to live URL', path: '/app/deploy', icon: <Zap size={18} className="text-purple-500" /> },
            { title: 'Diagnose Pods', desc: 'AI root cause analysis', path: '/app/diagnose', icon: <Stethoscope size={18} className="text-amber-500" /> },
          ].map((item) => (
            <GlassCard key={item.title} onClick={() => navigate(item.path)} className="p-5 space-y-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                  <p className="text-[11px] text-zinc-400">{item.desc}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* FAQ Accordions */}
        <GlassCard hoverEffect={false} className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 py-1"
                  >
                    <span>{faq.q}</span>
                    <ChevronRight size={16} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {isOpen && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed pl-1">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </PageContainer>
  );
}
