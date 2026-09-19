import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  if (!supabase) return <>{children}</>;
  if (loading) return <div className="min-h-screen bg-[#0e101a] text-[#e9e1d6] flex items-center justify-center">Loading Ducere…</div>;
  if (session) return <>{children}</>;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    const result = mode === 'signin' ? await supabase.auth.signInWithPassword({ email: email.trim(), password }) : await supabase.auth.signUp({ email: email.trim(), password });
    if (result.error) setMessage(result.error.message); else setMessage(mode === 'signup' ? 'Account created. Check your email if confirmation is required.' : 'Signed in.');
    setBusy(false);
  };
  return <main className="min-h-screen bg-[#0e101a] text-[#e9e1d6] flex items-center justify-center p-6"><div className="w-full max-w-md rounded-2xl border border-[#292c3c] bg-[#171a27] p-7 shadow-2xl"><div className="mb-8"><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[#df8265]">Your cinema</p><h1 className="mt-2 font-display text-4xl">ducere</h1><p className="mt-3 text-sm leading-6 text-[#9697a6]">Sign in to keep your watch history, watchlist and progress synced across devices.</p></div><form onSubmit={submit} className="space-y-4"><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="h-11 w-full rounded-xl border border-[#303347] bg-[#10121d] px-4 text-sm outline-none focus:border-[#c66f58]" /><input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (6+ characters)" className="h-11 w-full rounded-xl border border-[#303347] bg-[#10121d] px-4 text-sm outline-none focus:border-[#c66f58]" /><button disabled={busy} className="h-11 w-full rounded-xl bg-[#e47a58] font-bold text-[#211923] disabled:opacity-60">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button></form>{message && <p className="mt-4 text-xs leading-5 text-[#c7bfb2]">{message}</p>}<button type="button" onClick={()=>{setMode(mode==='signin'?'signup':'signin');setMessage('');}} className="mt-6 text-xs font-semibold text-[#d7a08d] hover:text-[#f0b29b]">{mode === 'signin' ? 'New to Ducere? Create an account' : 'Already have an account? Sign in'}</button></div></main>;
}
