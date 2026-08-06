import React, { useRef, useState } from 'react';
import {
  Wand2, Stethoscope, Compass, Activity,
  Database, Clock, HelpCircle, Zap, Rocket,
  ChevronLeft, Menu, CreditCard, Camera, Lock, Home, Plug, KeyRound, Sparkles,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore, type Plan } from '../../store/profileStore';
import { useAuthStore } from '../../store/authStore';
import { UpgradeModal } from '../shared/UpgradeModal';
import type { PlanFeature } from '../../types';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  stub?: boolean;
  planFeature?: PlanFeature;
}

const PRIMARY: NavItem[] = [
  { icon: <Zap size={16} />,         label: 'Deploy',      path: '/app/deploy' },
  { icon: <Rocket size={16} />,      label: 'Deployments', path: '/app/deployments' },
  { icon: <Wand2 size={16} />,       label: 'Generate AI', path: '/app/generate' },
  { icon: <Stethoscope size={16} />, label: 'Diagnose',    path: '/app/diagnose' },
  { icon: <Compass size={16} />,     label: 'Design',      path: '/app/design', planFeature: 'design_mode' },
  { icon: <Activity size={16} />,    label: 'Monitor',     path: '/app/monitor', planFeature: 'monitor_mode' },
];

const RESOURCES: NavItem[] = [
  { icon: <Plug size={15} />,     label: 'Platforms', path: '/app/platforms' },
  { icon: <KeyRound size={15} />, label: 'Vault',     path: '/app/vault' },
  { icon: <Database size={15} />, label: 'Resources', path: '/app/resources' },
  { icon: <Clock size={15} />,    label: 'Audit Log', path: '/app/history' },
];

const PLAN_LABEL: Record<Plan, string> = { free: 'Free', pro: 'Pro', team: 'Team', enterprise: 'Enterprise' };

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { name, avatar, plan } = useProfileStore();
  const { user } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const setAvatar = useProfileStore((s) => s.setAvatar);
  const [upgradeFeature, setUpgradeFeature] = useState<PlanFeature | null>(null);

  const authPlan = user?.plan ?? 'free';
  const PLAN_GATED = new Set(['pro', 'team', 'enterprise']);
  function isPlanAllowed(feature?: PlanFeature) {
    if (!feature) return true;
    return PLAN_GATED.has(authPlan);
  }

  const isActive = (path: string) =>
    location.pathname === path ||
    (path === '/app/pipeline' && location.pathname === '/app');

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') setAvatar(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  const NavButton = ({ item }: { item: NavItem }) => {
    const active = isActive(item.path);
    const locked = item.planFeature ? !isPlanAllowed(item.planFeature) : false;

    function handleClick() {
      if (item.stub) return;
      if (locked && item.planFeature) {
        setUpgradeFeature(item.planFeature);
        return;
      }
      navigate(item.path);
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        title={
          collapsed
            ? item.label
            : locked
            ? `${item.label} — Pro required`
            : item.stub
            ? `${item.label} (coming soon)`
            : undefined
        }
        className={`relative flex items-center gap-3 w-full px-3 py-2 my-0.5 rounded-xl text-xs font-medium transition-all duration-200 ${
          collapsed ? 'justify-center px-0' : 'justify-start'
        } ${
          active
            ? 'text-purple-600 dark:text-purple-300 font-semibold bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20'
            : locked || item.stub
            ? 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
        } ${item.stub ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {active && (
          <motion.div
            layoutId="sidebarActivePill"
            className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-gradient-to-b from-purple-500 to-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(139,92,246,0.5)]"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
        <span
          className={`flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-lg ${
            active
              ? 'text-purple-600 dark:text-purple-400'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {item.icon}
        </span>
        {!collapsed && (
          <span className="flex-1 truncate text-left tracking-tight">{item.label}</span>
        )}
        {!collapsed && locked && (
          <Lock size={12} className="flex-shrink-0 text-zinc-400 dark:text-zinc-500" />
        )}
      </button>
    );
  };

  const BottomNavBtn = ({ icon, label, path }: { icon: React.ReactNode; label: string; path: string }) => {
    const active = isActive(path);
    return (
      <button
        type="button"
        onClick={() => navigate(path)}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-2.5 w-full px-3 py-1.5 my-0.5 rounded-xl text-xs font-medium transition-all duration-200 ${
          collapsed ? 'justify-center px-0' : 'justify-start'
        } ${
          active
            ? 'text-purple-600 dark:text-purple-300 bg-purple-500/10 dark:bg-purple-500/15'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
        }`}
      >
        <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">{icon}</span>
        {!collapsed && <span>{label}</span>}
      </button>
    );
  };

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="h-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col z-20 select-none overflow-hidden"
      >
        {/* Top Header / Brand Logo */}
        <div className="h-14 px-3.5 flex items-center border-b border-zinc-200 dark:border-zinc-800/80 flex-shrink-0">
          {collapsed ? (
            <button
              type="button"
              onClick={onToggle}
              title="Expand sidebar"
              className="w-full h-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <Menu size={18} />
            </button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div
                onClick={() => navigate('/app/deploy')}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                  M
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    InfraPilot
                    <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full border border-purple-500/20">
                      v2.4
                    </span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggle}
                title="Collapse sidebar"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4 scrollbar-none">
          <div>
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Workspace
              </p>
            )}
            {PRIMARY.map((item) => (
              <NavButton key={item.path} item={item} />
            ))}
          </div>

          <div>
            {!collapsed ? (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Resources
              </p>
            ) : (
              <div className="h-[1px] bg-zinc-200 dark:bg-zinc-800/80 my-2 mx-2" />
            )}
            {RESOURCES.map((item) => (
              <NavButton key={item.path} item={item} />
            ))}
          </div>
        </nav>

        {/* Bottom Profile & Footer */}
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-1 bg-zinc-50/50 dark:bg-zinc-900/30">
          {/* User Card */}
          <div
            onClick={() => navigate('/app/profile')}
            title={collapsed ? name : undefined}
            className={`flex items-center gap-2.5 p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 hover:border-purple-500/40 cursor-pointer transition-all duration-200 ${
              collapsed ? 'justify-center p-1.5' : ''
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-medium text-xs flex items-center justify-center overflow-hidden border border-white/20">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              {!collapsed && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    aria-label="Upload profile photo"
                    className="hidden"
                    onChange={handleAvatarFile}
                  />
                  <button
                    type="button"
                    title="Change photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileRef.current?.click();
                    }}
                    className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 text-white transition-opacity"
                  >
                    <Camera size={11} />
                  </button>
                </>
              )}
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {name}
                </p>
                <span className="inline-block text-[10px] font-semibold tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20 uppercase">
                  {PLAN_LABEL[plan]} Plan
                </span>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="pt-1 space-y-0.5">
            <BottomNavBtn icon={<Home size={14} />} label="Home" path="/" />
            <BottomNavBtn icon={<CreditCard size={14} />} label="Subscription" path="/app/subscription" />
            <BottomNavBtn icon={<HelpCircle size={14} />} label="Help & Docs" path="/app/help" />
          </div>
        </div>
      </motion.aside>

      {upgradeFeature && (
        <UpgradeModal
          feature={upgradeFeature}
          requiredPlan="pro"
          onClose={() => setUpgradeFeature(null)}
        />
      )}
    </>
  );
}
