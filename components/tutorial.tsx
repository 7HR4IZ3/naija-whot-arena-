"use client";
import { useState } from "react";
import Link from "next/link";
import { CardFace } from "./card-face";
import { createCard, SUIT_META, type PlayingSuit } from "@/lib/cards";
const lessons=[
 {title:"Match the symbol",text:"The pot shows a 4 Ball. Play another Ball.",top:createCard("circle",4),cards:[createCard("star",7),createCard("circle",10)],correct:"circle"},
 {title:"Match the number",text:"The pot shows a 4 Ball. A 4 of any symbol can also follow it.",top:createCard("circle",4),cards:[createCard("triangle",4),createCard("cross",7)],correct:"triangle"},
 {title:"Call a symbol",text:"A Whot lets you choose the next symbol. Play the Whot, then call Stars.",top:createCard("square",10),cards:[createCard("whot",20),createCard("circle",3)],correct:"whot"},
 {title:"Defend a penalty",text:"A Pick Two is waiting. With stacking enabled, another 2 passes on a four-card penalty. Play it.",top:createCard("circle",2),cards:[createCard("circle",10),createCard("triangle",2)],correct:"triangle"}
];
export function Tutorial(){
 const [step,setStep]=useState(0);const [feedback,setFeedback]=useState("");const [done,setDone]=useState(false);const [pick,setPick]=useState(false);
 if(step===lessons.length)return <main className="page-wrap"><h1>You’re ready to play</h1><p>Match numbers or symbols, use Whot to call a symbol, and follow the table’s penalty rules.</p><Link className="button button-primary" href="/game">Try practice</Link><button className="button button-secondary" onClick={()=>{setStep(0);setDone(false);setFeedback("");}}>Replay tutorial</button></main>;
 const lesson=lessons[step];
 const choose=(suit:PlayingSuit)=>{if(suit==="star"){setPick(false);setDone(true);setFeedback("Correct. The next player must play a Star or another Whot.");}else setFeedback("For this lesson, call Stars.");};
 return <main className="page-wrap"><section className="panel lobby-panel practice-options"><p className="tutorial-progress">Lesson {step+1} of {lessons.length}</p><h1>{lesson.title}</h1><p>{lesson.text}</p><div className="tutorial-cards"><CardFace card={lesson.top}/></div><div className="tutorial-cards">{lesson.cards.map(c=><CardFace key={c.id} card={c} disabled={done || pick} onClick={()=>{if(c.suit!==lesson.correct){setFeedback("Try the other card. "+lesson.text);return;}if(c.suit==="whot"){setPick(true);setFeedback("Now call Stars.");}else{setDone(true);setFeedback("Correct!");}}}/>)}</div>{pick && <div className="reaction-buttons">{(["circle","triangle","cross","square","star"] as PlayingSuit[]).map(s=><button key={s} className="button button-secondary" onClick={()=>choose(s)}>{SUIT_META[s].short}</button>)}</div>}<p role="status">{feedback}</p><button className="button button-primary" disabled={!done} onClick={()=>{setStep(step+1);setDone(false);setFeedback("");}}>Next</button><Link className="text-link" href="/">Exit tutorial</Link></section></main>;
}
