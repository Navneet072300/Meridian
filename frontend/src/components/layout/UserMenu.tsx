import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, CreditCard, HelpCircle, LogOut, Moon, Sun, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useProfileStore } from '../../store/profileStore';
import { useThemeStore } from '../../store/themeStore';

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', team: 'Team', enterprise: 'Enterprise' };

export function UserMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { name, plan, avatar } = useProfileStore();
  const { theme, toggle } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowLogout(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const displayName = user?.name || name || 'User';
  const isGitHub = (user as any)?.provider === 'github';
  const email = isGitHub ? `${displayName} · GitHub` : (user?.email || '');
  const planKey = (user?.plan || plan) as string;
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function go(path: string) {
    navigate(path);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative select-none">
      {/* Avatar trigger */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setShowLogout(false); }}
        className="flex items-center gap-2 p-1.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 hover:border-purple-500/40 transition-all cursor-pointer"
        title="Account menu"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center overflow-hidden flex-shrink-0">
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 max-w-[90px] truncate">
          {displayName.split(' ')[0]}
        </span>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full right-0 mt-2 w-64 rounded-2xl border border-white/10 dark:border-white/10 border-zinc-200 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl p-2 shadow-2xl z-50 overflow-hidden space-y-1"
          >
            {/* Header info */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/20">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-zinc-400 truncate mt-0.5">{email}</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 uppercase mt-1.5">
                  <Sparkles size={10} /> {PLAN_LABEL[planKey] ?? planKey} Plan
                </span>
              </div>
            </div>

            {/* Menu items */}
            <div className="space-y-0.5 py-1">
              {[
                { icon: <User size={15} />, label: 'View Profile', path: '/app/profile' },
                { icon: <Settings size={15} />, label: 'Settings', path: '/app/settings' },
                { icon: <CreditCard size={15} />, label: 'Billing & Plan', path: '/app/subscription' },
                { icon: <HelpCircle size={15} />, label: 'Help & Docs', path: '/app/help' },
              ].map(({ icon, label, path }) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => go(path)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                >
                  <span className="text-zinc-400">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Theme switcher */}
            <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={toggle}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-zinc-400">
                    {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                  </span>
                  <span>Appearance</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </span>
              </button>
            </div>

            {/* Logout */}
            <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800">
              {showLogout ? (
                <div className="p-2.5 space-y-2 bg-rose-500/5 dark:bg-rose-500/10 rounded-xl border border-rose-500/20">
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Sign out of InfraPilot?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white shadow-sm hover:bg-rose-500 transition-colors"
                    >
                      Sign out
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLogout(false)}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLogout(true)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
