"use client";
import { useEffect, useState } from "react";
import { normalizeRoomSettings, validateRoomConfiguration, type RoomSettings } from "@/lib/rules";
type Preset = { id: string; name: string; rules: RoomSettings };
const key="whot:presets:v1";
export function SavedRules({ settings, players, onLoad }: { settings: RoomSettings; players: number; onLoad: (rules: RoomSettings)=>void }) {
 const [presets,setPresets]=useState<Preset[]>([]);
 const [name,setName]=useState("");
 const [message,setMessage]=useState("");
 useEffect(()=>{const timer=setTimeout(()=>{try {const saved=JSON.parse(localStorage.getItem(key)||"[]"); if(Array.isArray(saved))setPresets(saved.filter(p=>p && typeof p.id==="string" && typeof p.name==="string" && p.rules).slice(0,10).map(p=>({...p,rules:normalizeRoomSettings(p.rules)})));}catch{}},0);return ()=>clearTimeout(timer);},[]);
 const persist=(next:Preset[])=>{try{localStorage.setItem(key,JSON.stringify(next));setPresets(next);return true;}catch{setMessage("Your browser could not save these rules.");return false;}};
 return <details className="match-details"><summary>Saved house rules</summary><p>Save up to 10 setups on this device.</p><label htmlFor="preset-name">Setup name</label><input className="form-input" id="preset-name" value={name} maxLength={40} onChange={e=>setName(e.target.value)}/><button className="button button-secondary" type="button" disabled={!name.trim() || presets.length>=10} onClick={()=>{const issue=validateRoomConfiguration(players,settings);if(issue){setMessage(issue);return;}if(persist([...presets,{id:crypto.randomUUID(),name:name.trim(),rules:settings}])){setName("");setMessage("Rules saved.");}}}>Save current rules</button>{presets.map(p=><div className="saved-rule-row" key={p.id}><span>{p.name}</span><button type="button" className="text-link" onClick={()=>{const issue=validateRoomConfiguration(players,p.rules);if(issue){setMessage(issue);return;}onLoad(p.rules);setMessage(`Loaded ${p.name}.`);}}>Use</button><button type="button" className="text-link" aria-label={`Delete ${p.name}`} onClick={()=>persist(presets.filter(v=>v.id!==p.id))}>Delete</button></div>)}<p role="status">{message}</p></details>;
}
