import { useCallback, useEffect, useMemo, useState } from 'react';
import { INITIAL_PROFILE, INITIAL_USER_TITLES, type Profile, type UserStatus, type UserTitle } from '@/lib/ducere';
import { supabase } from '@/lib/supabase';

const USER_KEY='ducere-user-titles-v2'; const PROFILE_KEY='ducere-profile-v2';
const read=<T,>(key:string,fallback:T):T=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v) as T:fallback}catch{return fallback}};
const toDb=(uid:string,item:UserTitle)=>({user_id:uid,title_id:item.titleId,status:item.status,date_added:item.dateAdded,date_watched:item.dateWatched??null,rating:item.rating??null,review:item.review??null,current_season:item.currentSeason??null,current_episode:item.currentEpisode??null,progress:item.progress??0});
const fromDb=(r:any):UserTitle=>({titleId:r.title_id,status:r.status,dateAdded:r.date_added,dateWatched:r.date_watched??undefined,rating:r.rating??undefined,review:r.review??undefined,currentSeason:r.current_season??undefined,currentEpisode:r.current_episode??undefined,progress:Number(r.progress??0)});

export function useDucere(){
 const [userTitles,setUserTitles]=useState<UserTitle[]>(()=>read(USER_KEY,INITIAL_USER_TITLES));
 const [profile,setProfile]=useState<Profile>(()=>read(PROFILE_KEY,INITIAL_PROFILE)); const [ready,setReady]=useState(false); const [userId,setUserId]=useState<string|null>(null);
 useEffect(()=>{ let cancelled=false; (async()=>{ if(!supabase){setReady(true);return;} const {data:{session}}=await supabase.auth.getSession(); if(cancelled)return; setUserId(session?.user.id??null); if(session){ const [t,p]=await Promise.all([supabase.from('user_titles').select('*').eq('user_id',session.user.id),supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle()]); if(!t.error && t.data?.length) setUserTitles(t.data.map(fromDb)); if(!p.error&&p.data)setProfile({username:p.data.username,country:p.data.country,appearance:p.data.appearance}); } setReady(true); })(); return()=>{cancelled=true}},[]);
 useEffect(()=>{localStorage.setItem(USER_KEY,JSON.stringify(userTitles));},[userTitles]); useEffect(()=>{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));},[profile]);
 const persist=useCallback(async(item:UserTitle)=>{if(userId&&supabase) await supabase.from('user_titles').upsert(toDb(userId,item),{onConflict:'user_id,title_id'});},[userId]);
 const getUserTitle=useCallback((id:string)=>userTitles.find(x=>x.titleId===id),[userTitles]);
 const upsert=useCallback((titleId:string,patch:Partial<UserTitle>&{status?:UserStatus})=>{setUserTitles(cur=>{const found=cur.find(x=>x.titleId===titleId);const next=found?{...found,...patch}: {titleId,status:patch.status??'watchlist',dateAdded:new Date().toISOString().slice(0,10),...patch}; void persist(next); return found?cur.map(x=>x.titleId===titleId?next:x):[...cur,next];});},[persist]);
 const remove=useCallback((titleId:string)=>{setUserTitles(cur=>cur.filter(x=>x.titleId!==titleId)); if(userId&&supabase)void supabase.from('user_titles').delete().eq('user_id',userId).eq('title_id',titleId)},[userId]);
 const setStatus=useCallback((titleId:string,status:UserStatus)=>upsert(titleId,{status,...(status==='watched'?{dateWatched:new Date().toISOString().slice(0,10),progress:100}: {})}),[upsert]);
 const updateProfile=useCallback((patch:Partial<Profile>)=>{setProfile(cur=>{const next={...cur,...patch};if(userId&&supabase)void supabase.from('profiles').upsert({id:userId,username:next.username,country:next.country,appearance:next.appearance,updated_at:new Date().toISOString()});return next})},[userId]);
 const resetData=useCallback(()=>{setUserTitles(INITIAL_USER_TITLES);setProfile(INITIAL_PROFILE)},[]);
 const counts=useMemo(()=>({all:userTitles.length,watchlist:userTitles.filter(x=>x.status==='watchlist').length,watching:userTitles.filter(x=>x.status==='watching').length,watched:userTitles.filter(x=>x.status==='watched').length}),[userTitles]);
 return {userTitles,profile,ready,userId,getUserTitle,upsert,remove,setStatus,updateProfile,resetData,counts};
}
