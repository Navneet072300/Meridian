import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Rocket, Stethoscope, ShieldCheck, Bell, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import {
  GlassCard,
  PremiumButton,
  PremiumBadge,
  Spotlight,
  AuroraBackground,
} from '../components/shared/UIPrimitives';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/mo',
    desc: 'Everything you need to get started.',
    features: ['1 cluster', '50 AI requests / day', '3 pipeline runs / day', 'Deploy, Generate, Diagnose', 'Community support', '7-day history'],
    cta: 'Get started free',
    featured: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/mo',
    desc: 'For teams that ship daily.',
    features: ['5 clusters', 'Unlimited AI requests', 'All 5 modes', 'Custom model endpoints', 'API key access', '90-day history'],
    cta: 'Start with Pro',
    featured: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: '$199',
    period: '/mo',
    desc: 'For engineering teams at scale.',
    features: ['15 clusters', '10 seats (RBAC)', 'Vault & ArgoCD integrations', 'Audit log + SSO', 'Slack notifications', '365-day history'],
    cta: 'Start with Team',
    featured: false,
  },
];

const FEATURES = [
  {
    icon: <Rocket size={20} className="text-purple-400" />,
    title: 'Deploy any stack',
    desc: 'Git repo to live URL in one shot. AI generates CI pipelines, K8s manifests, and DNS — then monitors the rollout automatically.',
    tag: 'Spring Boot · FastAPI · Go · Rails · anything',
  },
  {
    icon: <Stethoscope size={20} className="text-emerald-400" />,
    title: 'AI diagnoses failures',
    desc: 'Paste logs or pull live pod data. AI-powered root cause analysis identifies the exact failure with 90%+ confidence.',
    showDiag: true,
  },
  {
    icon: <ShieldCheck size={20} className="text-indigo-400" />,
    title: 'Secrets management',
    desc: 'Per-user AES-256 encrypted vault. Secrets inject into any deployment automatically — no plaintext in CI.',
    tag: 'AES-256 · per-user keys · inject anywhere',
  },
  {
    icon: <Bell size={20} className="text-amber-400" />,
    title: 'Alerts anywhere',
    desc: 'Cluster health delivered to Slack, Teams, Discord, or email. Snooze, acknowledge, and auto-resolve.',
    tag: 'Slack · Teams · Discord · Email · Webhook',
  },
];

