import { useNavigate } from 'react-router-dom';
import { Check, Rocket, Stethoscope, ShieldCheck, Bell } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

/* ── Pricing data (3 plans) ───────────────────────────────────── */
const PLANS = [
  {
    id: 'free', name: 'Free', price: '$0', period: '/mo',
    desc: 'Everything you need to get started.',
    features: ['1 cluster', '50 AI requests / day', '3 pipeline runs / day', 'Deploy, Generate, Diagnose', 'Community support', '7-day history'],
    cta: 'Get started free', featured: false,
  },
  {
    id: 'pro', name: 'Pro', price: '$49', period: '/mo',
    desc: 'For teams that ship daily.',
    features: ['5 clusters', 'Unlimited AI requests', 'All 5 modes', 'Custom model endpoints', 'API key access', '90-day history'],
    cta: 'Start with Pro', featured: true,
  },
  {
    id: 'team', name: 'Team', price: '$199', period: '/mo',
    desc: 'For engineering teams at scale.',
    features: ['15 clusters', '10 seats (RBAC)', 'Vault & ArgoCD integrations', 'Audit log + SSO', 'Slack notifications', '365-day history'],
    cta: 'Start with Team', featured: false,
  },
];

/* ── Feature data ─────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: <Rocket size={18} />,
    title: 'Deploy any stack',
    desc: 'Git repo to live URL in one shot. AI generates CI pipelines, K8s manifests, and DNS — then monitors the rollout automatically.',
    tag: 'Spring Boot · FastAPI · Go · Rails · anything',
    color: 'var(--bg-hover)',
  },
  {
    icon: <Stethoscope size={18} />,
    title: 'AI diagnoses failures',
    desc: 'Paste logs or pull live pod data. AI-powered root cause analysis identifies the exact failure with 90%+ confidence.',
    showDiag: true,
    color: 'var(--success-bg)',
  },
  {
    icon: <ShieldCheck size={18} />,
    title: 'Secrets management',
    desc: 'Per-user AES-256 encrypted vault. Secrets inject into any deployment automatically — no plaintext in CI.',
    tag: 'AES-256 · per-user keys · inject anywhere',
    color: 'var(--success-bg)',
  },
  {
    icon: <Bell size={18} />,
    title: 'Alerts anywhere',
    desc: 'Cluster health delivered to Slack, Teams, Discord, or email. Snooze, acknowledge, and auto-resolve.',
    tag: 'Slack · Teams · Discord · Email · Webhook',
    color: 'var(--warning-bg)',
  },
];

/* ── Product mockup ───────────────────────────────────────────── */
function ProductMockup() {
  const svc = { base: 'var(--bg-surface)', border: 'var(--border)', text: 'var(--text-primary)', muted: 'var(--text-muted)', secondary: 'var(--text-secondary)' };
  const bars = [28, 35, 22, 40, 55, 38, 62, 58, 44, 70, 65, 48, 80, 72, 68, 90];
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
      {/* Chrome bar */}
      <div style={{ height: 44, background: svc.base, borderBottom: `1px solid ${svc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ff5f56','#febc2e','#27c93f'].map((c) => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
        </div>
        <span style={{ fontSize: 11, color: svc.muted, fontFamily: 'var(--font-mono)' }}>meridian.dev / monitor</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#16a34a' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          dev-aks · live
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', height: 360 }}>
        {/* Sidebar */}
        <div style={{ width: 190, background: svc.base, borderRight: `1px solid ${svc.border}`, padding: '10px 0', flexShrink: 0 }}>
          {[
            { label: 'Deploy', active: false },
            { label: 'Monitor', active: true },
            { label: 'Diagnose', active: false },
            { label: 'Generate', active: false },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', margin: '1px 8px', borderRadius: 'var(--radius-md)', background: item.active ? 'var(--bg-hover)' : 'transparent', fontSize: 12, color: item.active ? svc.text : svc.secondary, fontWeight: item.active ? 500 : 400 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: item.active ? 'var(--accent)' : svc.border }} />
              {item.label}
            </div>
          ))}
          <div style={{ height: 1, background: svc.border, margin: '10px 12px' }} />
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: svc.muted, padding: '8px 16px 4px' }}>Clusters</div>
          {[{ label: 'dev-aks', color: '#22c55e' }, { label: 'prod-rke2', color: '#f59e0b' }].map((c) => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 16px', fontSize: 11, color: svc.secondary }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
              {c.label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '16px', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Pods running', val: '24/24', sub: 'All healthy', subColor: '#16a34a' },
              { label: 'CPU usage', val: '34%', isBar: true },
              { label: 'Memory', val: '12.4 GB', sub: '77% of 16 GB', subColor: '#d97706' },
              { label: 'Active issues', val: '2', sub: '1 critical', subColor: '#dc2626' },
            ].map((m) => (
              <div key={m.label} style={{ background: svc.base, border: `1px solid ${svc.border}`, borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: svc.muted, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 500, color: svc.text, fontFamily: 'var(--font-mono)' }}>{m.val}</div>
                {m.isBar && (
                  <div style={{ height: 3, background: svc.border, borderRadius: 9999, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: '34%', height: '100%', background: '#5b5bcc', borderRadius: 9999 }} />
                  </div>
                )}
                {m.sub && <div style={{ fontSize: 9, color: m.subColor, marginTop: 3 }}>{m.sub}</div>}
              </div>
            ))}
          </div>

          {/* Sparkline */}
          <div style={{ background: svc.base, border: `1px solid ${svc.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: svc.muted, marginBottom: 8 }}>Request rate · last 3h</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 2, background: i >= 10 ? '#1a1a1a' : '#e8e8e4' }} />
              ))}
            </div>
          </div>

          {/* Service table */}
          <div style={{ background: svc.base, border: `1px solid ${svc.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 60px', padding: '6px 12px', borderBottom: `1px solid ${svc.border}`, background: svc.base }}>
              {['Service','Status','CPU','Restarts'].map((h) => (
                <div key={h} style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: svc.muted }}>{h}</div>
              ))}
            </div>
            {[
              { name: 'backend',   dot: '#22c55e', status: 'Healthy',            cpu: '28%', restarts: '0',  bg: 'transparent' },
              { name: 'worker',    dot: '#f59e0b', status: 'Degraded',           cpu: '82%', restarts: '3',  bg: '#fffbeb' },
              { name: 'analytics', dot: '#ef4444', status: 'CrashLoopBackOff',   cpu: '—',   restarts: '12', bg: '#fef2f2' },
            ].map((row) => (
              <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 60px', padding: '7px 12px', borderBottom: `1px solid ${svc.border}`, background: row.bg, fontSize: 11 }}>
                <div style={{ color: svc.text, fontWeight: 500 }}>{row.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: svc.secondary }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: row.dot }} />
                  {row.status}
                </div>
                <div style={{ color: svc.secondary }}>{row.cpu}</div>
                <div style={{ color: row.restarts !== '0' ? '#dc2626' : svc.muted }}>{row.restarts}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */
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

  const btn = {
    primary: {
      background: 'var(--accent)', color: '#fff', border: 'none',
      padding: '12px 24px', borderRadius: 'var(--radius-md)',
      fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    } as React.CSSProperties,
    secondary: {
      background: '#fff', color: 'var(--text-primary)',
      border: '1px solid var(--border-strong)',
      padding: '12px 24px', borderRadius: 'var(--radius-md)',
      fontSize: 14, fontWeight: 400, cursor: 'pointer', fontFamily: 'inherit',
    } as React.CSSProperties,
    ghost: {
      background: '#fff', color: 'var(--text-secondary)',
      border: '1px solid var(--border-strong)',
      padding: '7px 14px', borderRadius: 'var(--radius-md)',
      fontSize: 13, fontWeight: 400, cursor: 'pointer', fontFamily: 'inherit',
    } as React.CSSProperties,
    solid: {
      background: 'var(--accent)', color: '#fff', border: 'none',
      padding: '7px 16px', borderRadius: 'var(--radius-md)',
      fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    } as React.CSSProperties,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── Navbar ── */}
      <nav style={{
        height: 56, background: 'var(--bg-base)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <polygon points="7,1 13,4.5 13,10.5 7,14 1,10.5 1,4.5" stroke="white" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>Meridian</span>
        </div>

        {/* Center: Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {['Docs', 'Changelog', 'Pricing', 'GitHub'].map((l) => (
            <a key={l} href="#" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'; }}>
              {l}
            </a>
          ))}
        </div>

        {/* Right: CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!loggedIn && <button onClick={() => navigate('/login')} style={btn.ghost}>Sign in</button>}
          <button onClick={handleOpenApp} style={btn.solid}>{loggedIn ? 'Open app' : 'Get started'}</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: '100px 48px 0', textAlign: 'center' }}>
        {/* Eyebrow */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--text-secondary)',
          border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px',
          background: '#fff', marginBottom: 28,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          Now in public beta
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 60, fontWeight: 500, letterSpacing: '-2px', lineHeight: 1.08, maxWidth: 700, margin: '0 auto' }}>
          <span style={{ color: 'var(--text-primary)', display: 'block' }}>Deploy anything.</span>
          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Fix everything.</span>
        </h1>

        {/* Subheadline */}
        <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 460, margin: '20px auto 0', lineHeight: 1.7 }}>
          Meridian turns any Git repository into a fully deployed, self-healing cloud application — in minutes, not hours.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 36 }}>
          <button onClick={handleGetStarted} style={btn.primary}>Start deploying free</button>
          <button onClick={handleDemo} style={btn.secondary}>See how it works</button>
        </div>

        {/* Trust note */}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
          No credit card · Works with any cluster · Any language
        </p>
      </section>

      {/* ── Product screenshot ── */}
      <div style={{ margin: '56px 48px 0' }}>
        <ProductMockup />
      </div>

      {/* ── Social proof strip ── */}
      <section style={{ padding: '64px 48px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, maxWidth: 860, margin: '0 auto' }}>
          {[
            { big: 'Any language', sub: 'Spring Boot, Go, Python, Java, Rails, Node...' },
            { big: 'Any cluster',  sub: 'EKS, AKS, GKE, RKE2, bare metal, k3s' },
            { big: '5 min',        sub: 'From git push to live URL' },
          ].map((s) => (
            <div key={s.big} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{s.big}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '96px 48px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>What Meridian does</div>
            <h2 style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 12 }}>Everything after git push</h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 480, lineHeight: 1.7 }}>
              One workspace for deploy, diagnose, generate, monitor, and secrets — all cluster-aware, all AI-native.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, color: 'var(--text-primary)' }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{f.title}</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: f.tag || f.showDiag ? 14 : 0 }}>{f.desc}</p>
                {f.showDiag && (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>Root cause · 91% confidence</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Missing DATABASE_URL secret</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ fontSize: 11, padding: '4px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Fix now</button>
                      <button style={{ fontSize: 11, padding: '4px 10px', background: '#fff', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>View logs</button>
                    </div>
                  </div>
                )}
                {f.tag && (
                  <div style={{ display: 'inline-flex', fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px' }}>
                    {f.tag}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section style={{ background: '#fff', borderTop: '1px solid var(--border)', padding: '96px 48px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-1px', marginBottom: 10 }}>Simple, transparent pricing</h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Start free. Scale as your platform grows.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {PLANS.map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
                {p.featured && (
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', padding: '3px 10px', borderRadius: 20 }}>Most popular</span>
                  </div>
                )}
                <div style={{
                  border: p.featured ? '1.5px solid var(--text-primary)' : '1px solid var(--border)',
                  background: '#fff', borderRadius: 'var(--radius-lg)', padding: 24,
                  display: 'flex', flexDirection: 'column', height: p.featured ? undefined : undefined,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>{p.name}</div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-1px', color: 'var(--text-primary)' }}>{p.price}</span>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{p.period}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>{p.desc}</p>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, marginBottom: 24 }}>
                    {p.features.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                        <Check size={13} color="var(--success-text)" style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={handleGetStarted}
                    style={{
                      width: '100%', padding: '10px', fontSize: 13, fontWeight: 500,
                      borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit',
                      ...(p.featured
                        ? { background: 'var(--accent)', color: '#fff', border: 'none' }
                        : { background: '#fff', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' }),
                    }}
                  >{p.cta}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '40px 48px', borderTop: '1px solid var(--border)', background: 'var(--bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Meridian</span>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Docs', 'Changelog', 'Privacy', 'Terms'].map((l) => (
            <a key={l} href="#" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>© 2026 Meridian</span>
      </footer>

    </div>
  );
}
