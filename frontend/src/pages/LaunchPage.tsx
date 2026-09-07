import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zipSync } from 'fflate';
import { UploadCloud, GitBranch, Bot, Plus, Rocket, RotateCcw, FolderOpen, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import './LaunchPage.css';

type Plan = { runtime: string; port: number; required: string[]; warnings: string[]; blockers: string[]; files: number; dockerfile: string };
type Project = { id: string; name: string };
type Revision = { id: string; plan: Plan; created_at: string };
type Deployment = { id: string; status: string; environment: string; url: string; message: string; created_at: string; updated_at: string };
type Detail = { environment_keys: string[]; revisions: Revision[]; deployments: Deployment[] };
type Event = { id: number; message: string; created_at: string };
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/launch${path}`, { credentials: 'include', ...options });
  if (!response.ok) { const data = await response.json().catch(() => ({})) as { detail?: string }; throw new Error(data.detail ?? `Request failed (${response.status})`); }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
function json(method: string, body: unknown): RequestInit { return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
const busyStates = new Set(['queued', 'building', 'deploying']);

export function LaunchPage() {
  const qc = useQueryClient(); const user = useAuthStore(s => s.user);
  const [projectId, setProjectId] = useState(''); const [name, setName] = useState('');
  const [tab, setTab] = useState<'upload' | 'github' | 'agent'>('upload');
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [repository, setRepository] = useState(''); const [ref, setRef] = useState('HEAD');
  const [envKey, setEnvKey] = useState(''); const [envValue, setEnvValue] = useState('');
  const [port, setPort] = useState(''); const [eventsId, setEventsId] = useState(''); const [agentKey, setAgentKey] = useState('');
  const [confirmation, setConfirmation] = useState<{ environment: string; rollback?: string } | null>(null);
  const projects = useQuery({ queryKey: ['launch-projects', user?.id], queryFn: () => api<{ projects: Project[] }>('/projects'), enabled: !!user });
  const status = useQuery({ queryKey: ['launch-status', user?.id], queryFn: () => api<{ worker_online: boolean }>('/status'), refetchInterval: 10000, enabled: !!user });
  const detail = useQuery({ queryKey: ['launch-project', user?.id, projectId], queryFn: () => api<Detail>(`/projects/${projectId}`), enabled: !!projectId && !!user, refetchInterval: 4000 });
  const events = useQuery({ queryKey: ['launch-events', user?.id, projectId, eventsId], queryFn: () => api<{ events: Event[] }>(`/projects/${projectId}/deployments/${eventsId}/events`), enabled: !!user && !!projectId && !!eventsId, refetchInterval: 4000 });
  const revision = detail.data?.revisions[0]; const selected = projects.data?.projects.find(p => p.id === projectId);
  const missing = revision?.plan.required.filter(k => !detail.data?.environment_keys.includes(k)) ?? [];
  const pending = detail.data?.deployments.some(d => busyStates.has(d.status));
  async function action(label: string, fn: () => Promise<void>) {
    setBusy(label); setError(''); setNotice('');
    try { await fn(); await qc.invalidateQueries({ queryKey: ['launch-project'] }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Try again.'); }
    finally { setBusy(''); }
  }
  function choose(id: string) { setProjectId(id); setEventsId(''); setPort(''); setError(''); setNotice(''); setConfirmation(null); }
  async function create() {
    await action('Creating project', async () => { const result = await api<Project>('/projects', json('POST', { name })); await qc.invalidateQueries({ queryKey: ['launch-projects'] }); choose(result.id); setName(''); });
  }
  async function upload(file: Blob) {
    if (file.size > 32 * 1024 * 1024) throw new Error('ZIP must be smaller than 32 MB. Remove dependencies and generated files.');
    await api(`/projects/${projectId}/sources`, { method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: file });
    setPort(''); setNotice('Source saved. Review the launch checks below.');
  }
  async function folder(files: FileList) {
    const list = Array.from(files);
    await action('Preparing your folder', async () => {
      const archive: Record<string, Uint8Array> = {}; let total = 0;
      for (const file of list) {
        const path = file.webkitRelativePath || file.name;
        if (path.split('/').some(p => ['node_modules', '.git', '.venv', '__MACOSX'].includes(p))) continue;
        total += file.size;
        if (total > 128 * 1024 * 1024 || Object.keys(archive).length >= 5000) throw new Error('Folder is too large. Remove generated files and dependencies.');
        archive[path] = new Uint8Array(await file.arrayBuffer());
      }
      const zipped = zipSync(archive, { level: 1 });
      await upload(new Blob([new Uint8Array(zipped).buffer], { type: 'application/zip' }));
    });
  }
  async function deploy(environment: string, rollback?: string) {
    if (!revision) return;
    await action('Queuing deployment', async () => {
      const result = await api<{ id: string }>(`/projects/${projectId}/deployments`, { ...json('POST', { revision_id: revision.id, environment, port: Number(port || revision.plan.port), confirmed: environment === 'production', rollback_id: rollback ?? '' }), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() } });
      setEventsId(result.id); setNotice('Deployment queued. You can return later to see its saved progress.');
    });
    setConfirmation(null);
  }
  const blocked = !!busy || !!pending || !status.data?.worker_online || !revision || revision.plan.blockers.length > 0 || missing.length > 0;
  return <div className="launch">
    <header className="launch-header"><div><div className="launch-eyebrow">MERIDIAN · EARLY ACCESS</div><h1>From your code to your first launch.</h1><p>Bring a project folder, a repository, or your coding agent. Keep every version in one place.</p></div><span className={`launch-status ${status.data?.worker_online ? 'online' : ''}`}><span />{status.data?.worker_online ? 'Hosting connected' : 'Hosting not connected'}</span></header>
    {!user && <div className="launch-notice">Sign in with an email account to save projects and deploy. Demo mode does not upload or run code.</div>}
    {(error || projects.error || detail.error || status.error) && <div role="alert" className="launch-error">{error || projects.error?.message || detail.error?.message || status.error?.message}</div>}
    {notice && <div role="status" className="launch-notice"><CheckCircle2 size={18} />{notice}</div>}
    <div className="launch-layout">
      <aside className="launch-projects"><h2>Your projects</h2><form onSubmit={e => { e.preventDefault(); void create(); }}><label htmlFor="project-name">New project name</label><div className="launch-inline"><input id="project-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="My first app" required /><button disabled={!!busy || !user || !name.trim()} aria-label="Create project"><Plus size={18} /></button></div></form>
        {projects.isLoading && <p>Loading projects…</p>}{projects.data?.projects.length === 0 && <p className="launch-muted">Create a project to get started. GitHub is optional.</p>}
        {projects.data?.projects.map(p => <button disabled={!!busy} key={p.id} className={`launch-project ${p.id === projectId ? 'selected' : ''}`} onClick={() => choose(p.id)}><FolderOpen size={17} /><span>{p.name}</span></button>)}
        <div className="launch-footnote">Each project has a preview and a production URL. Preview apps are public; use test data and test API keys.</div>
      </aside>
      <section className="launch-main">
        {!projectId ? <div className="launch-welcome"><Rocket size={42} /><h2>Your next idea starts here.</h2><p>Create a project on the left. Upload your source, review what it needs, and launch a preview before publishing.</p><div className="launch-tags"><span>Node.js</span><span>Python</span><span>Go</span><span>Static sites</span><span>Dockerfile</span></div></div> : <>
          <div className="launch-title"><h2>{selected?.name}</h2>{busy && <span role="status">{busy}…</span>}</div>
          <div className="launch-tabs" role="tablist" aria-label="Import source">{([{ key: 'upload', title: 'Upload project', icon: <UploadCloud size={18} /> }, { key: 'github', title: 'Import GitHub', icon: <GitBranch size={18} /> }, { key: 'agent', title: 'Coding agent', icon: <Bot size={18} /> }] as const).map(t => <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'active' : ''}>{t.icon}{t.title}</button>)}</div>
          <div className="launch-card" role="tabpanel">
            {tab === 'upload' && <><div className="launch-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !busy) void action('Uploading project', () => upload(f)); }}><UploadCloud size={32} /><h3>Bring the code you already have.</h3><p>Choose a ZIP or project folder. No Git commands needed.</p><div className="launch-actions"><label className="launch-file">Choose ZIP<input type="file" accept=".zip,application/zip" disabled={!!busy} onChange={e => { const f = e.target.files?.[0]; if (f) void action('Uploading project', () => upload(f)); e.target.value = ''; }} /></label><label className="launch-file">Choose folder<input type="file" multiple {...{ webkitdirectory: '' }} disabled={!!busy} onChange={e => { if (e.target.files) void folder(e.target.files); e.target.value = ''; }} /></label></div></div><p className="launch-muted">Up to 32 MB compressed. Remove .env files and private keys; add secrets below. Folder uploads exclude Git history and dependency folders.</p></>}
            {tab === 'github' && <form onSubmit={e => { e.preventDefault(); void action('Importing repository', async () => { await api(`/projects/${projectId}/github`, json('POST', { repository, ref })); setPort(''); setNotice('Repository snapshot saved. Review your launch checks.'); }); }}><h3>Import a public repository</h3><p>Imports a source snapshot. For private code, upload a ZIP or use your coding agent. Automatic push deployments are not enabled yet.</p><label htmlFor="repo">Repository</label><input id="repo" value={repository} onChange={e => setRepository(e.target.value)} placeholder="https://github.com/you/your-app" required /><label htmlFor="git-ref">Branch or commit</label><input id="git-ref" value={ref} onChange={e => setRef(e.target.value)} /><button className="launch-primary" disabled={!!busy}>Import project</button></form>}
            {tab === 'agent' && <><h3>Deploy straight from your editor</h3><p>The MCP bridge uploads a local folder, inspects launch checks and deploys a preview. Publish production here after reviewing it.</p><ol><li>Install the bridge from this repository’s <code>mcp/</code> directory.</li><li>Create an access key and add the connection settings to your editor.</li><li>Ask your agent to upload your project and deploy a preview.</li></ol><div className="launch-actions"><button disabled={!!busy} onClick={() => void action('Creating agent key', async () => { const key = await api<{ key: string }>('/agent-keys', json('POST', {})); setAgentKey(key.key); })}>Create 30-day access key</button><button disabled={!!busy} onClick={() => void action('Revoking agent access', async () => { await api('/agent-keys', { method: 'DELETE' }); setAgentKey(''); setNotice('All agent keys revoked.'); })}>Revoke all agent keys</button></div>{agentKey && <div><label htmlFor="agent-key">Copy now. This key grants access to your projects and is shown only once.</label><input id="agent-key" readOnly value={agentKey} type="password" /><button onClick={() => void action('Copying key', async () => { await navigator.clipboard.writeText(agentKey); setNotice('Agent key copied.'); })}>Copy key</button></div>}<details><summary>Connection settings</summary><pre>{JSON.stringify({ mcpServers: { meridian: { command: 'node', args: ['/absolute/path/to/InfraPilot/mcp/server.mjs'], env: { MERIDIAN_URL: window.location.origin, MERIDIAN_AGENT_KEY: '<your access key>', MERIDIAN_WORKSPACE: '/absolute/path/to/your/project' } } } }, null, 2)}</pre></details></>}
          </div>
          {detail.isLoading && <p>Loading project…</p>}
          {revision && <div className="launch-card"><div className="launch-title"><h3>Launch check</h3><span className="launch-pill">{revision.plan.runtime} · {revision.plan.files} files</span></div><p className="launch-muted">Saved {new Date(revision.created_at).toLocaleString()} · version {detail.data?.revisions.length}</p>
            {revision.plan.blockers.map(b => <p key={b} className="launch-error">{b}</p>)}{missing.length > 0 && <p className="launch-error">Add these variables before launch: {missing.join(', ')}</p>}
            {revision.plan.blockers.length === 0 && missing.length === 0 && <p className="launch-good">Source checks passed. Build and runtime checks happen during deployment.</p>}
            <details><summary>Build details and limitations</summary>{revision.plan.warnings.map(w => <p key={w}>{w}</p>)}<p>The app must return HTTP 200–399 at /. Container files are temporary; use an external database or storage for persistent data.</p><pre>{revision.plan.dockerfile}</pre></details>
            <label htmlFor="port">Application port</label><input id="port" type="number" min={1024} max={65535} value={port || revision.plan.port} onChange={e => setPort(e.target.value)} />
            <div className="launch-actions"><button className="launch-primary" disabled={blocked} onClick={() => void deploy('preview')}><Rocket size={16} />Deploy preview</button><button disabled={blocked} onClick={() => setConfirmation({ environment: 'production' })}>Publish production</button></div>
            {!status.data?.worker_online && <p className="launch-muted">Source is saved. The hosting operator must connect the worker before apps can launch.</p>}
          </div>}
          <div className="launch-card"><h3>Environment variables</h3><p>Add an existing database connection string or API key. Values are encrypted and never returned. Changes apply to future deployments, including previews.</p><div className="launch-tags">{detail.data?.environment_keys.map(k => <span key={k}>{k}<button disabled={!!busy} aria-label={`Remove ${k}`} onClick={() => void action('Removing variable', async () => { await api(`/projects/${projectId}/environment`, json('PUT', { values: {}, remove: [k] })); })}>×</button></span>)}</div><form className="launch-env" onSubmit={e => { e.preventDefault(); void action('Saving variable', async () => { await api(`/projects/${projectId}/environment`, json('PUT', { values: { [envKey]: envValue }, remove: [] })); setEnvKey(''); setEnvValue(''); setNotice('Variable saved. Deploy a new release to apply it.'); }); }}><div><label htmlFor="env-key">Name</label><input id="env-key" value={envKey} onChange={e => setEnvKey(e.target.value)} placeholder="DATABASE_URL" pattern="[A-Za-z_][A-Za-z0-9_]*" required /></div><div><label htmlFor="env-value">Value</label><input id="env-value" type="password" value={envValue} onChange={e => setEnvValue(e.target.value)} autoComplete="off" required /></div><button disabled={!!busy}>Save</button></form></div>
          <div className="launch-card"><h3>Deployment history</h3><p>Restoring a release restores its image and configuration. It does not undo database changes.</p>{detail.data?.deployments.length === 0 && <p className="launch-muted">Your first deployment will appear here.</p>}{detail.data?.deployments.map(d => <div className="launch-deployment" key={d.id}><div><span className={`launch-pill state-${d.status}`}>{d.status}</span> <strong>{d.environment}</strong><p className="launch-muted">{new Date(d.created_at).toLocaleString()} · {d.id.slice(0, 8)}</p>{d.message && <p>{d.message}</p>}</div><div className="launch-actions">{d.url && <a href={d.url} target="_blank" rel="noreferrer">Visit app ↗</a>}<button onClick={() => setEventsId(eventsId === d.id ? '' : d.id)}>Progress</button>{d.status === 'queued' && <button disabled={!!busy} onClick={() => void action('Cancelling deployment', async () => { await api(`/projects/${projectId}/deployments/${d.id}/cancel`, json('POST', {})); })}>Cancel</button>}{d.status === 'healthy' && <button disabled={!!busy || !!pending || !status.data?.worker_online} onClick={() => setConfirmation({ environment: d.environment, rollback: d.id })}><RotateCcw size={14} />Restore</button>}</div></div>)}
            {eventsId && <div className="launch-events"><h4>Saved progress · {eventsId.slice(0, 8)}</h4>{events.error && <p role="alert">{events.error.message}</p>}{events.data?.events.length === 0 && <p>Waiting for worker…</p>}{events.data?.events.slice().reverse().map(e => <div key={e.id}><time>{new Date(e.created_at).toLocaleTimeString()}</time><pre>{e.message}</pre></div>)}</div>}
          </div>
        </>}
      </section>
    </div>
    {confirmation && <div className="launch-overlay"><section role="dialog" aria-modal="true" aria-labelledby="publish-title" className="launch-dialog"><h2 id="publish-title">{confirmation.rollback ? 'Restore this release?' : 'Publish your application?'}</h2><p>This changes the public {confirmation.environment} URL after the app passes its readiness check. {confirmation.rollback ? 'Saved variables are restored too. Database changes are not reversed.' : 'Review your preview and API keys first.'}</p><div className="launch-actions"><button autoFocus onClick={() => setConfirmation(null)}>Keep current release</button><button className="launch-primary" disabled={!!busy} onClick={() => void deploy(confirmation.environment, confirmation.rollback)}>{confirmation.rollback ? 'Restore release' : 'Publish production'}</button></div></section></div>}
  </div>;
}
