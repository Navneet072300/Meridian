import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Search, RefreshCw, Rocket, KeyRound } from 'lucide-react';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumInput,
  PremiumBadge,
  SkeletonLoader,
} from '../components/shared/UIPrimitives';

interface Repo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  url: string;
  clone_url: string;
  default_branch: string;
  language: string;
  stars: number;
  forks: number;
  updated_at: string;
  topics: string[];
}

export function ReposPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['github-repos'],
    queryFn: async () => {
      const r = await fetch('/api/github/repos?per_page=50');
      if (!r.ok) throw new Error('Failed to load repositories');
      return r.json() as Promise<{ repos: Repo[] }>;
    },
  });

  const repos = data?.repos || [];
  const filteredRepos = repos.filter((r) => {
    if (filter === 'public' && r.private) return false;
    if (filter === 'private' && !r.private) return false;
    if (search && !r.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <GitBranch className="text-purple-500" size={24} />
              Connected Repositories
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Select any Git repository to launch an AI automated CI/CD deployment pipeline.
            </p>
          </div>

          <PremiumButton size="sm" variant="outline" onClick={() => refetch()} icon={<RefreshCw size={14} />}>
            Sync Repos
          </PremiumButton>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <PremiumInput
              icon={<Search size={16} />}
              placeholder="Search repositories by name or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {(['all', 'public', 'private'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  filter === f
                    ? 'bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonLoader key={i} height="130px" />)}
          </div>
        ) : filteredRepos.length === 0 ? (
          <GlassCard hoverEffect={false} className="p-12 text-center space-y-3">
            <GitBranch className="w-10 h-10 text-purple-500 mx-auto" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">No Repositories Found</h3>
            <p className="text-xs text-zinc-400">Connect GitHub or GitLab credentials in Settings to sync your projects.</p>
            <PremiumButton onClick={() => navigate('/app/settings')} variant="primary" icon={<KeyRound size={16} />}>
              Configure Git Integrations
            </PremiumButton>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepos.map((repo) => (
              <GlassCard key={repo.id} className="p-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-2">
                      <GitBranch size={16} className="text-purple-500 flex-shrink-0" />
                      <span className="truncate">{repo.name}</span>
                    </h3>
                    <PremiumBadge variant={repo.private ? 'warning' : 'info'}>
                      {repo.private ? 'Private' : 'Public'}
                    </PremiumBadge>
                  </div>
                  {repo.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {repo.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                    {repo.language || 'Code'}
                  </span>
                  <PremiumButton
                    size="sm"
                    variant="primary"
                    onClick={() => navigate('/app/deploy')}
                    icon={<Rocket size={12} />}
                  >
                    Deploy
                  </PremiumButton>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
