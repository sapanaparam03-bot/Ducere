import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, LoaderCircle, MapPin, SlidersHorizontal } from 'lucide-react';
import type { Title } from '@/lib/ducere';
import { getTitleAvailability, type AvailabilityResult, type AvailabilitySource } from '@/lib/availability';
import { providerKeyForName } from '@/lib/providers';

type Props = {
  title: Title;
  region: string;
  subscriptions: string[];
};

const kindLabel: Record<AvailabilitySource['kind'], string> = {
  streaming: 'Subscription',
  free: 'Free',
  rent: 'Rent',
  buy: 'Buy',
  info: 'Info',
};

export function AvailabilityPanel({ title, region, subscriptions }: Props) {
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage('');
    setResult(null);
    void getTitleAvailability(title, region).then((next) => {
      if (active) setResult(next);
    }).catch((error) => {
      if (!active) return;
      const code = error?.context?.body?.code ?? error?.context?.code ?? error?.message ?? '';
      setMessage(String(code).includes('WATCHMODE_NOT_CONFIGURED')
        ? 'Verified availability is ready to connect, but its data provider is not configured yet.'
        : 'Verified availability is temporarily unavailable. No unverified service is being presented as confirmed.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [title.id, title.name, title.type, title.releaseYear, region]);

  const matchedSubscriptions = useMemo(() => {
    if (!result) return [];
    return result.sources.filter((source) => {
      const key = providerKeyForName(source.name);
      return key && subscriptions.includes(key);
    });
  }, [result, subscriptions]);

  const otherVerified = useMemo(() => {
    if (!result) return [];
    const selected = new Set(matchedSubscriptions.map((source) => `${source.name}:${source.kind}:${source.url ?? ''}`));
    return result.sources.filter((source) => !selected.has(`${source.name}:${source.kind}:${source.url ?? ''}`));
  }, [result, matchedSubscriptions]);

  const sourceRow = (source: AvailabilitySource) => (
    <div key={`${source.sourceId ?? source.name}-${source.kind}-${source.url ?? ''}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#303244] bg-[#181a28] px-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#6ca58a]/12 text-[#81c09d]"><Check size={14} /></span>
          <p className="truncate text-xs font-bold text-[#dcd3c6]">{source.name}</p>
        </div>
        <p className="mt-1 pl-9 text-[10px] text-[#777989]">{kindLabel[source.kind]} · {region} · verified source</p>
      </div>
      {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#414355] px-2.5 py-1.5 text-[10px] font-semibold text-[#a9a6ad] hover:border-[#d17459] hover:text-[#e47a58]"><ExternalLink size={12} /> Open</a>}
    </div>
  );

  return <div className="panel h-fit rounded-2xl p-5 sm:p-7">
    <SectionTitle />
    {loading ? <div className="flex items-center gap-2 rounded-xl border border-[#303244] bg-[#181a28] px-3 py-4 text-[11px] text-[#858797]"><LoaderCircle size={14} className="animate-spin" /> Checking verified availability for {region}…</div>
      : message ? <div className="rounded-xl border border-[#4f3f3d] bg-[#332528]/40 p-3 text-[10px] leading-5 text-[#a69a96]"><MapPin size={13} className="mb-1 text-[#df8265]" />{message}</div>
      : <div className="space-y-5">
        {subscriptions.length > 0 && <div><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#df8265]">Your services</p><span className="font-mono-ui text-[9px] text-[#777989]">{matchedSubscriptions.length}</span></div><div className="space-y-2">{matchedSubscriptions.length ? matchedSubscriptions.map(sourceRow) : <p className="rounded-xl border border-[#303244] bg-[#181a28] px-3 py-3 text-[10px] leading-5 text-[#777989]">None of your selected services currently show a verified match in {region}.</p>}</div></div>}
        <div><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#a6a0a0]">{subscriptions.length ? 'Other verified options' : 'Verified options'}</p><span className="font-mono-ui text-[9px] text-[#777989]">{otherVerified.length}</span></div><div className="space-y-2">{otherVerified.length ? otherVerified.map(sourceRow) : <p className="rounded-xl border border-[#303244] bg-[#181a28] px-3 py-3 text-[10px] leading-5 text-[#777989]">No additional verified options were returned for this region.</p>}</div></div>
      </div>}
    <div className="mt-5 border-t hairline pt-4 text-[10px] leading-5 text-[#707283]"><div className="flex items-center gap-2"><SlidersHorizontal size={13} className="shrink-0" /> Region and subscriptions are controlled from Settings. Availability data is source-backed; missing data is never treated as confirmed.</div><p className="mt-2 pl-5">Availability data provided by <a href="https://api.watchmode.com/" target="_blank" rel="noreferrer" className="text-[#a99a7d] underline underline-offset-2 hover:text-[#d8b67e]">Watchmode</a>.</p></div>
  </div>;
}

function SectionTitle() {
  return <div className="mb-5 flex items-end justify-between gap-4"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Availability</p><h2 className="mt-1 text-lg font-bold text-[#e9e1d6]">Where to watch</h2></div><span className="rounded-full border border-[#3d4050] px-2.5 py-1 font-mono-ui text-[9px] text-[#777989]">verified</span></div>;
}
