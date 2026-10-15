import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }

    let active = true;
    client.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage('We could not restore your session. Please sign in again.');
        setSession(data.session);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Ducere: session restoration failed', error);
        setMessage('Could not reach the sign-in service. Check your connection and try again.');
        setLoading(false);
      });

    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!supabase) return <>{children}</>;
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0e101a] text-[#e9e1d6]" role="status">Loading Ducere…</div>;
  if (session) return <>{children}</>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');

    try {
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: window.location.origin },
          });

      if (result.error) {
        const normalized = result.error.message.toLowerCase();
        if (result.error.status === 429 || normalized.includes('rate limit') || normalized.includes('rate exceeded')) {
          setMessage('Too many attempts. Wait a little before trying again.');
        } else if (normalized.includes('email not confirmed')) {
          setMessage('Please confirm your email using the link in your inbox, then sign in.');
        } else if (normalized.includes('already registered')) {
          setMessage('This email is already registered. Switch to Sign in.');
        } else {
          setMessage(result.error.message);
        }
      } else if (mode === 'signup' && !result.data.session) {
        setMessage('Account created. Check your email to confirm your account, then sign in.');
      } else if (mode === 'signup') {
        setMessage('Account created. Welcome to Ducere.');
      }
    } catch (error) {
      console.error('Ducere: authentication request failed', error);
      setMessage('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e101a] p-6 text-[#e9e1d6]">
      <div className="w-full max-w-md rounded-2xl border border-[#292c3c] bg-[#171a27] p-7 shadow-2xl">
        <div className="mb-8">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[#df8265]">Your cinema</p>
          <h1 className="mt-2 font-display text-4xl">ducere</h1>
          <p className="mt-3 text-sm leading-6 text-[#9697a6]">Sign in to keep your watch history, watchlist and progress synced across devices.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs text-[#c7c0b7]">Email</span>
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="h-11 w-full rounded-xl border border-[#303347] bg-[#10121d] px-4 text-sm outline-none focus:border-[#c66f58]" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs text-[#c7c0b7]">Password</span>
            <input required minLength={6} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (6+ characters)" className="h-11 w-full rounded-xl border border-[#303347] bg-[#10121d] px-4 text-sm outline-none focus:border-[#c66f58]" />
          </label>
          {message && <p role="status" aria-live="polite" className="rounded-lg border border-[#4a3940] bg-[#211b25] px-3 py-2.5 text-xs leading-5 text-[#c7bfb2]">{message}</p>}
          <button disabled={busy} className="h-11 w-full rounded-xl bg-[#e47a58] font-bold text-[#211923] disabled:cursor-wait disabled:opacity-60">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }} className="mt-6 text-xs font-semibold text-[#d7a08d] hover:text-[#f0b29b]">
          {mode === 'signin' ? 'New to Ducere? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </main>
  );
}
