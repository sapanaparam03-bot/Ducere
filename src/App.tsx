import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { AuthScreen } from '@/components/auth-screen';
import { useDucere } from '@/hooks/use-ducere';
import { useCatalog } from '@/hooks/use-catalog';
import { coverArt, formatStatus, titleById, TITLES, type Title, type TitleType, type UserStatus, type UserTitle } from '@/lib/ducere';
import {
  ArrowRight, Bookmark, Check, ChevronDown, ChevronRight, CirclePlay, Compass, Film,
  History, Home, Library, MapPin, Moon, MoreHorizontal, PlayCircle, RotateCcw, Search,
  Settings, SlidersHorizontal, Sparkles, Star, Trash2, UserRound, CheckCircle2, Download, Upload, CalendarDays
} from 'lucide-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { supabase } from '@/lib/supabase';
import { getTitleMetadata, resolvePosterFallback } from '@/lib/title-metadata';
import { SUBSCRIPTION_PROVIDERS, providerKeyForName } from '@/lib/providers';
import { CalendarPage } from '@/components/calendar-page';
import { LegalPage } from '@/components/legal-page';
import { rankRecommendations, calculateViewingMinutes } from '@/lib/personalization';
import { AchievementPanel } from '@/components/achievement-panel';
import { downloadDucereBackup, downloadDucereCsv, formatImportSummary, importCsvText, parseDucereBackup } from '@/lib/archive-transfer';


function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i], next = text[i + 1]; if (ch === '"' && quoted && next === '"') { cell += '"'; i++; } else if (ch === '"') quoted = !quoted; else if (ch === ',' && !quoted) { row.push(cell); cell = ''; } else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && next === '\n') i++; row.push(cell); if (row.some((v) => v.trim())) rows.push(row); row = []; cell = ''; } else cell += ch; }
  if (cell || row.length) { row.push(cell); if (row.some((v) => v.trim())) rows.push(row); }
  const headers = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()])));
}
const normalizeImportTitle = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const importRows = (rows: Record<string, string>[], catalog: Title[]) => {
  const byName = new Map(catalog.map((title) => [normalizeImportTitle(title.name), title]));
  return rows.flatMap((row) => {
    const rawName = row['title'] || row['name'] || row['title name'] || row['anime title'] || '';
    const title = byName.get(normalizeImportTitle(rawName));
    if (!title) return [];
    const rawStatus = (row['status'] || '').toLowerCase();
    const watched = rawStatus.includes('completed') || rawStatus.includes('watched') || Boolean(row['watched date'] || row['date watched'] || row['date rated']);
    const watching = rawStatus.includes('watching') || rawStatus.includes('currently watching');
    const status: UserStatus = watching ? 'watching' : watched ? 'watched' : 'watchlist';
    const ratingValue = Number(row['your rating'] || row['score'] || row['rating'] || '');
    const episodeValue = Number(row['episodes watched'] || row['episodes watched'] || '');
    return [{ titleId: title.id, status, dateAdded: row['date added'] || row['date'] || new Date().toISOString().slice(0, 10), ...(watched ? { dateWatched: row['watched date'] || row['date watched'] || row['date rated'] || undefined, progress: 100 } : {}), ...(Number.isFinite(ratingValue) && ratingValue > 0 ? { rating: Math.max(1, Math.min(5, Math.round(ratingValue / 2))) } : {}), ...(Number.isFinite(episodeValue) && episodeValue > 0 && title.type !== 'movie' ? { currentEpisode: Math.floor(episodeValue), currentSeason: 1, progress: watched ? 100 : undefined } : {}) } as UserTitle];
  });
};

const queryClient = new QueryClient();

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { href: '/watching', label: 'Watching', icon: PlayCircle },
  { href: '/history', label: 'History', icon: History },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
];

