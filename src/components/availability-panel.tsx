import { useEffect, useState } from 'react';
import { ExternalLink, MapPin, SlidersHorizontal } from 'lucide-react';
import type { Title } from '@/lib/ducere';
import { getTitleAvailability, type AvailabilityResult } from '@/lib/availability';

type Props = { title: Title; region: string; subscriptions: string[] };

export function AvailabilityPanel({ title, region }: Props) {
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  useEffect(() => {
    let active = true;
    setResult(null);
    void getTitleAvailability(title, region).then((next) => { if (active) setResult(next); });
    return () => { active = false; };
  }, [title.id, title.name, region]);

  return <div className="panel h-fit rounded-2xl p-5 sm:p-7">
    <div className="mb-5 flex items-end justify-between gap-4">
      <div><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Availability</p><h2 className="mt-1 text-lg font-bold text-[#e9e1d6]">Where to watch</h2></div>
      <span className="rounded-full border border-[#3d4050] px-2.5 py-1 font-mono-ui text-[9px] text-[#777989]">Community-powered</span>
    </div>
    <div className="space-y-3">
      <div className="rounded-xl border border-[#303244] bg-[#181a28] p-4">
        <div className="flex items-center gap-2 text-[#df8265]"><MapPin size={14} /><p className="text-[10px] font-bold uppercase tracking-[.12em]">{region} availability</p></div>
        <p className="mt-2 text-xs leading-6 text-[#b9b2a9]">Ducere is moving to a community-verified availability catalogue. No third-party streaming lookup is used, and we do not have a confirmed listing for this title yet.</p>
        <p className="mt-2 text-[10px] leading-5 text-[#777989]">Provider names in older catalogue records are historical references only, not current availability claims.</p>
      </div>
      <div className="rounded-xl border border-[#303244] bg-[#181a28] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#a6a0a0]">How the replacement works</p>
        <ul className="mt-2 space-y-2 text-[10px] leading-5 text-[#8f91a1]">
          <li>• Members submit a country, service, access type and official title link.</li>
          <li>• Reports remain pending until evidence is reviewed.</li>
          <li>• Other members can confirm or dispute a report.</li>
          <li>• Old or disputed reports are never presented as confirmed.</li>
        </ul>
      </div>
      <p className="text-[10px] leading-5 text-[#777989]">{result ? 'Community submissions will be enabled after the database and moderation controls pass security review.' : 'Loading community catalogue…'}</p>
    </div>
    <div className="mt-5 border-t hairline pt-4 text-[10px] leading-5 text-[#707283]">
      <div className="flex items-center gap-2"><SlidersHorizontal size={13} className="shrink-0" /> Region and subscriptions are controlled from Settings. No listing is labelled verified without evidence and moderation.</div>
      <a href="https://www.wikidata.org/wiki/Wikidata:Licensing" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 pl-5 text-[#a99a7d] underline underline-offset-2 hover:text-[#d8b67e]">Catalogue metadata licensing <ExternalLink size={10} /></a>
    </div>
  </div>;
}
