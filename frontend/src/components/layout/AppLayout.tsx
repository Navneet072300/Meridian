import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAuthStore } from '../../store/authStore';
import { Eye, ArrowRight } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export function AppLayout({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { isDemoMode, logout } = useAuthStore();
  const navigate = useNavigate();

  function exitDemo() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">
      {/* Demo mode banner */}
      {isDemoMode && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-center gap-3 text-xs flex-shrink-0 z-30">
          <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
            <Eye size={14} />
            <span>Demo Mode — sandbox environment with simulated cluster telemetry</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500 text-white font-semibold text-[11px] shadow-sm hover:bg-amber-600 transition-colors"
          >
            <span>Sign up free</span>
            <ArrowRight size={12} />
          </button>
          <button
            type="button"
            onClick={exitDemo}
            className="text-zinc-500 dark:text-zinc-400 hover:underline text-[11px]"
          >
            Exit demo
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-zinc-50/50 dark:bg-zinc-950/50 p-6 scrollbar-thin">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
