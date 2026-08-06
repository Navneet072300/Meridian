import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import type { ExperienceLevel } from '../../lib/terminology';
import { motion } from 'framer-motion';
import { Rocket, CheckCircle2, ArrowRight } from 'lucide-react';
import { GlassCard, PremiumButton, AuroraBackground } from './UIPrimitives';

interface Choice {
  level: ExperienceLevel;
  icon: string;
  title: string;
  lines: string[];
}

const CHOICES: Choice[] = [
  {
    level: 'builder',
    icon: '👨‍💻',
    title: 'I build apps',
    lines: ["I write code. I want my app live.", "I don't deal with servers much."],
  },
  {
    level: 'devops',
    icon: '⚙️',
    title: 'I manage infrastructure',
    lines: ['I work with Kubernetes, CI/CD,', 'deployments, and cloud platforms.'],
  },
  {
    level: 'learning',
    icon: '🌱',
    title: "I'm learning",
    lines: ["I'm new to deployment and want", 'to understand how it works.'],
  },
];

interface Props {
  onDone: () => void;
}

export function UserTypeScreen({ onDone }: Props) {
  const { setUser } = useAuthStore();
  const [selected, setSelected] = useState<ExperienceLevel | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selected) skip();
    }, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [selected]);

  async function skip() {
    setUser({ experience_level: 'devops' });
    try {
      await fetch('/api/settings/general', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experience_level: 'devops' }),
      });
    } catch { /* best-effort */ }
    onDone();
  }

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch('/api/settings/general', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experience_level: selected }),
      });
      setUser({ experience_level: selected });
    } catch {
      setUser({ experience_level: selected });
    } finally {
      setSaving(false);
      onDone();
    }
  }

  return (
    <AuroraBackground className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-6 text-zinc-100 font-sans select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md space-y-6 relative z-10"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={skip}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip for now ✕
          </button>
        </div>

        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white mx-auto shadow-sm">
            <Rocket size={20} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">How do you usually work?</h2>
          <p className="text-xs text-zinc-400">This helps InfraPilot tune terminology and AI assistance.</p>
        </div>

        <div className="space-y-3">
          {CHOICES.map((c) => {
            const active = selected === c.level;
            return (
              <GlassCard
                key={c.level}
                onClick={() => setSelected(c.level)}
                className={`p-4 cursor-pointer flex items-start gap-4 border transition-all ${
                  active ? 'border-zinc-700 bg-zinc-900/90 shadow-md' : 'border-zinc-800 bg-zinc-950/60'
                }`}
              >
                <span className="text-2xl">{c.icon}</span>
                <div className="flex-1">
                  <h3 className={`text-sm font-bold ${active ? 'text-white' : 'text-zinc-300'}`}>{c.title}</h3>
                  {c.lines.map((line, idx) => (
                    <p key={idx} className="text-xs text-zinc-400 leading-relaxed">{line}</p>
                  ))}
                </div>
                {active && <CheckCircle2 size={18} className="text-violet-400 mt-1" />}
              </GlassCard>
            );
          })}
        </div>

        <PremiumButton
          disabled={!selected || saving}
          isLoading={saving}
          onClick={confirm}
          variant="primary"
          className="w-full py-2.5"
          icon={<ArrowRight size={16} />}
        >
          Continue to InfraPilot
        </PremiumButton>
      </motion.div>
    </AuroraBackground>
  );
}
