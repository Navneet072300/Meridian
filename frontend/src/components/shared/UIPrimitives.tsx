import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, X } from 'lucide-react';

export function GlassCard({
  children,
  className = '',
  glow = false,
  hoverEffect = true,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  hoverEffect?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hoverEffect ? { y: -2, transition: { duration: 0.2 } } : undefined}
      className={`rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/50 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/40 ${
        glow ? 'border-violet-500/40 shadow-violet-500/10' : ''
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function PremiumButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-4 py-2 text-sm rounded-xl gap-2',
    lg: 'px-6 py-3 text-base rounded-xl gap-2.5 font-semibold',
  };

  const variantClasses = {
    primary:
      'bg-white text-zinc-950 hover:bg-zinc-200 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-semibold shadow-sm border border-white/20',
    secondary:
      'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-700/60 shadow-sm',
    outline:
      'border border-zinc-300 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white shadow-sm border border-rose-500/30',
    ghost:
      'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300',
  };

  return (
    <motion.button
      whileHover={!disabled && !isLoading ? { scale: 1.015 } : undefined}
      whileTap={!disabled && !isLoading ? { scale: 0.97 } : undefined}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-medium transition-all ${sizeClasses[size]} ${variantClasses[variant]} ${
        disabled || isLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </motion.button>
  );
}

export function PremiumInput({
  label,
  error,
  icon,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 text-zinc-400 dark:text-zinc-500 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          className={`w-full h-10 ${
            icon ? 'pl-9' : 'pl-3.5'
          } pr-3.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
}

export function PremiumBadge({
  children,
  variant = 'purple',
  pulse = false,
}: {
  children: React.ReactNode;
  variant?: 'purple' | 'blue' | 'emerald' | 'amber' | 'rose' | 'success' | 'error' | 'warning' | 'info';
  pulse?: boolean;
}) {
  const styles: Record<string, string> = {
    purple: 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-300',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-300',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-300',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-300',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
    error: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
    info: 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-300',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
        styles[variant] || styles.purple
      }`}
    >
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </span>
  );
}

export function SkeletonLoader({ height = '20px', className = '' }: { height?: string; className?: string }) {
  return (
    <div
      style={{ height }}
      className={`w-full rounded-xl bg-gradient-to-r from-zinc-200 via-zinc-300 to-zinc-200 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900 animate-pulse ${className}`}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <GlassCard hoverEffect={false} className="p-12 text-center flex flex-col items-center justify-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-400 flex items-center justify-center">
        {icon || <Sparkles size={24} />}
      </div>
      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </GlassCard>
  );
}

export function Spotlight({
  className = '',
  fill = 'white',
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      className={`pointer-events-none absolute z-0 h-[120%] w-[100%] opacity-20 animate-spotlight ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <g filter="url(#filter)">
        <ellipse
          cx="1924.71"
          cy="273.501"
          rx="1924.71"
          ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill={fill}
          fillOpacity="0.15"
        />
      </g>
      <defs>
        <filter
          id="filter"
          x="0.860352"
          y="0.838989"
          width="3785.16"
          height="2840.26"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </svg>
  );
}

export function AuroraBackground({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 transition-colors ${className}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="aurora-blob-1 opacity-20" />
        <div className="aurora-blob-2 opacity-15" />
      </div>
      {children}
    </div>
  );
}

export function PremiumDialog({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl z-10"
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              {title && <h3 className="text-base font-bold text-white">{title}</h3>}
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="pt-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function PageContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-6 lg:p-8 space-y-6 max-w-7xl mx-auto min-h-screen ${className}`}>
      {children}
    </div>
  );
}
