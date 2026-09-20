import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Film, Loader2 } from 'lucide-react';

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setMessage('Ducere is not connected to its backend yet.');
      return;
    }
    setBusy(true);
    setMessage('');

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { username: username.trim() || 'Viewer' },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        const message = error.message.toLowerCase();
        if (error.status === 429 || message.includes('rate limit') || message.includes('rate exceeded')) {
          setMessage('Supabase has temporarily rate-limited confirmation emails. Your signup may already exist; check your inbox/spam before trying again.');
        } else if (message.includes('already registered')) {
          setMessage('This email is already registered. Switch to Sign in.');
        } else {
          setMessage(error.message);
        }
      } else if (!data.session) {
        setMessage('Account created. Check your email to confirm your account, then sign in.');
      } else {
        setMessage('Account created. Welcome to Ducere.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes('email not confirmed')) {
          setMessage('Your account exists, but the email is not confirmed yet. Check your confirmation email.');
        } else {
          setMessage(error.message);
        }
      }
    }
    setBusy(false);
  };

  return (
    <div className="film-grain min-h-[100dvh] bg-[#0d0f18] px-5 py-10 text-[#e9e1d6]">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[22px] border border-[#2d3040] bg-[#151722] shadow-2xl md:grid-cols-[1.05fr_.95fr]">
          <div className="hidden min-h-[620px] flex-col justify-between bg-[radial-gradient(circle_at_70%_25%,rgba(228,122,88,.25),transparent_35%),linear-gradient(145deg,#211e2b,#10121d)] p-10 md:flex">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e47a58] text-[#17151f]"><Film size={19} /></span>
              <span className="font-display text-2xl">ducere</span>
            </div>
            <div>
              <p className="mb-4 font-mono-ui text-[10px] uppercase tracking-[.24em] text-[#df8265]">Your private cinema</p>
              <h1 className="font-display text-6xl leading-[.92] tracking-[-.05em]">Your stories.<br /><span className="text-[#e47a58]">One place.</span></h1>
              <p className="mt-6 max-w-md text-sm leading-6 text-[#9a9baa]">Track what you watched, what you want to watch, what you are watching now, and where to watch it.</p>
            </div>
            <p className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[#626577]">Ducere · personal viewing archive</p>
          </div>

          <div className="flex min-h-[620px] flex-col justify-center p-6 sm:p-10">
            <div className="mb-8 md:hidden">
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e47a58] text-[#17151f]"><Film size={17} /></span><span className="font-display text-2xl">ducere</span></div>
            </div>
            <p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-[#df8265]">{mode === 'signin' ? 'Welcome back' : 'Start your archive'}</p>
            <h2 className="mt-2 font-display text-4xl tracking-[-.04em] text-[#f0e7da]">{mode === 'signin' ? 'Sign in to Ducere.' : 'Create your Ducere account.'}</h2>
            <p className="mt-3 text-sm leading-6 text-[#858796]">{mode === 'signin' ? 'Your library follows your account across devices.' : 'Your watch history and queue will be stored securely in your account.'}</p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode === 'signup' && <label className="block"><span className="mb-2 block text-xs font-semibold text-[#c1b9b5]">Name</span><input required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="name" className="h-11 w-full rounded-lg border border-[#353747] bg-[#10121d] px-3 text-sm outline-none focus:border-[#d17459]" placeholder="Viewer" /></label>}
              <label className="block"><span className="mb-2 block text-xs font-semibold text-[#c1b9b5]">Email</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-11 w-full rounded-lg border border-[#353747] bg-[#10121d] px-3 text-sm outline-none focus:border-[#d17459]" placeholder="you@example.com" /></label>
              <label className="block"><span className="mb-2 block text-xs font-semibold text-[#c1b9b5]">Password</span><input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className="h-11 w-full rounded-lg border border-[#353747] bg-[#10121d] px-3 text-sm outline-none focus:border-[#d17459]" placeholder="At least 6 characters" /></label>
              {message && <p role="status" className="rounded-lg border border-[#4a3940] bg-[#211b25] px-3 py-2.5 text-xs leading-5 text-[#d5b9ae]">{message}</p>}
              <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#e47a58] text-xs font-bold text-[#211923] disabled:cursor-wait disabled:opacity-70">{busy && <Loader2 size={15} className="animate-spin" />}{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
            </form>

            <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }} className="mt-6 text-center text-xs font-semibold text-[#bd8a78] hover:text-[#eda07f]">
              {mode === 'signin' ? 'New to Ducere? Create an account' : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
