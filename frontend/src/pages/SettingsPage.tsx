import React, { useState } from 'react';
import { User, Shield, Bell, Cpu, CreditCard, Save, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumInput,
  PremiumBadge,
} from '../components/shared/UIPrimitives';

type Tab = 'general' | 'security' | 'notifications' | 'ai' | 'billing';

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'general',       label: 'General',       icon: <User size={16} /> },
  { id: 'security',      label: 'Security',       icon: <Shield size={16} /> },
  { id: 'notifications', label: 'Notifications',  icon: <Bell size={16} /> },
  { id: 'ai',            label: 'AI & Models',    icon: <Cpu size={16} /> },
  { id: 'billing',       label: 'Billing & Plan', icon: <CreditCard size={16} /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const { name, email, setProfile } = useProfileStore();

  const [formName, setFormName] = useState(name);
  const [formEmail, setFormEmail] = useState(email);
  const [saved, setSaved] = useState(false);

  const handleSaveGeneral = () => {
    setProfile({ name: formName, email: formEmail });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <User className="text-purple-500" size={24} />
            Account & Platform Settings
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your personal profile, security preferences, notification channels, and AI model configurations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <GlassCard hoverEffect={false} className="p-2 md:col-span-1 space-y-1 h-fit">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === item.id
                    ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </GlassCard>

          <div className="md:col-span-3">
            <AnimatePresence mode="wait">
              {activeTab === 'general' && (
                <motion.div
                  key="tab-general"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <GlassCard hoverEffect={false} className="p-6 space-y-6">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                      Profile Information
                    </h3>

                    <div className="space-y-4 max-w-md">
                      <PremiumInput
                        label="Full Name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                      <PremiumInput
                        label="Email Address"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                      />
                    </div>

                    <div className="pt-2">
                      <PremiumButton onClick={handleSaveGeneral} variant="primary" icon={saved ? <CheckCircle2 size={16} /> : <Save size={16} />}>
                        {saved ? 'Changes Saved' : 'Save Profile'}
                      </PremiumButton>
                    </div>
                  </GlassCard>
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div
                  key="tab-security"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <GlassCard hoverEffect={false} className="p-6 space-y-6">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-center gap-2">
                      <Shield size={18} className="text-emerald-500" />
                      Security & Authentication
                    </h3>

                    <div className="space-y-4 max-w-md">
                      <PremiumInput type="password" label="Current Password" placeholder="••••••••••••" />
                      <PremiumInput type="password" label="New Password" placeholder="••••••••••••" />
                    </div>

                    <div className="pt-2">
                      <PremiumButton variant="primary">Update Password</PremiumButton>
                    </div>
                  </GlassCard>
                </motion.div>
              )}

              {activeTab === 'billing' && (
                <motion.div
                  key="tab-billing"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <GlassCard hoverEffect={false} className="p-6 space-y-4">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                      Current Subscription Plan
                    </h3>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Current Plan</span>
                        <p className="text-xl font-bold text-white mt-1">Pro Tier</p>
                      </div>
                      <PremiumBadge variant="purple">Active</PremiumBadge>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
