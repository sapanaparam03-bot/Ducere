import { MapPin, SlidersHorizontal } from 'lucide-react';
import type { Title } from '@/lib/ducere';

type Props = { title: Title; region: string; subscriptions: string[] };

export function AvailabilityPanel({ title, region }: Props) {
  return <div className="panel h-fit rounded-2xl p-5 sm:p-7">
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Availability</p>
        <h2 className="mt-1 text-lg font-bold text-[#e9e1d6]">Where to watch</h2>
      </div>
      <span className="rounded-full border border-[#3d4050] px-2.5 py-1 font-mono-ui text-[9px] text-[#777989]">Community-powered</span>
    </div>
    <div className="rounded-xl border border-[#303244] bg-[#181a28] p-4">
      <div className="flex items-center gap-2 text-[#df8265]">
        <MapPin size={14} />
        <p className="text-[10px] font-bold uppercase tracking-[.12em]">{region} availability</p>
      </div>
      <p className="mt-2 text-xs leading-6 text-[#b9b2a9]">
        Ducere is moving to a community-verified availability catalogue. No third-party streaming lookup is used, and we do not have a confirmed listing for {title.name} yet.
      </p>
      <p className="mt-2 text-[10px] leading-5 text-[#777989]">
        Community reports will include the country, streaming service, access type, official title link, evidence and last-verified date. Reports remain pending until reviewed.
      </p>
    </div>
    <div className="mt-4 rounded-xl border border-[#303244] bg-[#181a28] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#a6a0a0]">Verification rules</p>
      <ul className="mt-2 space-y-2 text-[10px] leading-5 text-[#8f91a1]">
        <li>• Community votes are signals, not proof.</li>
        <li>• Only trusted moderation can publish verified availability.</li>
        <li>• Disputed and expired reports are not shown as current.</li>
        <li>• Ducere does not scrape streaming-service catalogues.</li>
      </ul>
    </div>
    <div className="mt-5 border-t hairline pt-4 text-[10px] leading-5 text-[#707283]">
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={13} className="shrink-0" />
        Region and subscriptions are controlled from Settings. Confirmed listings will appear when the community database and moderation controls are deployed.
      </div>
    </div>
  </div>;
}
