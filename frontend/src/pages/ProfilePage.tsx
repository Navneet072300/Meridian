import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, GitBranch, Cpu, Box, Settings, CreditCard } from 'lucide-react';
import { useProfileStore } from '../store/profileStore';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumBadge,
} from '../components/shared/UIPrimitives';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { name, email, avatar, plan } = useProfileStore();

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <PageContainer>
      <div className="space-y-6 max-w-4xl mx-auto">
        <GlassCard glow hoverEffect={false} className="p-8 border border-purple-500/20">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-purple-500/30 overflow-hidden flex-shrink-0 border-2 border-white/20">
              {avatar ? (
                <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{name}</h1>
                <PremiumBadge variant="purple">
                  ✦ {plan.toUpperCase()} PLAN
                </PremiumBadge>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{email}</p>

              <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
                <PremiumButton onClick={() => navigate('/app/settings')} variant="outline" size="sm" icon={<Settings size={14} />}>
                  Account Settings
                </PremiumButton>
                <PremiumButton onClick={() => navigate('/app/subscription')} variant="primary" size="sm" icon={<CreditCard size={14} />}>
                  Manage Plan
                </PremiumButton>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Files Generated', val: '48', icon: <Code2 size={18} className="text-purple-500" /> },
            { label: 'Pipelines Run', val: '124', icon: <GitBranch size={18} className="text-blue-500" /> },
            { label: 'Pods Diagnosed', val: '18', icon: <Cpu size={18} className="text-amber-500" /> },
            { label: 'Deploy Success', val: '98%', icon: <Box size={18} className="text-emerald-500" /> },
          ].map((m) => (
            <GlassCard key={m.label} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{m.label}</span>
                {m.icon}
              </div>
              <p className="text-2xl font-extrabold font-mono text-zinc-900 dark:text-zinc-100">{m.val}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
