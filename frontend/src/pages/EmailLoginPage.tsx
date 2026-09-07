import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../store/authStore';
import './LaunchPage.css';

export function EmailLoginPage() {
 const [email,setEmail]=useState(''); const [code,setCode]=useState(''); const [sent,setSent]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 const login=useAuthStore(s=>s.login); const navigate=useNavigate();
 async function submit(){setBusy(true);setError('');try{const r=await fetch(sent?'/api/auth/otp/verify':'/api/auth/otp/send',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(sent?{contact:email,code}:{contact:email})});const d=await r.json() as {detail?:string;user?:AuthUser};if(!r.ok)throw new Error(d.detail??'Could not sign in');if(sent&&d.user){login(d.user);navigate('/app/projects')}else setSent(true)}catch(e){setError(e instanceof Error?e.message:'Could not sign in')}finally{setBusy(false)}}
 return <main className="launch" style={{maxWidth:470,paddingTop:'12vh'}}><Link to="/">← Meridian</Link><div className="launch-card" style={{marginTop:24}}><div className="launch-eyebrow">YOUR NEXT LAUNCH STARTS HERE</div><h1>Just your email.</h1><p>{sent?'Enter the six-digit code sent to your inbox.':'Sign in or create an account. No GitHub account or password required.'}</p><form onSubmit={e=>{e.preventDefault();void submit()}}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={sent||busy} onChange={e=>setEmail(e.target.value)} />{sent&&<><label htmlFor="otp">Verification code</label><input id="otp" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} autoFocus /></>}{error&&<p role="alert" className="launch-error">{error}</p>}<button className="launch-primary" disabled={busy}>{busy?'Please wait…':sent?'Continue to Meridian':'Email me a sign-in code'}</button></form>{sent&&<button disabled={busy} onClick={()=>{setSent(false);setCode('');setError('')}} style={{marginTop:16}}>Change email or send another code</button>}</div></main>;
}
