import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type Toast } from '../../store/toastStore';

const CONFIG = {
  success: { icon: <CheckCircle2 size={16} />, color: 'var(--success)', border: 'var(--success-bg)' },
  error:   { icon: <XCircle      size={16} />, color: 'var(--error)',   border: 'var(--error-bg)'   },
  warning: { icon: <AlertTriangle size={16}/>, color: 'var(--warning)', border: 'var(--warning-bg)' },
  info:    { icon: <Info          size={16} />, color: 'var(--info)',   border: 'var(--info-bg)'    },
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Tiny delay so the CSS transition fires
    const id = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(id);
  }, []);

  const cfg = CONFIG[t.type];

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px',
        background: 'var(--bg-surface)',
        border: `1px solid ${cfg.border}`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: 10,
        boxShadow: 'var(--shadow-lg)',
        minWidth: 280, maxWidth: 380,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(32px)',
        transition: 'opacity 0.22s ease, transform 0.22s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Coloured icon */}
      <span style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {t.title}
        </p>
        {t.message && (
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t.message}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 2, flexShrink: 0,
          display: 'flex', alignItems: 'center',
        }}
      >
        <X size={13} />
      </button>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0,
          width: '100%', height: 2, background: cfg.color, opacity: 0.5,
          transformOrigin: 'left',
          animation: `toast-shrink ${(t.duration ?? 4000)}ms linear forwards`,
        }}
      />
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <>
      <div
        style={{
          position: 'fixed', bottom: 24, right: 24,
          display: 'flex', flexDirection: 'column-reverse', gap: 10,
          zIndex: 9999,
          pointerEvents: toasts.length === 0 ? 'none' : 'auto',
        }}
      >
        {toasts.map((t) => <ToastItem key={t.id} t={t} />)}
      </div>
    </>
  );
}
