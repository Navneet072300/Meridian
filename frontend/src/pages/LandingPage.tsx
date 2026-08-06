import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Rocket, Stethoscope, ShieldCheck, Bell, Sparkles, ArrowRight, Server, Terminal, Activity, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import {
  GlassCard,
  PremiumButton,
  PremiumBadge,
  Spotlight,
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
    icon: <Rocket size={20} className="text-zinc-200" />,
    title: 'Deploy any stack',
    desc: 'Git repo to live URL in one shot. AI generates CI pipelines, K8s manifests, and DNS — then monitors the rollout automatically.',
    tag: 'Spring Boot · FastAPI · Go · Rails · Node',
  },
  {
    icon: <Stethoscope size={20} className="text-zinc-200" />,
    title: 'AI diagnoses failures',
    desc: 'Paste logs or pull live pod data. AI-powered root cause analysis identifies the exact failure with 90%+ confidence.',
    showDiag: true,
  },
  {
    icon: <ShieldCheck size={20} className="text-zinc-200" />,
    title: 'Secrets management',
    desc: 'Per-user AES-256 encrypted vault. Secrets inject into any deployment automatically — no plaintext in CI.',
    tag: 'AES-256 · per-user keys · inject anywhere',
  },
  {
    icon: <Bell size={20} className="text-zinc-200" />,
    title: 'Alerts anywhere',
    desc: 'Cluster health delivered to Slack, Teams, Discord, or email. Snooze, acknowledge, and auto-resolve.',
    tag: 'Slack · Teams · Discord · Email · Webhook',
  },
];

