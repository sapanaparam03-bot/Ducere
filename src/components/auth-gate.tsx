import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        if (window.location.hash.includes('type=recovery')) setMode('reset');
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Ducere: session restoration failed', error);
        setMessage('Could not reach the sign-in service. Check your connection and try again.');
        setLoading(false);
      });

    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
        setMessage('Choose a new password for your Ducere account.');
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!supabase) return <>{children}</>;
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0e101a] text-[#e9e1d6]" role="status">Loading Ducere…</div>;
  if (session && mode !== 'reset') return <>{children}</>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) setMessage(error.message);
        else setMessage('If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.');
      } else if (mode === 'reset') {
        if (password.length < 8) {
          setMessage('Use at least 8 characters for your new password.');
          return;
        }
        if (password !== confirmPassword) {
          setMessage('The passwords do not match. Please try again.');
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) setMessage(error.message);
        else {
          setMessage('Your password has been updated. You can continue to Ducere.');
          setPassword('');
          setConfirmPassword('');
          window.history.replaceState(null, document.title, window.location.pathname);
          setMode('signin');
          await supabase.auth.signOut();
        }
      } else {
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
      }
    } catch (error) {
      console.error('Ducere: authentication request failed', error);
      setMessage('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === 'signup' ? 'Create your Ducere account.' : mode === 'forgot' ? 'Reset your password.' : mode === 'reset' ? 'Choose a new password.' : 'Sign in to Ducere.';
  const description = mode === 'signup'
    ? 'Start with your email and password. We’ll ask your name after you sign in.'
    : mode === 'forgot'
      ? 'Enter the email address linked to your Ducere account. We’ll send a secure reset link.'
      : mode === 'reset'
        ? 'Choose a new password to get back to your watch history and library.'
        : 'Sign in to keep your watch history, watchlist and progress synced across devices.';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e101a] p-6 text-[#e9e1d6]">
      <div className="w-full max-w-md rounded-2xl border border-[#292c3c] bg-[#171a27] p-7 shadow-2xl">
        <div className="mb-8">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[#df8265]">Your cinema</p>
          <h1 className="mt-2 font-display text-4xl">ducere</h1>
          <p className="mt-3 text-sm leading-6 text-[#9697a6]">{description}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode !== 'reset' && (
            <label className="block">
              <span className="mb-2 block text-xs text-[#c7c0b7]">Email</span>
              <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="h-11 w-full rounded-xl border border-[#303347] bg-[#10121d] px-4 text-sm outline-none focus:border-[#c66f58]" />
            </label>
          )}
          {mode !== 'forgot' && (
            <label className="block">
              <span className="mb-2 block text-xs text-[#c7c0b7]">{mode === 'reset' ? 'New password' : 'Password'}</span>
              <input required minLength={mode === 'reset' ? 8 : 6} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'reset' ? 'At least 8 characters' : 'Password (6+ characters)'} className="h-11 w-full rounded-xl border border-[#303347] bg-[#10121d] px-4 text-sm outline-none focus:border-[#c66f58]" />
            </label>
          )}
          {mode === 'reset' && (
            <label className="block">
              <span className="mb-2 block text-xs text-[#c7c0b7]">Confirm new password</span>
              <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the new password again" className="h-11 w-full rounded-xl border border-[#303347] bg-[#10121d] px-4 text-sm outline-none focus:border-[#c66f58]" />
            </label>
          )}
          {message && <p role="status" aria-live="polite" className="rounded-lg border border-[#4a3940] bg-[#211b25] px-3 py-2.5 text-xs leading-5 text-[#c7bfb2]">{message}</p>}
          <button disabled={busy} className="h-11 w-full rounded-xl bg-[#e47a58] font-bold text-[#211923] disabled:cursor-wait disabled:opacity-60">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}</button>
        </form>
        <div className="mt-6 flex flex-col items-start gap-3 text-xs font-semibold text-[#d7a08d]">
          {mode === 'signin' && <button type="button" onClick={() => { setMode('forgot'); setMessage(''); }} className="hover:text-[#f0b29b]">Forgot password?</button>}
          {mode === 'forgot' && <button type="button" onClick={() => { setMode('signin'); setMessage(''); }} className="hover:text-[#f0b29b]">Back to sign in</button>}
          {mode === 'reset' && <button type="button" onClick={() => { setMode('signin'); setMessage(''); }} className="hover:text-[#f0b29b]">Back to sign in</button>}
          {(mode === 'signin' || mode === 'signup') && (
            <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }} className="hover:text-[#f0b29b]">
              {mode === 'signin' ? 'New to Ducere? Create an account' : 'Already have an account? Sign in'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
