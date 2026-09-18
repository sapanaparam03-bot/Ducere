import type { Title, Provider, TitleType } from './ducere';

const token = import.meta.env.VITE_TMDB_READ_TOKEN as string|undefined;
const region = (import.meta.env.VITE_TMDB_REGION as string|undefined) || 'IN';
const base='https://api.themoviedb.org/3';
const img=(path:string|null|undefined,size='w500')=>path?`https://image.tmdb.org/t/p/${size}${path}`:'';
const tmdbFetch=async<T>(path:string):Promise<T>=>{const headers:HeadersInit=token?{Authorization:`Bearer ${token}`,accept:'application/json'}:{accept:'application/json'}; const r=await fetch(`${base}${path}`,{headers}); if(!r.ok)throw new Error(`TMDB ${r.status}`); return r.json() as Promise<T>};
export type WatchProviderResponse={results:Record<string,{flatrate?:{provider_id:number,provider_name:string,logo_path:string|null,display_priority:number}[],free?:any[],rent?:any[],buy?:any[],link?:string}>};
export async function fetchWatchProviders(id:string,type:TitleType){try{return await tmdbFetch<WatchProviderResponse>(`/${type==='movie'?'movie':'tv'}/${id}/watch/providers`)}catch{return null}}
export function providerRows(data:WatchProviderResponse|null):Provider[]{const r=data?.results?.[region]; if(!r)return []; const rows=[...(r.flatrate??[]).map(x=>({name:x.provider_name,kind:'streaming' as const,logo:img(x.logo_path,'w92'),url:r.link})),...(r.free??[]).map((x:any)=>({name:x.provider_name,kind:'free' as const,logo:img(x.logo_path,'w92'),url:r.link})),...(r.rent??[]).map((x:any)=>({name:x.provider_name,kind:'rent' as const,logo:img(x.logo_path,'w92'),url:r.link})),...(r.buy??[]).map((x:any)=>({name:x.provider_name,kind:'buy' as const,logo:img(x.logo_path,'w92'),url:r.link}))]; return rows.filter((x,i,a)=>a.findIndex(y=>y.name===x.name&&y.kind===x.kind)===i);}
