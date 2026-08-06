import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, Rocket, ShieldCheck } from 'lucide-react';
import { GlassCard, AuroraBackground } from '../components/shared/UIPrimitives';

const ERROR_MESSAGES: Record<string, string> = {
  github_failed:    'GitHub sign-in failed. Please try again.',
  github_no_email:  'Your GitHub account has no public email. Enable a primary email in GitHub settings and retry.',
  gitlab_failed:    'GitLab sign-in failed. Please try again.',
  gitlab_no_email:  'Your GitLab account has no public email. Add a primary email in GitLab settings and retry.',
  session_failed:   'Session expired. Please sign in again.',
  db_unavailable:   'Service temporarily unavailable. Please try again shortly.',
};

function GitHubLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function GitLabLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.386 9.45.044 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.625-8.444a.92.92 0 0 0 .33-1.023" />
    </svg>
  );
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get('error');
  const error = errorCode ? (ERROR_MESSAGES[errorCode] ?? 'Sign-in failed. Please try again.') : '';

  return (
    <AuroraBackground className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-zinc-100 font-sans select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md space-y-6 relative z-10"
      >
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white mx-auto shadow-xl shadow-purple-500/25 border border-white/20">
            <Rocket size={26} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome to InfraPilot
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Sign in with your Git provider to connect repositories and start automated cloud deployments.
          </p>
        </div>

        <GlassCard glow className="p-8 space-y-6 border border-white/10 dark:border-white/10">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2"
            >
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <motion.a
            whileHover={{ scale: 1.015, y: -1 }}
            whileTap={{ scale: 0.98 }}
            href="/api/auth/github"
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm border border-zinc-700/80 shadow-lg transition-all"
          >
            <GitHubLogo size={18} />
            <span>Continue with GitHub</span>
          </motion.a>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-[1px] bg-zinc-800" />
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-[1px] bg-zinc-800" />
          </div>

          <motion.a
            whileHover={{ scale: 1.015, y: -1 }}
            whileTap={{ scale: 0.98 }}
            href="/api/auth/gitlab"
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl bg-[#fc6d26] hover:bg-[#e24329] text-white font-semibold text-sm shadow-lg shadow-orange-500/20 border border-white/20 transition-all"
          >
            <GitLabLogo size={18} />
            <span>Continue with GitLab</span>
          </motion.a>

          <div className="pt-2 text-center">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Requires <code className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[10px]">read_user</code> & <code className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[10px]">repo</code> scopes for automated pipeline management.
            </p>
          </div>
        </GlassCard>

        <p className="text-center text-[11px] text-zinc-500 flex items-center justify-center gap-1">
          <ShieldCheck size={13} className="text-purple-400" />
          <span>Encrypted with AES-256 Vault Protection</span>
        </p>
      </motion.div>
    </AuroraBackground>
  );
}
