import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAuthStore } from '../../store/authStore';

interface Props {
  children: React.ReactNode;
}

export function AppLayout({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const queryClient = useQueryClient();
  const { isDemoMode, logout } = useAuthStore();
  const navigate = useNavigate();

  async function exitDemo() {
    setSigningOut(true);
    setSignOutError('');
    try {
      await logout();
      queryClient.clear();
      navigate('/login', { replace: true });
    } catch {
      setSignOutError('Could not sign out. Check your connection and try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Demo mode banner */}
      {isDemoMode && (
        <div style={{
          background: 'var(--warning-bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: '6px 16px', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>
            👁 Demo Mode — sandbox environment (simulated cluster data)
          </span>
          <button
            type="button"
            onClick={() => navigate('/signup')}
            style={{
              fontSize: 11, fontWeight: 500, color: '#fff',
              background: 'var(--warning)', border: 'none',
              borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            }}
          >
            Sign up free
          </button>
          <button
            type="button"
            onClick={exitDemo}
            style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Exit demo
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {import.meta.env.VITE_ENABLE_LEGACY === 'true' ? <TopBar /> : <header style={{display:'flex',justifyContent:'space-between',padding:'14px 24px',borderBottom:'1px solid var(--border)',color:'var(--text-secondary)',fontSize:13}}><span>Workspace / Projects</span><button disabled={signingOut} onClick={() => void exitDemo()} style={{background:'none',border:0,color:'var(--text-secondary)',cursor:'pointer'}}>{signingOut ? 'Signing out…' : 'Sign out'}</button></header>}
          {signOutError && <p role="alert" style={{color:'var(--danger)',padding:'0 24px'}}>{signOutError}</p>}
          <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg-elevated)' }}>{children}</main>
        </div>
      </div>
    </div>
  );
}