function ProductMockup() {
  const bars = [28, 35, 22, 40, 55, 38, 62, 58, 44, 70, 65, 48, 80, 72, 68, 90];
  return (
    <GlassCard glow hoverEffect={false} className="max-w-5xl mx-auto overflow-hidden border border-white/15 dark:border-white/10 shadow-2xl">
      <div className="h-11 bg-zinc-100/90 dark:bg-zinc-950/90 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between px-4">
        <div className="flex gap-2">
          {['#ff5f56', '#febc2e', '#27c93f'].map((c) => (
            <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">infrapilot.dev / monitor</span>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          dev-aks · live
        </div>
      </div>

      <div className="flex flex-col sm:flex-row h-auto sm:h-96">
        <div className="w-full sm:w-48 bg-zinc-50/80 dark:bg-zinc-950/80 border-r border-zinc-200 dark:border-zinc-800/80 p-3 space-y-1">
          {[
            { label: 'Deploy', active: false },
            { label: 'Monitor', active: true },
            { label: 'Diagnose', active: false },
            { label: 'Generate', active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                item.active
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-md ${item.active ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
              {item.label}
            </div>
          ))}
          <div className="h-[1px] bg-zinc-200 dark:bg-zinc-800/80 my-3" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 pb-1">Clusters</p>
          {[
            { label: 'dev-aks', color: 'bg-emerald-500' },
            { label: 'prod-rke2', color: 'bg-amber-500' },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-2 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400">
              <span className={`w-2 h-2 rounded-full ${c.color}`} />
              {c.label}
            </div>
          ))}
        </div>

        <div className="flex-1 p-4 bg-white/50 dark:bg-zinc-900/50 space-y-3 overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Pods running', val: '24/24', sub: 'All healthy', subColor: 'text-emerald-500' },
              { label: 'CPU usage', val: '34%', isBar: true },
              { label: 'Memory', val: '12.4 GB', sub: '77% of 16 GB', subColor: 'text-amber-500' },
              { label: 'Active issues', val: '2', sub: '1 critical', subColor: 'text-rose-500' },
            ].map((m) => (
              <div key={m.label} className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{m.label}</p>
                <p className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">{m.val}</p>
                {m.isBar && (
                  <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
                    <div className="w-1/3 h-full bg-purple-500 rounded-full" />
                  </div>
                )}
                {m.sub && <p className={`text-[10px] font-medium mt-1 ${m.subColor}`}>{m.sub}</p>}
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 shadow-xs">
            <p className="text-xs font-medium text-zinc-400 mb-2">Request rate · last 3h</p>
            <div className="flex items-end gap-1.5 h-10">
              {bars.map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`flex-1 rounded-sm ${i >= 10 ? 'bg-purple-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 overflow-hidden text-xs">
            <div className="grid grid-cols-4 p-2.5 bg-zinc-100/60 dark:bg-zinc-900/60 font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
              <span>Service</span>
              <span>Status</span>
              <span>CPU</span>
              <span>Restarts</span>
            </div>
            {[
              { name: 'backend', dot: 'bg-emerald-500', status: 'Healthy', cpu: '28%', restarts: '0' },
              { name: 'worker', dot: 'bg-amber-500', status: 'Degraded', cpu: '82%', restarts: '3' },
              { name: 'analytics', dot: 'bg-rose-500', status: 'CrashLoop', cpu: '—', restarts: '12' },
            ].map((row) => (
              <div key={row.name} className="grid grid-cols-4 p-2.5 border-t border-zinc-100 dark:border-zinc-800/60 items-center font-medium">
                <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{row.name}</span>
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <span className={`w-2 h-2 rounded-full ${row.dot}`} />
                  {row.status}
                </span>
                <span className="text-zinc-500">{row.cpu}</span>
                <span className={row.restarts !== '0' ? 'text-rose-500 font-bold' : 'text-zinc-400'}>{row.restarts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, setDemoMode } = useAuthStore();
  const loggedIn = isAuthenticated();

  function handleGetStarted() {
    if (loggedIn) navigate('/app');
    else navigate('/signup');
  }

  function handleDemo() {
    setDemoMode(true);
    navigate('/app');
  }

  function handleOpenApp() {
    if (loggedIn) navigate('/app');
    else navigate('/login');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-purple-500 selection:text-white font-sans relative overflow-x-hidden">

      <nav className="h-16 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
            <Rocket size={16} />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">InfraPilot</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#demo" onClick={handleDemo} className="hover:text-white transition-colors">Live Demo</a>
        </div>

        <div className="flex items-center gap-3">
          {!loggedIn && (
            <PremiumButton onClick={() => navigate('/login')} variant="ghost" size="sm">
              Sign in
            </PremiumButton>
          )}
          <PremiumButton onClick={handleOpenApp} variant="primary" size="sm" icon={<Sparkles size={14} />}>
            {loggedIn ? 'Open Dashboard' : 'Get Started'}
          </PremiumButton>
        </div>
      </nav>

      <section className="relative pt-24 pb-16 px-6 lg:px-12 text-center overflow-hidden">
        <Spotlight fill="rgba(168, 85, 247, 0.3)" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto space-y-6 relative z-10"
        >
          <PremiumBadge variant="purple" pulse>
            ✦ Next-Gen AI Infrastructure Engine · Public Beta
          </PremiumBadge>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
            Deploy anything.{' '}
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
              Fix everything.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            InfraPilot turns any Git repository into a fully deployed, self-healing cloud application — in minutes, with zero config headaches.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <PremiumButton onClick={handleGetStarted} variant="primary" size="lg" icon={<Sparkles size={18} />}>
              Start Deploying Free
            </PremiumButton>
            <PremiumButton onClick={handleDemo} variant="secondary" size="lg" icon={<ArrowRight size={18} />}>
              Explore Live Demo
            </PremiumButton>
          </div>

          <p className="text-xs text-zinc-500 pt-2 font-medium">
            No credit card required · Works with EKS, AKS, GKE & Bare-metal K8s
          </p>
        </motion.div>
      </section>

      <section className="px-6 lg:px-12 pb-24 relative z-10">
        <ProductMockup />
      </section>

      <section className="py-12 border-y border-white/10 bg-zinc-900/40">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 px-6 text-center">
          {[
            { title: 'Any Stack Supported', desc: 'Spring Boot, Go, FastAPI, Rails, Node, Rust' },
            { title: 'Any K8s Provider', desc: 'AWS EKS, GCP GKE, Azure AKS, RKE2, Bare Metal' },
            { title: '5-Minute Rollout', desc: 'From git push to live production deployment' },
          ].map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              viewport={{ once: true }}
              className="space-y-1"
            >
              <h3 className="text-xl font-bold text-white">{item.title}</h3>
              <p className="text-xs text-zinc-400">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="features" className="py-24 px-6 lg:px-12 max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <PremiumBadge variant="info">Features</PremiumBadge>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Everything after git push
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto text-sm sm:text-base">
            One workspace for deployment pipelines, RCA diagnostic trees, architecture design, live monitoring, and secrets vault.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <GlassCard key={f.title} className="p-6 space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">{f.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              {f.showDiag && (
                <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-rose-400">
                    <span>Root Cause · 91% Confidence</span>
                  </div>
                  <p className="font-bold text-white">Missing DATABASE_URL secret</p>
                  <div className="flex gap-2 pt-1">
                    <PremiumButton size="sm" variant="danger">Fix Now</PremiumButton>
                    <PremiumButton size="sm" variant="ghost">View Logs</PremiumButton>
                  </div>
                </div>
              )}
              {f.tag && (
                <span className="inline-block text-[11px] font-medium text-zinc-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                  {f.tag}
                </span>
              )}
            </GlassCard>
          ))}
        </div>
      </section>

      <section id="pricing" className="py-24 px-6 lg:px-12 border-t border-white/10 bg-zinc-950 relative">
        <AuroraBackground className="py-12">
          <div className="max-w-5xl mx-auto space-y-12 relative z-10">
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                Simple, transparent pricing
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base">Start free. Upgrade as your team grows.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map((p) => (
                <GlassCard
                  key={p.id}
                  glow={p.featured}
                  className={`p-6 flex flex-col justify-between ${
                    p.featured ? 'border-purple-500/50 bg-purple-950/20' : ''
                  }`}
                >
                  <div className="space-y-4">
                    {p.featured && (
                      <span className="inline-block px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 rounded-full border border-purple-500/40">
                        Most Popular
                      </span>
                    )}
                    <div>
                      <h3 className="text-base font-bold text-white">{p.name}</h3>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-4xl font-extrabold text-white tracking-tight">{p.price}</span>
                        <span className="text-xs text-zinc-400">{p.period}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{p.desc}</p>
                    </div>

                    <ul className="space-y-2.5 pt-2 border-t border-white/10">
                      {p.features.map((feat) => (
                        <li key={feat} className="flex items-center gap-2 text-xs text-zinc-300">
                          <Check size={14} className="text-emerald-400 flex-shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    <PremiumButton
                      onClick={handleGetStarted}
                      variant={p.featured ? 'primary' : 'secondary'}
                      className="w-full"
                    >
                      {p.cta}
                    </PremiumButton>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </AuroraBackground>
      </section>

      <footer className="py-8 px-6 lg:px-12 border-t border-white/10 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <span>InfraPilot</span>
        </div>
        <p>© 2026 InfraPilot. Premium AI Infrastructure Automation.</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
        </div>
      </footer>
    </div>
  );
}
