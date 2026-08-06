import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Eye, EyeOff, Copy, Check,
  KeyRound, Search, ShieldCheck,
} from 'lucide-react';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumInput,
  PremiumBadge,
  PremiumDialog,
} from '../components/shared/UIPrimitives';

const SECRET_TYPES = [
  { id: 'api_key',      label: 'API Key' },
  { id: 'token',        label: 'Access Token' },
  { id: 'password',     label: 'Password' },
  { id: 'aws_creds',    label: 'AWS Credentials' },
  { id: 'gcp_sa',       label: 'GCP Service Account' },
  { id: 'azure_creds',  label: 'Azure Credentials' },
  { id: 'database_url', label: 'Database URL' },
  { id: 'ssh_key',      label: 'SSH Key' },
  { id: 'webhook_url',  label: 'Webhook URL' },
  { id: 'other',        label: 'Other' },
];

interface Secret {
  id: string; name: string; secret_type: string; description: string | null;
  value: string; created_at: string | null;
}

export default function VaultPage() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', secret_type: 'api_key', value: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchSecrets = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/vault', { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setSecrets(data.secrets || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSecrets(); }, [fetchSecrets]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.value.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/vault', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (r.ok) {
        setShowAddModal(false);
        setForm({ name: '', secret_type: 'api_key', value: '', description: '' });
        fetchSecrets();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/vault/${id}`, { method: 'DELETE', credentials: 'include' });
    setSecrets((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copySecret = (id: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = secrets.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.secret_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <KeyRound className="text-purple-500" size={24} />
              Secrets Vault & Credentials
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-500" />
              AES-256 encrypted per-user vault. Auto-injected into deployment pipelines.
            </p>
          </div>

          <PremiumButton onClick={() => setShowAddModal(true)} variant="primary" icon={<Plus size={16} />}>
            Add Secret
          </PremiumButton>
        </div>

        <div className="max-w-md">
          <PremiumInput
            icon={<Search size={16} />}
            placeholder="Search secrets by key name or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <GlassCard hoverEffect={false} className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Secret Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Description</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-xs text-zinc-400">Loading encrypted vault...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-xs text-zinc-400">
                      No secrets found in your vault.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const isRevealed = revealedIds.has(s.id);
                    return (
                      <tr key={s.id}>
                        <td className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                          {s.name}
                        </td>
                        <td>
                          <PremiumBadge variant="purple">{s.secret_type}</PremiumBadge>
                        </td>
                        <td className="font-mono text-xs text-zinc-500">
                          {isRevealed ? s.value : '••••••••••••••••'}
                        </td>
                        <td className="text-xs text-zinc-400">{s.description || '—'}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleReveal(s.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title={isRevealed ? 'Hide' : 'Reveal'}
                            >
                              {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              onClick={() => copySecret(s.id, s.value)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Copy value"
                            >
                              {copiedId === s.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      <PremiumDialog isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="New Secret Entry">
        <div className="space-y-4">
          <PremiumInput
            label="Secret Key Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. DATABASE_URL or OPENAI_API_KEY"
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Type
            </label>
            <select
              value={form.secret_type}
              onChange={(e) => setForm({ ...form, secret_type: e.target.value })}
              className="w-full h-10 px-3 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 text-zinc-900 dark:text-zinc-100"
            >
              {SECRET_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <PremiumInput
            type="password"
            label="Secret Value"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder="Paste secret value"
          />

          <PremiumInput
            label="Description (Optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What is this secret used for?"
          />

          <div className="flex justify-end gap-3 pt-3">
            <PremiumButton variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </PremiumButton>
            <PremiumButton variant="primary" isLoading={saving} onClick={handleSave}>
              Save Secret
            </PremiumButton>
          </div>
        </div>
      </PremiumDialog>
    </PageContainer>
  );
}