function ProductMockup() {
  const bars = [28, 35, 22, 40, 55, 38, 62, 58, 44, 70, 65, 48, 80, 72, 68, 90];
  return (
    <GlassCard hoverEffect={false} className="max-w-5xl mx-auto overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/80">
      <div className="h-11 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex gap-2">
          {['#ff5f56', '#febc2e', '#27c93f'].map((c) => (
            <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <span className="text-xs font-mono text-zinc-400">infrapilot.dev / monitor</span>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          dev-aks · live
        </div>
      </div>

      <div className="flex flex-col sm:flex-row min-h-[380px]">
        <div className="w-full sm:w-48 bg-zinc-950 border-r border-zinc-800/80 p-3 space-y-1">
          {[
            { label: 'Deploy', icon: <Rocket size={13} />, active: false },
            { label: 'Monitor', icon: <Activity size={13} />, active: true },
            { label: 'Diagnose', icon: <Stethoscope size={13} />, active: false },
            { label: 'Generate', icon: <Terminal size={13} />, active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                item.active
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
          <div className="h-[1px] bg-zinc-800/80 my-3" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 pb-1">Clusters</p>
          {[
            { label: 'dev-aks', color: 'bg-emerald-500' },
            { label: 'prod-rke2', color: 'bg-amber-500' },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400">
              <span className={`w-2 h-2 rounded-full ${c.color}`} />
              {c.label}
            </div>
          ))}
        </div>

        <div className="flex-1 p-5 bg-zinc-900/40 space-y-4 overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Pods running', val: '24/24', sub: 'All healthy', subColor: 'text-emerald-400' },
              { label: 'CPU usage', val: '34%', isBar: true },
              { label: 'Memory', val: '12.4 GB', sub: '77% of 16 GB', subColor: 'text-amber-400' },
              { label: 'Active issues', val: '2', sub: '1 critical', subColor: 'text-rose-400' },
            ].map((m) => (
              <div key={m.label} className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/80">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{m.label}</p>
                <p className="text-base font-bold font-mono text-white mt-1">{m.val}</p>
                {m.isBar && (
                  <div className="h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                    <div className="w-1/3 h-full bg-violet-500 rounded-full" />
                  </div>
                )}
                {m.sub && <p className={`text-[10px] font-medium mt-1 ${m.subColor}`}>{m.sub}</p>}
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80">
            <p className="text-xs font-medium text-zinc-400 mb-2">Request rate · last 3h</p>
            <div className="flex items-end gap-1.5 h-12">
              {bars.map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`flex-1 rounded-xs ${i >= 10 ? 'bg-violet-500' : 'bg-zinc-800'}`}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 overflow-hidden text-xs">
            <div className="grid grid-cols-4 p-3 bg-zinc-900/60 font-semibold text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
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
              <div key={row.name} className="grid grid-cols-4 p-3 border-b border-zinc-800/60 last:border-0 items-center font-medium">
                <span className="text-zinc-100 font-semibold">{row.name}</span>
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className={`w-2 h-2 rounded-full ${row.dot}`} />
                  {row.status}
                </span>
                <span className="text-zinc-500">{row.cpu}</span>
                <span className={row.restarts !== '0' ? 'text-rose-400 font-bold' : 'text-zinc-500'}>{row.restarts}</span>
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
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-zinc-800 selection:text-white font-sans relative overflow-x-hidden">
      <nav className="h-16 border-b border-zinc-800/80 bg-black/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            <Rocket size={16} />
          </div>
          <span className="text-base font-bold tracking-tight text-white">InfraPilot</span>
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

      <section className="relative pt-24 pb-20 px-6 lg:px-12 text-center">
        <Spotlight fill="white" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto space-y-8 relative z-10"
        >
          <div className="flex justify-center">
            <PremiumBadge variant="purple" pulse>
              ✦ Next-Gen AI Infrastructure Automation
            </PremiumBadge>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
            Deploy anything.{' '}
            <span className="text-zinc-400">
              Fix everything.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            InfraPilot turns any Git repository into a fully deployed, self-healing cloud application — in minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <PremiumButton onClick={handleGetStarted} variant="primary" size="lg" icon={<Sparkles size={18} />}>
              Start Deploying Free
            </PremiumButton>
            <PremiumButton onClick={handleDemo} variant="secondary" size="lg" icon={<ArrowRight size={18} />}>
              Explore Live Demo
            </PremiumButton>
          </div>

          <p className="text-xs text-zinc-500 font-medium">
            No credit card required · EKS, AKS, GKE & Bare-metal K8s
          </p>
        </motion.div>
      </section>

      <section className="px-6 lg:px-12 pb-24 relative z-10">
        <ProductMockup />
      </section>

      <section className="py-16 border-y border-zinc-800/80 bg-zinc-950">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 px-6 text-center">
          {[
            { title: 'Any Stack Supported', desc: 'Spring Boot, Go, FastAPI, Rails, Node, Rust' },
            { title: 'Any K8s Provider', desc: 'AWS EKS, GCP GKE, Azure AKS, RKE2, Bare Metal' },
            { title: '5-Minute Rollout', desc: 'From git push to live production deployment' },
          ].map((item, idx) => (
            <div key={item.title} className="space-y-1.5">
              <h3 className="text-lg font-bold text-white tracking-tight">{item.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="py-24 sm:py-32 px-6 lg:px-12 max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <PremiumBadge variant="purple">Platform Engine</PremiumBadge>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Everything after git push
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
            One workspace for deployment pipelines, RCA diagnostic trees, architecture design, live monitoring, and secrets vault.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <GlassCard key={f.title} className="p-6 space-y-4 border border-zinc-800 bg-zinc-950/80">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">{f.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              {f.showDiag && (
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2 text-xs">
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
                <span className="inline-block text-[11px] font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
                  {f.tag}
                </span>
              )}
            </GlassCard>
          ))}
        </div>
      </section>

      <section id="pricing" className="py-24 sm:py-32 px-6 lg:px-12 border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">Start free. Upgrade as your team grows.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((p) => (
              <GlassCard
                key={p.id}
                className={`p-6 flex flex-col justify-between border ${
                  p.featured ? 'border-violet-500/50 bg-zinc-900/80 shadow-2xl' : 'border-zinc-800 bg-zinc-950/80'
                }`}
              >
                <div className="space-y-4">
                  {p.featured && (
                    <span className="inline-block px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-500/10 rounded-full border border-violet-500/30">
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

                  <ul className="space-y-2.5 pt-3 border-t border-zinc-800">
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
      </section>

      <footer className="py-8 px-6 lg:px-12 border-t border-zinc-800 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <span>InfraPilot</span>
        </div>
        <p>© 2026 InfraPilot. Autonomous AI Infrastructure Engine.</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
        </div>
      </footer>
    </div>
  );
}
