import { supabase } from './supabase';
export async function signIn(email:string,password:string){if(!supabase)throw new Error('Cloud sync is not configured. Add Supabase environment variables.');return supabase.auth.signInWithPassword({email,password});}
export async function signUp(email:string,password:string,username='Viewer'){if(!supabase)throw new Error('Cloud sync is not configured.');return supabase.auth.signUp({email,password,options:{data:{username}}});}
export async function signOut(){if(supabase)return supabase.auth.signOut();}
