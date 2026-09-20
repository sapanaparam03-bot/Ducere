import { Award, LockKeyhole } from 'lucide-react';
import type { Title, UserTitle } from '@/lib/ducere';
import { getAchievements } from '@/lib/personalization';

export function AchievementPanel({ userTitles, catalog }: { userTitles: UserTitle[]; catalog: Title[] }) {
  const achievements = getAchievements(userTitles, catalog);
  const unlocked = achievements.filter((item) => item.unlocked).length;
  return <div className="panel rounded-2xl p-6">
    <div className="mb-5 flex items-end justify-between gap-3"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-[#df8265]">Achievements</p><h2 className="mt-1 text-lg font-bold text-[#e9e1d6]">Your archive, in milestones</h2></div><span className="font-mono-ui text-[9px] text-[#777989]">{unlocked}/{achievements.length} unlocked</span></div>
    <div className="grid gap-2 sm:grid-cols-2">{achievements.map((achievement) => <div key={achievement.id} className={`rounded-xl border p-3 ${achievement.unlocked ? 'border-[#62503d] bg-[#2b251f]' : 'border-[#303244] bg-[#181a28]'}`}><div className="flex items-start gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${achievement.unlocked ? 'bg-[#d5af71]/15 text-[#d5af71]' : 'bg-[#2b2d3b] text-[#676979]'}`}>{achievement.unlocked ? <Award size={15} /> : <LockKeyhole size={14} />}</span><div><p className="text-xs font-bold text-[#dcd3c6]">{achievement.title}</p><p className="mt-1 text-[10px] leading-5 text-[#777989]">{achievement.description}</p></div></div></div>)}</div>
  </div>;
}
