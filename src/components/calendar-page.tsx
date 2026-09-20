import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import type { Title, UserTitle } from '@/lib/ducere';
import { getUpcomingEpisodes, type UpcomingEpisode } from '@/lib/calendar';

type Props = {
  userTitles: UserTitle[];
  catalog: Title[];
  region: string;
};

const fmtDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export function CalendarPage({ userTitles, catalog, region }: Props) {
  const [episodes, setEpisodes] = useState<UpcomingEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const watchedTimeline = useMemo(
    () => userTitles
      .filter((item) => item.dateWatched || item.dateAdded)
      .map((item) => ({
        item,
        title: catalog.find((candidate) => candidate.id === item.titleId),
        date: item.dateWatched ?? item.dateAdded,
      }))
      .filter((entry) => entry.title)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12),
    [userTitles, catalog],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void getUpcomingEpisodes(userTitles, catalog, region).then((next) => {
      if (active) setEpisodes(next.slice(0, 16));
    }).catch(() => {
      if (active) setError('The episode schedule is temporarily unavailable.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userTitles, catalog, region]);

  return <div className="mx-auto max-w-[1200px] px-5 py-9 sm:px-8 lg:px-12">
    <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.24em] text-[#df8265]">Calendar</p>
        <h1 className="font-display text-[clamp(2.4rem,5vw,4.8rem)] leading-[.94] tracking-[-.045em] text-[#f1e9dc]">Your viewing rhythm.</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-[#9697a6]">Upcoming episodes for shows you are watching, plus a private timeline of the stories you have already logged.</p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-[#353646] px-3 py-2 font-mono-ui text-[10px] text-[#777989]"><CalendarDays size={14} /> {region}</div>
    </div>

    <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
      <section className="panel rounded-2xl p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Next up</p><h2 className="mt-1 text-lg font-bold text-[#e9e1d6]">Upcoming episodes</h2></div>
          {loading && <RefreshCw size={15} className="animate-spin text-[#777989]" />}
        </div>
        {error ? <p className="rounded-xl border border-[#4f3f3d] bg-[#332528]/40 p-3 text-[10px] leading-5 text-[#a69a96]">{error}</p>
          : episodes.length ? <div className="space-y-2">{episodes.map((episode) => <div key={`${episode.titleId}-${episode.airdate}-${episode.episode}`} className="rounded-xl border border-[#303244] bg-[#181a28] p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><Link href={`/title/${episode.titleId}`} className="truncate text-xs font-bold text-[#ddd4c8] hover:text-[#e47a58]">{episode.titleName}</Link><p className="mt-1 text-[10px] text-[#777989]">S{episode.season} · E{episode.episode} · {episode.episodeName}</p></div><div className="shrink-0 text-right"><p className="text-[10px] font-semibold text-[#c9bfba]">{fmtDate(episode.airdate)}</p>{episode.airtime && <p className="mt-1 font-mono-ui text-[9px] text-[#777989]">{episode.airtime}</p>}</div></div><div className="mt-2 flex items-center gap-1.5 font-mono-ui text-[8px] uppercase tracking-[.12em] text-[#668d7b]"><Check size={11} /> TVMaze schedule</div></div>)}</div>
          : <div className="rounded-xl border border-[#303244] bg-[#181a28] p-6 text-center"><Clock3 size={20} className="mx-auto text-[#777989]" /><p className="mt-3 text-sm font-semibold text-[#c9c1ba]">{userTitles.some((item) => item.status === 'watching') ? 'No upcoming episodes found' : 'Nothing scheduled yet'}</p><p className="mt-2 text-[10px] leading-5 text-[#777989]">Start watching a series and Ducere will check its upcoming schedule.</p></div>}
      </section>

      <section className="panel rounded-2xl p-5 sm:p-7">
        <div className="mb-5"><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Archive timeline</p><h2 className="mt-1 text-lg font-bold text-[#e9e1d6]">Recent movements</h2></div>
        {watchedTimeline.length ? <div className="space-y-3">{watchedTimeline.map(({ item, title, date }) => <div key={item.titleId} className="flex gap-3 rounded-xl border border-[#303244] bg-[#181a28] p-3"><div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#e47a58]" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><Link href={`/title/${title!.id}`} className="truncate text-xs font-bold text-[#dcd3c6] hover:text-[#e47a58]">{title!.name}</Link><span className="font-mono-ui text-[9px] text-[#6f7180]">{date}</span></div><p className="mt-1 text-[10px] text-[#777989]">{item.status === 'watched' ? 'Completed' : item.status === 'watching' ? 'In progress' : 'Saved for later'}</p></div></div>)}</div>
          : <p className="rounded-xl border border-[#303244] bg-[#181a28] p-6 text-center text-[10px] leading-5 text-[#777989]">Your archive timeline will appear here as you collect stories.</p>}
      </section>
    </div>
  </div>;
}