const typeTint: Record<TitleType, string> = {
  movie: 'from-[#5b263e] via-[#30263e] to-[#141a2a]',
  tv: 'from-[#163e49] via-[#272e48] to-[#15182a]',
  anime: 'from-[#5e3b26] via-[#38263b] to-[#17192b]',
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary>
            <DucereApp />
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function DucereApp() {
  const ducere = useDucere();
  const liveCatalog = useCatalog();

  if (!ducere.ready) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0d0f18] text-[#777989]">Loading your cinema…</div>;
  }

  if (!ducere.userId) {
    return <AuthScreen />;
  }

  if (!ducere.profile.onboardingComplete) {
    return <ProfileSetup profile={ducere.profile} onSave={ducere.updateProfile} />;
  }

  const shared = { ...ducere, catalog: liveCatalog.titles, catalogLoading: liveCatalog.loading, catalogError: liveCatalog.error };
  return (
    <div className="film-grain app-shell min-h-[100dvh]">
      <Shell profileName={ducere.profile.username} counts={ducere.counts} onSignOut={() => void supabase?.auth.signOut()} />
      <main className="min-h-[100dvh] pb-24 md:ml-[248px] md:pb-0">
        <Switch>
          <Route path="/" component={() => <HomePage {...shared} />} />
          <Route path="/discover" component={() => <DiscoverPageV2 {...shared} />} />
          <Route path="/library" component={() => <LibraryPage {...shared} />} />
          <Route path="/watchlist" component={() => <CollectionPage {...shared} status="watchlist" />} />
          <Route path="/watching" component={() => <CollectionPage {...shared} status="watching" />} />
          <Route path="/history" component={() => <HistoryPage {...shared} />} />
          <Route path="/calendar" component={() => <CalendarPage userTitles={shared.userTitles} catalog={shared.catalog} region={shared.profile.country} />} />
          <Route path="/title/:id" component={() => <TitleDetailsPage {...shared} />} />
          <Route path="/profile" component={() => <ProfilePage {...shared} />} />
          <Route path="/settings" component={() => <SettingsPageV3 {...shared} />} />
          <Route path="/privacy" component={() => <LegalPage kind="privacy" />} />
          <Route path="/terms" component={() => <LegalPage kind="terms" />} />
          <Route path="/about" component={() => <LegalPage kind="about" />} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function ProfileSetup({ profile, onSave }: { profile: DucereProps['profile']; onSave: (patch: Partial<DucereProps['profile']>) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    setBusy(true);
    onSave({ username: value, onboardingComplete: true });
    window.setTimeout(() => setBusy(false), 250);
  };

  return <div className="film-grain flex min-h-[100dvh] items-center justify-center bg-[#0d0f18] px-5 py-10 text-[#e9e1d6]">
    <div className="w-full max-w-lg rounded-[22px] border border-[#2d3040] bg-[#151722] p-7 shadow-2xl sm:p-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e47a58] text-[#17151f]"><Film size={19} /></span>
        <span className="font-display text-2xl">ducere</span>
      </div>
      <p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-[#df8265]">One small detail</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-.04em] text-[#f0e7da]">What should we call you?</h1>
      <p className="mt-3 text-sm leading-6 text-[#858796]">Your name will appear across your private cinema. You can change it later in Settings.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-[#c1b9b5]">Name</span>
          <input required autoFocus value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="h-12 w-full rounded-lg border border-[#353747] bg-[#10121d] px-3 text-sm outline-none focus:border-[#d17459]" placeholder="Your name" />
        </label>
        <button disabled={busy || !name.trim()} className="flex h-12 w-full items-center justify-center rounded-lg bg-[#e47a58] text-xs font-bold text-[#211923] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Saving…' : 'Continue to Ducere'}</button>
      </form>
    </div>
  </div>;
}

function Shell({ profileName, counts, onSignOut }: { profileName: string; counts: { watchlist: number; watching: number }; onSignOut: () => void }) {
  const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const [location, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) setLocation(`/discover?q=${encodeURIComponent(query.trim())}`);
  };
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r hairline bg-[#0e101a]/95 px-5 py-6 backdrop-blur-xl md:flex">
        <Link href="/" className="mb-12 flex items-center gap-3 px-2" data-testid="link-brand">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e47a58] text-[#17151f] shadow-[0_8px_22px_rgba(228,122,88,.23)]"><Film size={18} strokeWidth={2.4} /></span>
          <span className="font-display text-[25px] tracking-[-.03em] text-[#f3e9d5]">ducere</span>
        </Link>
        <nav className="space-y-1" aria-label="Primary navigation">
          <p className="mb-3 px-3 font-mono-ui text-[10px] uppercase tracking-[.22em] text-[#737689]">Your cinema</p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? location === '/' : location.startsWith(href);
            const count = label === 'Watchlist' ? counts.watchlist : label === 'Watching' ? counts.watching : undefined;
            return <Link key={href} href={href} className={`nav-link flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-semibold ${active ? 'bg-[#272231] text-[#f2dfc5]' : 'text-[#9293a3] hover:bg-[#191b28] hover:text-[#e8dece]'}`} data-testid={`link-nav-${label.toLowerCase()}`}>
              <span className="flex items-center gap-3"><Icon size={17} strokeWidth={active ? 2.25 : 1.8} /><span>{label}</span></span>
              {count ? <span className={`font-mono-ui text-[10px] ${active ? 'text-[#e47a58]' : 'text-[#6b6d7c]'}`}>{count}</span> : null}
            </Link>;
          })}
        </nav>
        <div className="mt-auto space-y-1">
          <Link href="/profile" className={`nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold ${location.startsWith('/profile') ? 'bg-[#272231] text-[#f2dfc5]' : 'text-[#9293a3] hover:bg-[#191b28]'}`} data-testid="link-nav-profile"><UserRound size={17} /><span>Profile</span></Link>
          <Link href="/settings" className={`nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold ${location.startsWith('/settings') ? 'bg-[#272231] text-[#f2dfc5]' : 'text-[#9293a3] hover:bg-[#191b28]'}`} data-testid="link-nav-settings"><Settings size={17} /><span>Settings</span></Link>
          <button onClick={onSignOut} className="nav-link flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-[#9293a3] hover:bg-[#191b28] hover:text-[#e8dece]" data-testid="button-sign-out"><Trash2 size={17} /><span>Sign out</span></button>
          <div className="mt-5 border-t hairline pt-5">
            <Link href="/profile" className="flex items-center gap-3 rounded-xl px-2 py-2" data-testid="link-sidebar-profile">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d5af71] font-display text-sm font-bold text-[#1b1820]">{profileName[0]}</span>
              <span className="min-w-0"><span className="block truncate text-xs font-bold text-[#e6dfd3]">{profileName}</span><span className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[#707284]">personal archive</span></span>
            </Link>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b hairline bg-[#0d0f18]/80 px-4 backdrop-blur-xl sm:px-7 md:ml-[248px] md:h-[78px] md:px-10">
        <div className="flex items-center gap-3 md:hidden"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e47a58] text-[#17151f]"><Film size={16} /></span><span className="font-display text-xl">ducere</span></div>
        <form onSubmit={submit} className="relative hidden max-w-[330px] flex-1 md:block" role="search">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6d6f82]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your cinema..." className="h-10 w-full rounded-xl border border-[#292c3c] bg-[#171a27] pl-10 pr-4 text-xs text-[#e9e1d5] outline-none transition placeholder:text-[#676a7a] focus:border-[#c66f58]" data-testid="input-global-search" />
          <kbd className="absolute right-3 top-2.5 rounded border border-[#36394a] px-1.5 py-0.5 font-mono-ui text-[9px] text-[#656878]">/</kbd>
        </form>
        <div className="flex items-center gap-2.5 md:ml-auto"><span className="hidden font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#676a7a] sm:block">{todayLabel}</span><Link href="/profile" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#404052] bg-[#d5af71] font-display text-sm font-bold text-[#1b1820]" data-testid="link-header-profile">{profileName[0]}</Link></div>
      </header>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-[72px] items-center justify-around border-t hairline bg-[#10121d]/95 px-2 backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
        {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-w-[54px] flex-col items-center gap-1 py-1 text-[10px] font-semibold ${location === href || (href !== '/' && location.startsWith(href)) ? 'text-[#e47a58]' : 'text-[#777989]'}`} data-testid={`link-mobile-${label.toLowerCase()}`}><Icon size={19} /><span>{label === 'Watchlist' ? 'Saved' : label}</span></Link>)}
        <Link href="/profile" className="flex min-w-[54px] flex-col items-center gap-1 py-1 text-[10px] font-semibold text-[#777989]" data-testid="link-mobile-profile"><UserRound size={19} /><span>Profile</span></Link>
      </nav>
    </>
  );
}

type DucereProps = ReturnType<typeof useDucere> & {
  catalog: Title[];
  catalogLoading?: boolean;
  catalogError?: string | null;
};

const findTitle = (catalog: Title[], id: string) => catalog.find((title) => title.id === id) ?? titleById(id);

const seriesProgress = (title: Title, season: number, episode: number) => {
  if (title.type === 'movie' || !title.episodes) return 0;
  const totalSeasons = Math.max(1, title.seasons ?? 1);
  const episodesPerSeason = Math.max(1, Math.ceil(title.episodes / totalSeasons));
  const safeSeason = Math.min(totalSeasons, Math.max(1, Math.floor(season)));
  const safeEpisode = Math.min(episodesPerSeason, Math.max(1, Math.floor(episode)));
  const completedEpisodes = Math.min(
    title.episodes,
    Math.max(0, ((safeSeason - 1) * episodesPerSeason) + safeEpisode - 1),
  );
  return Math.min(100, Math.round((completedEpisodes / title.episodes) * 100));
};

const episodeFromProgress = (title: Title, progress: number) => {
  if (title.type === 'movie' || !title.episodes) return undefined;
  const safeProgress = Math.max(0, Math.min(100, progress));
  if (safeProgress >= 100) {
    const totalSeasons = Math.max(1, title.seasons ?? 1);
    const episodesPerSeason = Math.max(1, Math.ceil(title.episodes / totalSeasons));
    const season = Math.min(totalSeasons, Math.floor((title.episodes - 1) / episodesPerSeason) + 1);
    const episode = ((title.episodes - 1) % episodesPerSeason) + 1;
    return { season, episode, progress: 100 };
  }
  const totalSeasons = Math.max(1, title.seasons ?? 1);
  const episodesPerSeason = Math.max(1, Math.ceil(title.episodes / totalSeasons));
  const completedEpisodes = Math.min(title.episodes - 1, Math.round((safeProgress / 100) * title.episodes));
  const nextEpisode = Math.max(1, completedEpisodes + 1);
  const season = Math.min(totalSeasons, Math.floor(completedEpisodes / episodesPerSeason) + 1);
  const episode = ((nextEpisode - 1) % episodesPerSeason) + 1;
  return { season, episode, progress: seriesProgress(title, season, episode) };
};

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.24em] text-[#df8265]">{eyebrow}</p><h1 className="font-display text-[clamp(2.4rem,5vw,4.8rem)] leading-[.94] tracking-[-.045em] text-[#f1e9dc]">{title}</h1>{description && <p className="mt-4 max-w-xl text-sm leading-6 text-[#9697a6]">{description}</p>}</div>{action}</div>;
}

function SectionHeading({ eyebrow, title, href, linkLabel = 'See all' }: { eyebrow?: string; title: string; href?: string; linkLabel?: string }) {
  return <div className="mb-4 flex items-end justify-between"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">{eyebrow}</p><h2 className="mt-1 text-lg font-bold tracking-[-.02em] text-[#e9e1d6]">{title}</h2></div>{href && <Link href={href} className="flex items-center gap-1 text-xs font-semibold text-[#bd8a78] transition hover:text-[#eda07f]" data-testid={`link-see-${title.toLowerCase().replaceAll(' ', '-')}`}>{linkLabel}<ArrowRight size={14} /></Link>}</div>;
}

const wikiImageCache = new Map<string, string | null>();

async function findWikipediaArtwork(title: string) {
  const key = title.trim().toLowerCase();
  if (wikiImageCache.has(key)) return wikiImageCache.get(key) ?? null;
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: title,
      gsrnamespace: '0',
      gsrlimit: '1',
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '600',
      format: 'json',
      origin: '*',
    });
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
    if (!response.ok) throw new Error('Wikipedia artwork request failed');
    const json = await response.json() as { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } };
    const source = Object.values(json.query?.pages ?? {})[0]?.thumbnail?.source ?? null;
    wikiImageCache.set(key, source);
    return source;
  } catch {
    wikiImageCache.set(key, null);
    return null;
  }
}

function PosterCard({ title, userTitle, onStatus }: { title: Title; userTitle?: DucereProps['userTitles'][number]; onStatus?: (status: UserStatus) => void }) {
  const [poster, setPoster] = useState(title.poster);
  const [broken, setBroken] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isCuratedSeries = title.type !== 'movie' && !title.id.startsWith('tvmaze-') && !title.id.startsWith('jikan-');
    const needsSourceArtwork = title.type === 'movie'
      ? title.poster.startsWith('data:')
      : isCuratedSeries;
    if (!needsSourceArtwork) return;

    const node = cardRef.current;
    if (!node) return;
    const load = () => {
      void resolvePosterFallback(title).then((source) => {
        if (source) setPoster(source);
      });
    };
    if (!('IntersectionObserver' in window)) {
      load();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: '300px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [title.id, title.name, title.poster, title.type]);

  const handleError = () => {
    void resolvePosterFallback(title).then((source) => {
      if (source && source !== poster) {
        setPoster(source);
        setBroken(false);
      } else {
        setBroken(true);
      }
    });
  };

  return <div ref={cardRef} className="poster-card min-w-0" data-testid={`card-title-${title.id}`}>
    <div className={`relative aspect-[2/3] overflow-hidden rounded-[10px] bg-gradient-to-br ${typeTint[title.type]} shadow-[0_8px_20px_rgba(0,0,0,.2)]`}>
      {!broken && <img
        src={poster}
        alt={`${title.name} poster`}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={handleError}
      />}
      {broken && <div className="absolute inset-0 flex flex-col justify-end p-4"><Film size={20} className="mb-auto text-white/35" /><p className="font-display text-xl leading-tight text-[#f2dfcf]">{title.name}</p><p className="mt-2 font-mono-ui text-[9px] uppercase tracking-[.16em] text-white/45">{title.releaseYear > 0 ? title.releaseYear : 'Catalog'} · {title.type}</p></div>}
      <div className="poster-overlay absolute inset-0 flex items-end bg-gradient-to-t from-[#10111a] via-transparent to-transparent p-3"><Link href={`/title/${title.id}`} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f2dfcf]/95 py-2 text-[11px] font-bold text-[#201b22]" data-testid={`link-open-title-${title.id}`}><MoreHorizontal size={14} /> View title</Link></div>
      {userTitle && <span className={`absolute left-2 top-2 rounded-md px-2 py-1 font-mono-ui text-[8px] uppercase tracking-[.1em] backdrop-blur ${userTitle.status === 'watching' ? 'bg-[#e47a58]/90 text-[#211923]' : userTitle.status === 'watched' ? 'bg-[#d5af71]/90 text-[#211923]' : 'bg-[#1a1c29]/85 text-[#e8ded2]'}`}>{userTitle.status === 'watching' ? 'In progress' : userTitle.status === 'watched' ? 'Watched' : 'Saved'}</span>}
    </div>
    <div className="mt-3 flex items-start justify-between gap-2"><Link href={`/title/${title.id}`} className="min-w-0" data-testid={`link-title-${title.id}`}><h3 className="truncate text-[13px] font-bold text-[#e9e0d4]">{title.name}</h3><p className="mt-1 font-mono-ui text-[9px] uppercase tracking-[.11em] text-[#747687]">{title.releaseYear > 0 ? title.releaseYear : 'Catalog'} · {title.type}</p></Link><span className="mt-0.5 flex shrink-0 items-center gap-1 text-[10px] text-[#d6ae6f]">{title.rating > 0 ? <><Star size={10} fill="currentColor" />{title.rating}</> : '—'}</span></div>
    {onStatus && <button className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#9193a3] transition hover:text-[#e47a58]" onClick={() => onStatus(userTitle?.status === 'watchlist' ? 'watching' : 'watchlist')} data-testid={`button-toggle-status-${title.id}`}>{userTitle?.status === 'watchlist' ? <><PlayCircle size={12} /> Start watching</> : <><Bookmark size={12} /> Save for later</>}</button>}
  </div>;
}

function HomePage({ userTitles, profile, counts, getUserTitle, setStatus, upsert, catalog }: DucereProps) {
  const watching = userTitles.filter((item) => item.status === 'watching').map((item) => ({ item, title: findTitle(catalog, item.titleId)! })).filter((x) => x.title);
  const saved = userTitles.filter((item) => item.status === 'watchlist').map((item) => ({ item, title: findTitle(catalog, item.titleId)! })).filter((x) => x.title);
  const recommendations = rankRecommendations(userTitles, catalog).slice(0, 5).map(({ title }) => title);
  return <div className="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12">
    <div className="fade-up relative mb-12 overflow-hidden rounded-[18px] border border-[#68453f]/40 bg-[#211e2b] px-6 py-9 sm:px-10 sm:py-11">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_25%,rgba(228,122,88,.22),transparent_28%),radial-gradient(circle_at_45%_120%,rgba(92,71,116,.26),transparent_40%)]" />
      <div className="relative max-w-2xl"><p className="mb-5 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.24em] text-[#df8265]"><span className="h-1.5 w-1.5 rounded-full bg-[#e47a58] shadow-[0_0_12px_#e47a58]" /> Your private cinema</p><h1 className="font-display text-[clamp(2.7rem,6vw,5.6rem)] leading-[.91] tracking-[-.055em] text-[#f2e9d9]">Good evening,<br /><span className="text-[#e47a58]">{profile.username}.</span></h1><p className="mt-6 max-w-md text-sm leading-6 text-[#a6a1a6]">A quiet place for the stories that stay with you. Pick up where you left off or find something for tonight.</p><Link href="/discover" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#e47a58] px-4 py-3 text-xs font-bold text-[#211923] transition hover:bg-[#ee8b69]" data-testid="link-home-discover">Find something to watch <ArrowRight size={15} /></Link></div>
      <div className="absolute -bottom-20 -right-14 hidden h-72 w-72 rounded-full border border-[#e47a58]/15 sm:block" /><div className="absolute -bottom-10 right-10 hidden h-56 w-56 rounded-full border border-[#e47a58]/20 sm:block" />
    </div>
    <div className="fade-up-2 mb-12 grid grid-cols-2 gap-3 sm:grid-cols-4"><StatTile label="In your library" value={counts.all} icon={<Library size={16} />} /><StatTile label="Want to watch" value={counts.watchlist} icon={<Bookmark size={16} />} /><StatTile label="In progress" value={counts.watching} icon={<CirclePlay size={16} />} /><StatTile label="Completed" value={counts.watched} icon={<CheckCircle2 size={16} />} /></div>
    <section className="fade-up-3 mb-12"><SectionHeading eyebrow="Continue the story" title="Pick up where you left off" href="/watching" />{watching.length ? <div className="grid gap-4 lg:grid-cols-2">{watching.map(({ item, title }) => <ContinueCard key={title.id} title={title} item={item} onFinish={() => setStatus(title.id, 'watched')} onProgress={(progress) => upsert(title.id, { progress })} onEpisodeProgress={(season, episode, progress) => upsert(title.id, { currentSeason: season, currentEpisode: episode, progress })} />)}</div> : <EmptyState icon={<CirclePlay size={24} />} title="Your next chapter is waiting" copy="Start watching a title and your progress will live here." href="/discover" action="Browse titles" />}</section>
    <section className="mb-12"><SectionHeading eyebrow="Your queue" title="Saved for a later night" href="/watchlist" />{saved.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-5">{saved.map(({ item, title }) => <PosterCard key={title.id} title={title} userTitle={item} onStatus={(status) => setStatus(title.id, status)} />)}</div> : <EmptyState icon={<Bookmark size={24} />} title="A blank canvas" copy="Save a few titles for the next time the couch calls." href="/discover" action="Explore discover" />}</section>
    <section className="pb-10"><SectionHeading eyebrow="A considered selection" title="For your next viewing" href="/discover" /><div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{recommendations.map((title) => <PosterCard key={title.id} title={title} />)}</div></section>
  </div>;
}

function ContinueCard({ title, item, onFinish, onProgress, onEpisodeProgress }: {
  title: Title;
  item: DucereProps['userTitles'][number];
  onFinish: () => void;
  onProgress: (progress: number) => void;
  onEpisodeProgress: (season: number, episode: number, progress: number) => void;
}) {
  const [progress, setProgress] = useState(item.progress ?? 0);
  const season = item.currentSeason ?? 1;
  const episode = item.currentEpisode ?? 1;
  useEffect(() => setProgress(item.progress ?? 0), [item.progress]);
  const handleProgress = (value: number) => {
    const mapped = episodeFromProgress(title, value);
    setProgress(value);
    if (mapped) onEpisodeProgress(mapped.season, mapped.episode, mapped.progress);
    else onProgress(value);
  };
  return <div className="panel flex gap-4 rounded-2xl p-3 sm:p-4">
    <Link href={`/title/${title.id}`} className={`relative h-[142px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-br ${typeTint[title.type]}`} data-testid={`link-continue-poster-${title.id}`}>
      <img src={title.poster} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={(event) => {
        const image = event.currentTarget;
        if (image.dataset.fallback === 'cover') return;
        image.dataset.fallback = 'cover';
        image.src = coverArt(title.name, title.type);
      }} />
      <span className="absolute bottom-2 left-2 rounded bg-[#0d0f18]/80 px-1.5 py-1 font-mono-ui text-[8px] text-[#f2dfc5]">S{season} · E{episode}</span>
    </Link>
    <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[#df8265]">Continue watching</p>
            <Link href={`/title/${title.id}`} className="mt-1 block truncate text-base font-bold text-[#e9dfd2]">{title.name}</Link>
          </div>
          <MoreHorizontal size={17} className="text-[#6f7180]" />
        </div>
        <p className="mt-1 text-xs text-[#888a9a]">{title.type === 'movie' ? 'Movie progress' : `Season ${season}, episode ${episode}`}</p>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between font-mono-ui text-[9px] text-[#797b8a]"><span>{progress}% complete</span><span>{title.type === 'movie' ? 'Keep going' : 'Next episode'}</span></div>
        <input type="range" min="0" max="100" value={progress} onChange={(e) => handleProgress(Number(e.target.value))} className="h-1.5 w-full accent-[#e47a58]" aria-label={`Progress for ${title.name}`} data-testid={`input-progress-${title.id}`} />
        <div className="mt-3 flex items-center gap-3"><Link href={`/title/${title.id}`} className="text-[10px] font-bold text-[#e47a58]">Resume</Link><button onClick={onFinish} className="text-[10px] font-semibold text-[#848696] hover:text-[#e5d7c9]" data-testid={`button-finish-${title.id}`}>Mark watched</button></div>
      </div>
    </div>
  </div>;
}

function StatTile({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="panel-soft rounded-xl px-4 py-4"><div className="mb-4 flex items-center justify-between text-[#df8265]">{icon}<span className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[#6f7181]">{new Date().getFullYear()}</span></div><p className="text-2xl font-bold tracking-[-.04em] text-[#eee4d5]">{value}</p><p className="mt-1 text-[11px] text-[#898b99]">{label}</p></div>;
}

function EmptyState({ icon, title, copy, href, action }: { icon: ReactNode; title: string; copy: string; href: string; action: string }) {
  return <div className="panel-soft flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e47a58]/20 bg-[#e47a58]/10 text-[#e47a58]">{icon}</div><h3 className="font-display text-2xl text-[#e7ddce]">{title}</h3><p className="mt-2 max-w-sm text-xs leading-5 text-[#858797]">{copy}</p><Link href={href} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#6a3f37] px-3.5 py-2 text-[11px] font-bold text-[#e78b6c] transition hover:bg-[#e47a58]/10" data-testid={`link-empty-${action.toLowerCase().replaceAll(' ', '-')}`}>{action}<ArrowRight size={13} /></Link></div>;
}

function DiscoverPage({ userTitles, setStatus }: DucereProps) {
  const query = new URLSearchParams(window.location.search).get('q') ?? '';
  const [search, setSearch] = useState(query);
  const [type, setType] = useState<'all' | TitleType>('all');
  const results = useMemo(() => TITLES.filter((title) => (type === 'all' || title.type === type) && `${title.name} ${title.genres.join(' ')}`.toLowerCase().includes(search.toLowerCase())), [search, type]);
  return <div className="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12"><PageIntro eyebrow="Discover" title="Find your next film." description="A handpicked shelf of movies, series, and anime. Search by title or mood." /><div className="mb-10 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#777989]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Try “quiet sci-fi” or “Breaking Bad”" className="h-12 w-full rounded-xl border border-[#303345] bg-[#171a27] pl-11 pr-4 text-sm outline-none placeholder:text-[#686a7a] focus:border-[#d17459]" data-testid="input-discover-search" /></div><div className="flex gap-2">{(['all', 'movie', 'tv', 'anime'] as const).map((filter) => <button key={filter} onClick={() => setType(filter)} className={`rounded-xl px-4 py-2 text-[11px] font-bold capitalize transition ${type === filter ? 'bg-[#e47a58] text-[#211923]' : 'border border-[#303345] text-[#9495a3] hover:border-[#765045]'}`} data-testid={`button-filter-${filter}`}>{filter === 'all' ? 'Everything' : filter === 'tv' ? 'Series' : filter}</button>)}</div></div><div className="mb-5 flex items-center justify-between"><p className="text-xs text-[#777989]"><span className="font-bold text-[#e2d8c8]">{results.length}</span> titles in the archive</p><button className="flex items-center gap-2 text-[11px] font-semibold text-[#8d8f9f]" data-testid="button-discover-sort"><SlidersHorizontal size={14} /> Curated order</button></div>{results.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{results.map((title) => <PosterCard key={title.id} title={title} userTitle={userTitles.find((item) => item.titleId === title.id)} onStatus={(status) => setStatus(title.id, status)} />)}</div> : <EmptyState icon={<Search size={23} />} title="Nothing found in this reel" copy="Try a title, genre, or a softer search term." href="/discover" action="Clear search" />}</div>;
}

function DiscoverPageV2({ userTitles, setStatus, catalog, catalogLoading, catalogError }: DucereProps) {
  const query = new URLSearchParams(window.location.search).get('q') ?? '';
  const [search, setSearch] = useState(query);
  const [type, setType] = useState<'all' | TitleType>('all');
  const [visibleCount, setVisibleCount] = useState(144);
  useEffect(() => setVisibleCount(144), [search, type]);
  const results = useMemo(
    () => catalog.filter((title) => (type === 'all' || title.type === type) && `${title.name} ${title.genres.join(' ')} ${title.description}`.toLowerCase().includes(search.toLowerCase())),
    [catalog, search, type],
  );
  const visible = results.slice(0, visibleCount);
  const likedGenres = useMemo(() => {
    const watchedOrWatching = userTitles.filter((item) => item.status !== 'watchlist');
    const counts = new Map<string, number>();
    watchedOrWatching.forEach((item) => {
      const title = findTitle(catalog, item.titleId);
      title?.genres.forEach((genre) => counts.set(genre, (counts.get(genre) ?? 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([genre]) => genre);
  }, [userTitles, catalog]);
  const recommendations = useMemo(() => rankRecommendations(userTitles, catalog).slice(0, 6), [catalog, userTitles]);
  return <div className="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12">
    <PageIntro eyebrow="Discover" title="Find your next film." description="A curated shelf backed by a growing live index of series and anime. Search by title, genre, or mood." />
    <div className="mb-10 flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#777989]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Try “quiet sci-fi” or “Breaking Bad”" className="h-12 w-full rounded-xl border border-[#303345] bg-[#171a27] pl-11 pr-4 text-sm outline-none placeholder:text-[#686a7a] focus:border-[#d17459]" data-testid="input-discover-search" /></div>
      <div className="flex gap-2 overflow-x-auto">{(['all', 'movie', 'tv', 'anime'] as const).map((filter) => <button key={filter} onClick={() => setType(filter)} className={`rounded-xl px-4 py-2 text-[11px] font-bold capitalize transition ${type === filter ? 'bg-[#e47a58] text-[#211923]' : 'border border-[#303345] text-[#9495a3] hover:border-[#765045]'}`} data-testid={`button-filter-${filter}`}>{filter === 'all' ? 'Everything' : filter === 'tv' ? 'Series' : filter}</button>)}</div>
    </div>
    {!search && type === 'all' && recommendations.length > 0 && <section className="mb-10"><SectionHeading eyebrow="For your taste" title={likedGenres.length ? "Because you watch " + likedGenres[0] : 'A few places to start'} /><div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{recommendations.map(({ title, reasons }) => <div key={title.id} className="space-y-2"><PosterCard title={title} userTitle={userTitles.find((item) => item.titleId === title.id)} onStatus={(status) => setStatus(title.id, status)} />{reasons[0] && <p className="px-1 text-[9px] text-[#777989]">{reasons[0]}</p>}</div>)}</div></section>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#777989]"><span className="font-bold text-[#e2d8c8]">{results.length}</span> titles indexed{catalogLoading ? ' · loading more from live sources' : ''}</p><span className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[#666879]">Curated + live catalog</span></div>
    {catalogError && <div className="mb-5 rounded-xl border border-[#6a493f] bg-[#31252a] px-4 py-3 text-xs text-[#c6aaa1]">{catalogError}</div>}
    {visible.length ? <><div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{visible.map((title) => <PosterCard key={title.id} title={title} userTitle={userTitles.find((item) => item.titleId === title.id)} onStatus={(status) => setStatus(title.id, status)} />)}</div>{visible.length < results.length && <div className="flex justify-center py-12"><button onClick={() => setVisibleCount((current) => current + 144)} className="rounded-xl border border-[#6a4038] px-5 py-3 text-xs font-bold text-[#e78b6c] transition hover:bg-[#e47a58]/10" data-testid="button-load-more">Load more titles <span className="ml-1 text-[#9c7f77]">({results.length - visible.length} remaining)</span></button></div>}</> : <EmptyState icon={<Search size={23} />} title="Nothing found in this reel" copy="Try a title, genre, or a softer search term." href="/discover" action="Clear search" />}
  </div>;
}

function FilterBar({ search, setSearch, status, setStatus, type, setType }: { search: string; setSearch: (value: string) => void; status: string; setStatus: (value: string) => void; type: string; setType: (value: string) => void }) {
  return <div className="mb-8 flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#747687]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your library..." className="h-10 w-full rounded-lg border border-[#303345] bg-[#171a27] pl-10 pr-4 text-xs outline-none placeholder:text-[#6d6f7e] focus:border-[#d17459]" data-testid="input-library-search" /></div><div className="flex gap-2 overflow-x-auto scrollbar-hide"><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#303345] bg-[#171a27] px-3 text-xs text-[#aaa8ad] outline-none" data-testid="select-library-status"><option value="all">All status</option><option value="watchlist">Want to watch</option><option value="watching">Watching</option><option value="watched">Watched</option></select><select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-lg border border-[#303345] bg-[#171a27] px-3 text-xs text-[#aaa8ad] outline-none" data-testid="select-library-type"><option value="all">All types</option><option value="movie">Movies</option><option value="tv">Series</option><option value="anime">Anime</option></select><button className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#303345] px-3 text-xs text-[#aaa8ad]" data-testid="button-library-sort"><ChevronDown size={14} /> Recently added</button></div></div>;
}

function LibraryPage({ userTitles, setStatus, catalog }: DucereProps) {
  const [search, setSearch] = useState(''); const [status, setStatusFilter] = useState('all'); const [type, setType] = useState('all');
  const visible = userTitles.map((item) => ({ item, title: findTitle(catalog, item.titleId)! })).filter(({ item, title }) => title && (status === 'all' || item.status === status) && (type === 'all' || title.type === type) && title.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12"><PageIntro eyebrow="Library" title="Your collection." description="Every story has a place here. Filter the archive down to exactly what you want to see." /><FilterBar search={search} setSearch={setSearch} status={status} setStatus={setStatusFilter} type={type} setType={setType} />{visible.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{visible.map(({ item, title }) => <PosterCard key={title.id} title={title} userTitle={item} onStatus={(next) => setStatus(title.id, next)} />)}</div> : <EmptyState icon={<Library size={23} />} title="This shelf is quiet" copy="Adjust your filters or discover something worth keeping." href="/discover" action="Go to discover" />}</div>;
}

function CollectionPage({ userTitles, status, setStatus, setProgress, catalog, upsert }: DucereProps & { status: 'watchlist' | 'watching' }) {
  const entries = userTitles.filter((item) => item.status === status).map((item) => ({ item, title: findTitle(catalog, item.titleId)! })).filter((x) => x.title);
  const isWatching = status === 'watching';
  return <div className="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12"><PageIntro eyebrow={isWatching ? 'In progress' : 'Watchlist'} title={isWatching ? 'Keep going.' : 'For a later night.'} description={isWatching ? 'Your current stories, with the next step always close at hand.' : 'The titles that caught your eye. No pressure, just a good queue for when the mood arrives.'} />{entries.length ? isWatching ? <div className="grid gap-4 lg:grid-cols-2">{entries.map(({ item, title }) => <ContinueCard key={title.id} item={item} title={title} onFinish={() => setStatus(title.id, 'watched')} onProgress={(progress) => setProgress(title.id, progress)} onEpisodeProgress={(season, episode, progress) => { if (title.episodes) upsert(title.id, { currentSeason: season, currentEpisode: episode, progress }); else setProgress(title.id, progress); }} />)}</div> : <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{entries.map(({ item, title }) => <PosterCard key={title.id} title={title} userTitle={item} onStatus={(next) => setStatus(title.id, next)} />)}</div> : <EmptyState icon={isWatching ? <PlayCircle size={23} /> : <Bookmark size={23} />} title={isWatching ? 'Nothing mid-story' : 'Your queue is open'} copy={isWatching ? 'Move a title from your watchlist when you are ready to begin.' : 'Save films, shows, and anime from discover to keep them close.'} href={isWatching ? '/watchlist' : '/discover'} action={isWatching ? 'View watchlist' : 'Browse discover'} />}</div>;
}

function HistoryPage({ userTitles, catalog }: DucereProps) {
  const watched = userTitles.filter((item) => item.status === 'watched').map((item) => ({ item, title: findTitle(catalog, item.titleId)! })).filter((x) => x.title);
  return <div className="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12"><PageIntro eyebrow="Your record" title="The films that stayed." description="A private record of the stories you have finished, and what you thought of them." action={<button className="flex items-center gap-2 rounded-lg border border-[#353646] px-3 py-2 text-[11px] font-semibold text-[#aaa8aa]" data-testid="button-history-filter"><SlidersHorizontal size={14} /> Filter by year</button>} />{watched.length ? <div className="space-y-2">{watched.map(({ item, title }) => <HistoryRow key={title.id} title={title} item={item} />)}</div> : <EmptyState icon={<History size={23} />} title="The record starts here" copy="Mark a title as watched and leave a note for your future self." href="/discover" action="Find a title" />}</div>;
}

function HistoryRow({ title, item }: { title: Title; item: DucereProps['userTitles'][number] }) {
  return <div className="panel-soft group flex items-center gap-4 rounded-xl p-3 transition hover:bg-[#2a2c3d] sm:p-4"><Link href={`/title/${title.id}`} className={`h-20 w-14 shrink-0 overflow-hidden rounded-md bg-gradient-to-br ${typeTint[title.type]}`} data-testid={`link-history-poster-${title.id}`}><img src={title.poster} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={(event) => {
        const image = event.currentTarget;
        if (image.dataset.fallback === 'cover') return;
        image.dataset.fallback = 'cover';
        image.src = coverArt(title.name, title.type);
      }} /></Link><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link href={`/title/${title.id}`} className="truncate text-sm font-bold text-[#e8ded2]" data-testid={`link-history-title-${title.id}`}>{title.name}</Link><span className="rounded bg-[#333144] px-1.5 py-0.5 font-mono-ui text-[8px] uppercase text-[#9a96a7]">{title.type}</span></div><p className="mt-1 text-xs text-[#838594]">{item.dateWatched ? `Watched ${new Date(item.dateWatched).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Recently completed'}{item.review ? ` · “${item.review}”` : ''}</p></div><div className="hidden items-center gap-1 sm:flex">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={13} className={index < (item.rating ?? 0) ? 'text-[#d5af71]' : 'text-[#4e5061]'} fill={index < (item.rating ?? 0) ? 'currentColor' : 'none'} />)}</div><ChevronRight size={16} className="text-[#626475]" /></div>;
}

function TitleDetailsPage(props: DucereProps) {
  const { id } = useParams<{ id: string }>();
  const title = findTitle(props.catalog, id ?? '');
  const [enrichedTitle, setEnrichedTitle] = useState<Title | null>(null);

  useEffect(() => {
    let active = true;
    setEnrichedTitle(null);
    if (!title || title.type === 'movie') return () => { active = false; };
    void getTitleMetadata(title).then((metadata) => {
      if (active && Object.keys(metadata).length) setEnrichedTitle({ ...title, ...metadata });
    });
    return () => {
      active = false;
    };
  }, [title?.id, title?.name, title?.type]);

  if (!title) return <NotFound />;
  return <TitleDetails title={enrichedTitle ?? title} {...props} />;
}

function TitleDetails({ title, getUserTitle, upsert, setStatus, remove, setEpisodeProgress, profile }: { title: Title } & DucereProps) {
  const existing = getUserTitle(title.id);
  const [review, setReview] = useState(existing?.review ?? '');
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const progress = title.type === 'movie'
    ? (existing?.progress ?? 0)
    : seriesProgress(title, existing?.currentSeason ?? 1, existing?.currentEpisode ?? 1) || (existing?.progress ?? 0);
  const status = existing?.status as string | undefined;
  const setAndKeep = (next: UserStatus) => setStatus(title.id, next);
  return <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12"><Link href="/discover" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[#898b9b] hover:text-[#e47a58]" data-testid="link-back-discover"><ArrowRight size={14} className="rotate-180" /> Back to discover</Link><section className="relative overflow-hidden rounded-[18px] border border-[#3e3440] bg-[#1a1b29]"><div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${title.backdrop})` }} /><div className="absolute inset-0 bg-gradient-to-r from-[#171824] via-[#171824]/95 to-[#171824]/45" /><div className="relative grid gap-8 px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-[220px_1fr] lg:gap-12"><div className={`mx-auto aspect-[2/3] w-[180px] overflow-hidden rounded-xl bg-gradient-to-br ${typeTint[title.type]} shadow-2xl lg:mx-0 lg:w-full`}><img src={title.poster} alt={`${title.name} poster`} className="h-full w-full object-cover" loading="eager" decoding="async" onError={(event) => {
        const image = event.currentTarget;
        if (image.dataset.fallback === 'cover') return;
        image.dataset.fallback = 'cover';
        image.src = coverArt(title.name, title.type);
      }} /></div><div className="max-w-3xl self-end"><div className="mb-4 flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#e47a58] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[.12em] text-[#211923]">{title.type}</span><span className="font-mono-ui text-[10px] text-[#a0a0aa]">{title.releaseYear} · {title.runtime}</span><span className="flex items-center gap-1 font-mono-ui text-[10px] text-[#d5af71]"><Star size={11} fill="currentColor" /> {title.rating} / 10</span></div><h1 className="font-display text-[clamp(2.7rem,7vw,6.7rem)] leading-[.9] tracking-[-.055em] text-[#f1e8d8]">{title.name}</h1><p className="mt-6 max-w-2xl text-sm leading-7 text-[#b4b0b1]">{title.description}</p><div className="mt-7 flex flex-wrap gap-2">{title.genres.map((genre) => <span key={genre} className="rounded-full border border-[#505064] px-3 py-1.5 text-[10px] text-[#a9a5a8]">{genre}</span>)}</div></div></div></section><div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_.7fr]"><div className="space-y-6"><div className="panel rounded-2xl p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-[#df8265]">Your place in the story</p><h2 className="mt-1 text-lg font-bold text-[#eae1d6]">{status ? formatStatus(status) : 'Not in your library'}</h2></div><div className="flex flex-wrap gap-2">{status !== 'watchlist' && <button onClick={() => setAndKeep('watchlist')} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold ${status === 'watchlist' ? 'border-[#e47a58] text-[#e47a58]' : 'border-[#454657] text-[#b1adb0] hover:border-[#d17459]'}`} data-testid="button-add-watchlist"><Bookmark size={14} /> Save for later</button>}{status !== 'watching' && status !== 'watched' && <button onClick={() => setAndKeep('watching')} className="flex items-center gap-2 rounded-lg bg-[#e47a58] px-3 py-2 text-[11px] font-bold text-[#211923]" data-testid="button-start-watching"><PlayCircle size={14} /> Start watching</button>}{status === 'watching' && <button onClick={() => setAndKeep('watched')} className="flex items-center gap-2 rounded-lg bg-[#d5af71] px-3 py-2 text-[11px] font-bold text-[#211923]" data-testid="button-mark-watched"><Check size={14} /> Mark watched</button>}{status && <button onClick={() => remove(title.id)} className="rounded-lg border border-[#454657] p-2 text-[#898b9b] hover:border-[#c55f57] hover:text-[#df7565]" aria-label="Remove from library" data-testid="button-remove-title"><Trash2 size={14} /></button>}</div></div>{status === 'watching' && <div className="mt-7 border-t hairline pt-6"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-[#c4bdba]">Viewing progress</span><span className="font-mono-ui text-[11px] text-[#e47a58]">{progress}%</span></div><input type="range" min="0" max="100" value={progress} onChange={(e) => {
    const next = Number(e.target.value);
    const mapped = episodeFromProgress(title, next);
    if (mapped) setEpisodeProgress(title.id, mapped.season, mapped.episode, mapped.progress);
    else upsert(title.id, { progress: next });
  }} className="h-2 w-full accent-[#e47a58]" data-testid="input-title-progress" />{title.type !== 'movie' && <div className="mt-4 grid max-w-sm grid-cols-2 gap-3">
<label className="text-[10px] text-[#818393]">Season<input type="number" min="1" value={existing?.currentSeason ?? 1} onChange={(e) => {
              const season = Number(e.target.value) || 1;
              const episode = existing?.currentEpisode ?? 1;
              setEpisodeProgress(title.id, season, episode, seriesProgress(title, season, episode));
            }} className="mt-1 h-9 w-full rounded-lg border border-[#353747] bg-[#171925] px-2 text-xs text-[#dcd3c7] outline-none focus:border-[#d17459]" data-testid="input-current-season" /></label>
<label className="text-[10px] text-[#818393]">Episode<input type="number" min="1" value={existing?.currentEpisode ?? 1} onChange={(e) => {
              const season = existing?.currentSeason ?? 1;
              const episode = Number(e.target.value) || 1;
              setEpisodeProgress(title.id, season, episode, seriesProgress(title, season, episode));
            }} className="mt-1 h-9 w-full rounded-lg border border-[#353747] bg-[#171925] px-2 text-xs text-[#dcd3c7] outline-none focus:border-[#d17459]" data-testid="input-current-episode" /></label>
</div>}</div>}{status === 'watched' && <div className="mt-7 border-t hairline pt-6"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-[#c4bdba]">Your rating</span><span className="font-mono-ui text-[10px] text-[#777989]">{rating ? `${rating} / 5` : 'Not rated yet'}</span></div><div className="flex gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => { setRating(value); upsert(title.id, { rating: value }); }} className="transition hover:scale-110" data-testid={`button-rate-${value}`} aria-label={`Rate ${value} out of 5`}><Star size={23} className={value <= rating ? 'text-[#d5af71]' : 'text-[#4b4c5b]'} fill={value <= rating ? 'currentColor' : 'none'} /></button>)}</div><textarea value={review} onChange={(e) => { setReview(e.target.value); upsert(title.id, { review: e.target.value }); }} placeholder="Leave a note for future you..." className="mt-5 min-h-[100px] w-full resize-y rounded-xl border border-[#353747] bg-[#171925] p-3 text-xs leading-5 text-[#dcd3c7] outline-none placeholder:text-[#676978] focus:border-[#d17459]" data-testid="textarea-title-review" /></div>}</div><div className="panel-soft rounded-2xl p-5 sm:p-7"><SectionHeading eyebrow="The details" title="Credits & context" /><div className="grid gap-5 text-xs sm:grid-cols-2"><div><p className="mb-1 text-[#6f7181]">{title.type === 'movie' ? 'Directed by' : 'Created by'}</p><p className="font-semibold text-[#d6cdc1]">{title.director}</p></div><div><p className="mb-1 text-[#6f7181]">Cast</p><p className="font-semibold leading-5 text-[#d6cdc1]">{title.cast.join(' · ')}</p></div><div><p className="mb-1 text-[#6f7181]">Format</p><p className="font-semibold text-[#d6cdc1]">{title.type === 'movie' ? title.runtime : `${title.seasons} seasons · ${title.episodes} episodes`}</p></div><div><p className="mb-1 text-[#6f7181]">Genres</p><p className="font-semibold text-[#d6cdc1]">{title.genres.join(' · ')}</p></div></div></div></div><div className="panel h-fit rounded-2xl p-5 sm:p-7"><SectionHeading eyebrow="Availability" title="Where to watch" /><p className="mb-5 text-xs leading-5 text-[#848696]">Ducere shows verified, region-specific availability when provider data is available. We never invent availability; missing data is clearly treated as unconfirmed.</p><div className="space-y-2">{title.providers?.length ? title.providers.map((provider) => <div key={`${provider.name}-${provider.kind}`} className="flex items-center justify-between rounded-xl border border-[#303244] bg-[#181a28] px-3 py-3"><div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${provider.kind === 'streaming' ? 'bg-[#d17459]/15 text-[#e47a58]' : provider.kind === 'free' ? 'bg-[#6ca58a]/15 text-[#81c09d]' : 'bg-[#d5af71]/15 text-[#d5af71]'}`}><PlayCircle size={15} /></span><div><p className="text-xs font-bold text-[#dcd3c6]">{provider.name}</p><p className="mt-0.5 text-[10px] capitalize text-[#767889]">{provider.kind}</p></div></div>{provider.url ? <a href={provider.url} target="_blank" rel="noreferrer" className="rounded-md border border-[#414355] px-2.5 py-1.5 text-[10px] font-semibold text-[#9a9baa] transition hover:border-[#d17459] hover:text-[#e47a58]" data-testid={`button-provider-${provider.name.toLowerCase().replaceAll(' ', '-')}`}>{provider.kind === 'streaming' || provider.kind === 'free' ? 'Open' : 'View'}</a> : <a href={`https://www.google.com/search?q=${encodeURIComponent(title.name+' '+provider.name+' watch')}`} target="_blank" rel="noreferrer" className="rounded-md border border-[#414355] px-2.5 py-1.5 text-[10px] font-semibold text-[#9a9baa] transition hover:border-[#d17459] hover:text-[#e47a58]">Search</a>}</div>) : <p className="rounded-xl border border-[#303244] bg-[#181a28] px-3 py-3 text-[10px] leading-5 text-[#777989]">No verified provider is currently recorded for this title.</p>}</div><div className="mt-6 rounded-xl border border-[#4f3f3d] bg-[#332528]/40 p-3 text-[10px] leading-5 text-[#a69a96]"><MapPin size={13} className="mb-1 text-[#df8265]" />Your region is saved in Settings. Ducere will use it when the replacement availability service is connected, and missing provider data is never treated as confirmed.</div><div className="mt-5"><VerifiedAvailability title={title} region={profile.country} subscriptions={profile.streamingServices} /></div></div></div></div>;
}

function VerifiedAvailability({ title, region, subscriptions }: { title: Title; region: string; subscriptions: string[] }) {
  type Source = { name?: string; type?: string; web_url?: string; source_id?: number };
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<Source[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setSources([]); setMessage('');
    if (!supabase) {
      setMessage('Verified availability is not configured yet.');
      setLoading(false);
      return () => { active = false; };
    }
    void supabase.functions.invoke('watchmode-availability', {
      body: { titleName: title.name, mediaType: title.type === 'movie' ? 'movie' : 'tv', year: title.releaseYear || undefined, region: region || 'US' },
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setMessage('Verified availability is temporarily unavailable.'); return; }
      setSources(Array.isArray(data?.sources) ? data.sources : []);
      if (!Array.isArray(data?.sources)) setMessage('No verified availability was returned.');
    }).catch(() => {
      if (active) setMessage('Verified availability is temporarily unavailable.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [title.id, title.name, title.type, title.releaseYear, region]);

  const selected = sources.filter((source) => {
    const key = source.name ? providerKeyForName(source.name) : undefined;
    return Boolean(key && subscriptions.includes(key));
  });
  const other = sources.filter((source) => !selected.some((match) =>
    match.name === source.name && match.type === source.type && match.web_url === source.web_url
  ));
  const row = (source: Source) => <div key={`${source.source_id ?? source.name}-${source.type ?? 'info'}-${source.web_url ?? ''}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#303244] bg-[#181a28] px-3 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-[#dcd3c6]">{source.name ?? 'Streaming service'}</p><p className="mt-1 text-[10px] capitalize text-[#777989]">{source.type === 'sub' ? 'Subscription' : source.type === 'free' ? 'Free' : source.type === 'rent' ? 'Rent' : source.type === 'buy' ? 'Buy' : 'Info'} · {region} · verified</p></div>{source.web_url && <a href={source.web_url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md border border-[#414355] px-2.5 py-1.5 text-[10px] font-semibold text-[#a9a6ad] hover:border-[#d17459] hover:text-[#e47a58]">Open</a>}</div>;

  return <div className="rounded-xl border border-[#303244] bg-[#171925] p-4">
    <div className="mb-3 flex items-center justify-between"><span className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[#df8265]">Verified lookup</span><span className="font-mono-ui text-[9px] text-[#777989]">{region}</span></div>
    {loading ? <p className="text-[10px] text-[#777989]">Checking availability…</p> : message ? <p className="text-[10px] leading-5 text-[#99929a]">{message}</p> : <div className="space-y-3">
      {subscriptions.length > 0 && <div><p className="mb-2 text-[9px] font-bold uppercase tracking-[.14em] text-[#df8265]">Your services</p>{selected.length ? <div className="space-y-2">{selected.map(row)}</div> : <p className="text-[10px] text-[#777989]">None of your selected services show a verified match.</p>}</div>}
      <div><p className="mb-2 text-[9px] font-bold uppercase tracking-[.14em] text-[#88858a]">{subscriptions.length ? 'Other verified options' : 'Verified options'}</p>{other.length ? <div className="space-y-2">{other.map(row)}</div> : <p className="text-[10px] text-[#777989]">No additional verified options were returned.</p>}</div>
    </div>}
    <p className="mt-3 border-t hairline pt-3 text-[9px] leading-5 text-[#6f7180]">Source-backed and region-specific. Missing data is never treated as confirmed.</p>
  </div>;
}

function ProfilePage({ profile, userTitles, counts, catalog }: DucereProps) {
  const rated = userTitles.filter((item) => item.rating);
  const avg = rated.length ? (rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length).toFixed(1) : '—';
  const watchedTitles = userTitles.filter((item) => item.status === 'watched' || item.status === 'watching');
  const genreCounts = new Map<string, number>();
  watchedTitles.forEach((item) => {
    const title = catalog.find((candidate) => candidate.id === item.titleId) ?? titleById(item.titleId);
    title?.genres.forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1));
  });
  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxGenre = topGenres[0]?.[1] ?? 1;
  const estimateMinutes = (item: UserTitle) => {
    const title = catalog.find((candidate) => candidate.id === item.titleId) ?? titleById(item.titleId);
    if (!title) return 0;
    const progress = Math.max(0, Math.min(100, item.progress ?? (item.status === 'watched' ? 100 : 0))) / 100;
    if (title.type === 'movie') {
      const match = title.runtime.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
      return ((Number(match?.[1] ?? 0) * 60) + Number(match?.[2] ?? 0)) * progress;
    }
    const episodes = item.status === 'watched' ? (title.episodes ?? 0) : (item.currentEpisode ?? 0);
    const perEpisode = title.type === 'anime' ? 24 : 45;
    return episodes * perEpisode;
  };
  const totalMinutes = Math.round(calculateViewingMinutes(userTitles, catalog));
  const estimatedHours = Math.round(totalMinutes / 60);
  const moviesWatched = watchedTitles.filter((item) => catalog.find((title) => title.id === item.titleId)?.type === 'movie').length;
  const seriesWatched = watchedTitles.filter((item) => catalog.find((title) => title.id === item.titleId)?.type === 'tv').length;
  const animeWatched = watchedTitles.filter((item) => catalog.find((title) => title.id === item.titleId)?.type === 'anime').length;
  const recent = userTitles.slice().sort((a, b) => (b.dateWatched ?? b.dateAdded).localeCompare(a.dateWatched ?? a.dateAdded)).slice(0, 8);
  return <div className="mx-auto max-w-[1200px] px-5 py-9 sm:px-8 lg:px-12">
    <PageIntro eyebrow="Your archive" title={`${profile.username}'s cinema.`} description="A small portrait of what you make time for." action={<Link href="/settings" className="flex items-center gap-2 rounded-lg border border-[#353646] px-3 py-2 text-[11px] font-semibold text-[#aaa8aa]" data-testid="link-profile-settings"><Settings size={14} /> Edit profile</Link>} />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="panel rounded-2xl p-5"><p className="font-mono-ui text-[9px] uppercase tracking-[.17em] text-[#df8265]">In the archive</p><p className="mt-4 text-4xl font-bold text-[#f0e5d6]">{counts.all}</p><p className="mt-1 text-xs text-[#878998]">titles collected</p></div>
      <div className="panel rounded-2xl p-5"><p className="font-mono-ui text-[9px] uppercase tracking-[.17em] text-[#df8265]">Finished</p><p className="mt-4 text-4xl font-bold text-[#f0e5d6]">{counts.watched}</p><p className="mt-1 text-xs text-[#878998]">stories completed</p></div>
      <div className="panel rounded-2xl p-5"><p className="font-mono-ui text-[9px] uppercase tracking-[.17em] text-[#df8265]">Your average</p><p className="mt-4 flex items-center gap-2 text-4xl font-bold text-[#f0e5d6]">{avg}<Star size={23} className="text-[#d5af71]" fill="currentColor" /></p><p className="mt-1 text-xs text-[#878998]">out of five</p></div>
      <div className="panel rounded-2xl p-5"><p className="font-mono-ui text-[9px] uppercase tracking-[.17em] text-[#df8265]">Time spent</p><p className="mt-4 text-4xl font-bold text-[#f0e5d6]">{estimatedHours}h</p><p className="mt-1 text-xs text-[#878998]">estimated viewing time</p></div>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.8fr]">
      <div className="panel rounded-2xl p-6"><SectionHeading eyebrow="Your activity" title="Recent movements" /><div className="mt-5 space-y-5">{recent.map((item, index) => { const title = catalog.find((candidate) => candidate.id === item.titleId) ?? titleById(item.titleId); if (!title) return null; return <div key={item.titleId} className="flex items-center gap-3"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${index % 2 ? 'bg-[#d5af71]/10 text-[#d5af71]' : 'bg-[#e47a58]/10 text-[#e47a58]'}`}>{item.status === 'watched' ? <Check size={15} /> : item.status === 'watching' ? <PlayCircle size={15} /> : <Bookmark size={15} />}</div><p className="text-xs text-[#aaa6a4]"><span className="font-bold text-[#dfd6ca]">{formatStatus(item.status)}</span> <Link href={`/title/${title.id}`} className="text-[#df8265] hover:underline">{title.name}</Link><span className="block mt-1 font-mono-ui text-[9px] text-[#6f7180]">{item.dateWatched ?? item.dateAdded}</span></p></div>; })}</div></div>
      <div className="panel rounded-2xl p-6"><SectionHeading eyebrow="Viewing fingerprint" title="Your favorite worlds" /><div className="mt-5 space-y-4">{topGenres.length ? topGenres.map(([genre, value]) => <div key={genre}><div className="mb-2 flex justify-between text-[11px]"><span className="text-[#b8b1ad]">{genre}</span><span className="font-mono-ui text-[#777989]">{Math.round((value / maxGenre) * 100)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#292b3a]"><div className="h-full rounded-full bg-[#e47a58]" style={{ width: `${Math.round((value / maxGenre) * 100)}%` }} /></div></div>) : <p className="text-xs leading-6 text-[#777989]">Watch or rate a few titles and Ducere will build your viewing fingerprint here.</p>}</div></div>
    </div>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <div className="panel-soft rounded-xl p-4"><p className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[#df8265]">Movies</p><p className="mt-3 text-2xl font-bold text-[#eee4d5]">{moviesWatched}</p><p className="mt-1 text-[10px] text-[#777989]">completed or in progress</p></div>
      <div className="panel-soft rounded-xl p-4"><p className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[#df8265]">Series</p><p className="mt-3 text-2xl font-bold text-[#eee4d5]">{seriesWatched}</p><p className="mt-1 text-[10px] text-[#777989]">completed or in progress</p></div>
      <div className="panel-soft rounded-xl p-4"><p className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[#df8265]">Anime</p><p className="mt-3 text-2xl font-bold text-[#eee4d5]">{animeWatched}</p><p className="mt-1 text-[10px] text-[#777989]">completed or in progress</p></div>
    </div>
    <div className="mt-6"><AchievementPanel userTitles={userTitles} catalog={catalog} /></div>
  </div>;
}

function SettingsPageV3({ profile, updateProfile, resetData, deleteAccount, upsert, catalog, userTitles }: DucereProps) {
  const countries = [
    ['US','United States'],['IN','India'],['CA','Canada'],['GB','United Kingdom'],
    ['AU','Australia'],['NZ','New Zealand'],['JP','Japan'],['KR','South Korea'],
    ['SG','Singapore'],['AE','United Arab Emirates'],['DE','Germany'],['FR','France'],
    ['ES','Spain'],['IT','Italy'],['NL','Netherlands'],['SE','Sweden'],
    ['BR','Brazil'],['MX','Mexico'],
  ] as const;
  return <div className="mx-auto max-w-[900px] px-5 py-9 sm:px-8 lg:px-12">
    <PageIntro eyebrow="Preferences" title="Make it yours." description="Choose your viewing room, region, and archive tools." />
    <div className="space-y-4">
      <div className="panel rounded-2xl p-5 sm:p-7">
        <div className="mb-5"><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Streaming services</p><h2 className="mt-1 text-lg font-bold text-[#e9e0d3]">What you already subscribe to</h2><p className="mt-2 max-w-xl text-[11px] leading-5 text-[#77798a]">Choose the services you already pay for. Ducere will use this when presenting verified availability.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {SUBSCRIPTION_PROVIDERS.map((provider) => {
            const selected = profile.streamingServices.includes(provider.key);
            return <button key={provider.key} onClick={() => updateProfile({ streamingServices: selected ? profile.streamingServices.filter((key) => key !== provider.key) : [...profile.streamingServices, provider.key] })} className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-[#e47a58] bg-[#e47a58]/10' : 'border-[#353747] bg-[#171925] hover:border-[#4b4d60]'}`} aria-pressed={selected} data-testid={`button-provider-pref-${provider.key}`}>
              <span><span className="block text-xs font-bold text-[#ddd5ca]">{provider.name}</span><span className="mt-1 block text-[10px] text-[#727486]">Availability preference</span></span>
              {selected && <Check size={15} className="text-[#e47a58]" />}
            </button>;
          })}
        </div>
        {!profile.streamingServices.length && <p className="mt-3 text-[10px] text-[#777989]">No services selected yet.</p>}
      </div>
      <div className="panel rounded-2xl p-5 sm:p-7">
        <div className="mb-6"><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Profile</p><h2 className="mt-1 text-lg font-bold text-[#e9e0d3]">Your details</h2></div>
        <label className="mb-5 block max-w-md"><span className="mb-2 block text-xs font-semibold text-[#c1b9b5]">Name</span><input value={profile.username} onChange={(e) => updateProfile({ username: e.target.value })} className="h-11 w-full rounded-lg border border-[#353747] bg-[#171925] px-3 text-sm text-[#e3d8ca] outline-none focus:border-[#d17459]" data-testid="input-profile-name" /></label>
        <label className="block max-w-md"><span className="mb-2 block text-xs font-semibold text-[#c1b9b5]">Country or region</span><select value={profile.country} onChange={(e) => updateProfile({ country: e.target.value })} className="h-11 w-full rounded-lg border border-[#353747] bg-[#171925] px-3 text-sm text-[#e3d8ca] outline-none focus:border-[#d17459]" data-testid="select-profile-country">{countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select><span className="mt-2 block text-[10px] leading-5 text-[#747687]">Ducere stores the selected region for future verified availability services.</span></label>
      </div>
      <div className="panel rounded-2xl p-5 sm:p-7">
        <div className="mb-6"><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Appearance</p><h2 className="mt-1 text-lg font-bold text-[#e9e0d3]">Your viewing room</h2></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={() => updateProfile({ appearance: 'night' })} className={`flex flex-1 items-center gap-3 rounded-xl border p-4 text-left ${profile.appearance === 'night' ? 'border-[#e47a58] bg-[#e47a58]/10' : 'border-[#353747] bg-[#171925]'}`} data-testid="button-appearance-night"><Moon size={18} className="text-[#e47a58]" /><span><span className="block text-xs font-bold text-[#e3d8ca]">Night screening</span><span className="mt-1 block text-[10px] text-[#787a8a]">Low light, warm accents, no glare</span></span>{profile.appearance === 'night' && <Check size={15} className="ml-auto text-[#e47a58]" />}</button>
          <button onClick={() => updateProfile({ appearance: 'day' })} className={`flex flex-1 items-center gap-3 rounded-xl border p-4 text-left ${profile.appearance === 'day' ? 'border-[#e47a58] bg-[#e47a58]/10' : 'border-[#353747] bg-[#171925]'}`} data-testid="button-appearance-day"><Sparkles size={18} className="text-[#d5af71]" /><span><span className="block text-xs font-bold text-[#e3d8ca]">Soft daylight</span><span className="mt-1 block text-[10px] text-[#787a8a]">A lighter treatment for daytime</span></span>{profile.appearance === 'day' && <Check size={15} className="ml-auto text-[#e47a58]" />}</button>
        </div>
      </div>
      <div className="panel rounded-2xl p-5 sm:p-7">
        <div className="mb-5"><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Import</p><h2 className="mt-1 text-lg font-bold text-[#e9e0d3]">Bring your archive with you</h2></div>
        <ImportPanel catalog={catalog} upsert={upsert} profile={profile} userTitles={userTitles} updateProfile={updateProfile} />
      </div>
      <div className="panel rounded-2xl p-5 sm:p-7">
        <div className="mb-5"><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Data</p><h2 className="mt-1 text-lg font-bold text-[#e9e0d3]">Your archive, your rules</h2></div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold text-[#c1b9b5]">Reset archive</p><p className="mt-1 text-[10px] text-[#747687]">Remove your saved titles and restore the default profile.</p></div><button onClick={() => { if (window.confirm('Reset your archive?')) resetData(); }} className="flex items-center gap-2 self-start rounded-lg border border-[#633e42] px-3 py-2 text-[11px] font-semibold text-[#df8178] hover:bg-[#633e42]/20" data-testid="button-reset-data"><RotateCcw size={14} /> Reset data</button></div>
        <div className="mt-6 border-t hairline pt-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div><p className="text-xs font-semibold text-[#c1b9b5]">Delete account</p><p className="mt-1 max-w-xl text-[10px] leading-5 text-[#747687]">Permanently delete your Ducere account and its stored profile/library data. Export your archive first if you want to keep a copy.</p></div>
            <button onClick={async () => { if (!window.confirm('Delete your Ducere account permanently? This cannot be undone.')) return; try { await deleteAccount(); } catch (error) { window.alert(error instanceof Error ? error.message : 'Account deletion failed.'); } }} className="flex items-center gap-2 self-start rounded-lg border border-[#633e42] px-3 py-2 text-[11px] font-semibold text-[#df8178] hover:bg-[#633e42]/20" data-testid="button-delete-account"><Trash2 size={14} /> Delete account</button>
          </div>
        </div>
      </div>
      <div className="panel rounded-2xl p-5 sm:p-7">
        <div className="mb-4"><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Legal & credits</p><h2 className="mt-1 text-lg font-bold text-[#e9e0d3]">Know what powers Ducere</h2></div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          <Link href="/privacy" className="text-[#bd8a78] hover:text-[#eda07f]">Privacy Policy</Link>
          <Link href="/terms" className="text-[#bd8a78] hover:text-[#eda07f]">Terms of Service</Link>
          <Link href="/about" className="text-[#bd8a78] hover:text-[#eda07f]">About & Credits</Link>
        </div>
      </div>
    </div>
  </div>;
}
function ImportPanel({ catalog, upsert, profile, userTitles, updateProfile }: { catalog: Title[]; upsert: DucereProps['upsert']; profile: DucereProps['profile']; userTitles: DucereProps['userTitles']; updateProfile: DucereProps['updateProfile'] }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    setMessage('');
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const backup = parseDucereBackup(text);
        const known = new Set(catalog.map((title) => title.id));
        let imported = 0;
        let skipped = 0;
        backup.titles.forEach((item) => {
          if (!known.has(item.titleId)) {
            skipped += 1;
            return;
          }
          upsert(item.titleId, item);
          imported += 1;
        });
        updateProfile({
          username: backup.profile.username,
          country: backup.profile.country,
          appearance: backup.profile.appearance,
          streamingServices: backup.profile.streamingServices,
          onboardingComplete: true,
        });
        setMessage(`Backup restored: ${imported} titles imported, ${skipped} titles skipped because they are not currently in the catalogue.`);
      } else {
        const { items, rows } = importCsvText(text, catalog);
        const ids = new Set(userTitles.map((item) => item.titleId));
        let imported = 0;
        let skipped = 0;
        items.forEach((item) => {
          if (ids.has(item.titleId)) {
            skipped += 1;
            return;
          }
          upsert(item.titleId, item);
          imported += 1;
        });
        const invalid = Math.max(0, rows - items.length);
        setMessage(formatImportSummary({ imported, skipped, invalid }));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read this file.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="panel rounded-2xl p-5 sm:p-7">
    <div className="mb-5">
      <p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Archive transfer</p>
      <h2 className="mt-1 text-lg font-bold text-[#e9e0d3]">Bring your archive with you</h2>
      <p className="mt-2 max-w-xl text-[11px] leading-5 text-[#77798a]">Import CSV exports from IMDb, Letterboxd, or MyAnimeList, or restore a full Ducere JSON backup. Unknown titles are reported instead of silently discarded.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#e47a58] px-4 py-2.5 text-xs font-bold text-[#211923]">
        <Upload size={14} /> <span>{busy ? 'Reading…' : 'Import CSV / JSON'}</span>
        <input type="file" accept=".csv,.json,text/csv,application/json" className="hidden" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file); e.currentTarget.value = ''; }} data-testid="input-import-archive" />
      </label>
      <button onClick={() => downloadDucereBackup(profile, userTitles)} className="inline-flex items-center gap-2 rounded-lg border border-[#414355] px-4 py-2.5 text-xs font-bold text-[#aaa7ad] hover:border-[#d17459] hover:text-[#e47a58]" data-testid="button-export-backup"><Download size={14} /> Export Ducere backup</button><button onClick={() => downloadDucereCsv(userTitles, catalog)} className="inline-flex items-center gap-2 rounded-lg border border-[#353747] px-4 py-2.5 text-xs font-semibold text-[#9896a1] hover:border-[#4a4d60] hover:text-[#d1c9bf]" data-testid="button-export-csv"><Download size={14} /> Export CSV</button>
    </div>
    {message && <p className="mt-3 text-[11px] leading-5 text-[#87bd9d]" data-testid="text-import-result">{message}</p>}
  </div>;
}
function SettingSwitch({ label, copy, value, onChange, testId }: { label: string; copy: string; value: boolean; onChange: (value: boolean) => void; testId: string }) {
  return <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-xs font-semibold text-[#c9c0ba]">{label}</p><p className="mt-1 text-[10px] leading-5 text-[#77798a]">{copy}</p></div><button onClick={() => onChange(!value)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? 'bg-[#e47a58]' : 'bg-[#3b3d4d]'}`} role="switch" aria-checked={value} data-testid={testId}><span className={`absolute top-1 h-4 w-4 rounded-full bg-[#f5ebdb] transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>;
}

function NotFound() {
  return <div className="mx-auto max-w-[700px] px-6 py-28 text-center"><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[#df8265]">404 · reel missing</p><h1 className="mt-4 font-display text-5xl text-[#f0e5d5]">That scene is not here.</h1><p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#858796]">The title or page you are looking for may have been moved.</p><Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#e47a58] px-4 py-2.5 text-xs font-bold text-[#211923]" data-testid="link-not-found-home">Return home <ArrowRight size={14} /></Link></div>;
}

export default App;