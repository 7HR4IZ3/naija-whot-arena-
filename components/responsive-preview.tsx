"use client";
import { useState } from "react";
import Link from "next/link";

const pages = [["/", "Play"], ["/game", "Practice"], ["/lobby", "Create game"], ["/history", "History"], ["/account", "Profile"], ["/tournaments", "Tournaments"], ["/tournaments/new", "Create tournament"], ["/auth", "Sign in"], ["/rules", "Rules"], ["/tutorial", "Tutorial"]];
export function ResponsivePreview() {
 const [path, setPath] = useState("/game");
 const [width, setWidth] = useState("390");
 return <main className="responsive-preview"><header><Link className="text-link" href="/">Back to play</Link><div className="form-field"><label htmlFor="preview-page">Page</label><select className="form-select" id="preview-page" value={path} onChange={e=>setPath(e.target.value)}>{pages.map(([href,label])=><option key={href} value={href}>{label}</option>)}</select></div><div className="form-field"><label htmlFor="preview-width">Screen width</label><select className="form-select" id="preview-width" value={width} onChange={e=>setWidth(e.target.value)}>{[320,390,430,768,1280].map(w=><option key={w} value={w}>{w}px</option>)}</select></div></header><div className="responsive-preview-stage"><iframe src={path} title="Live page preview" style={{width:Number(width)}} /></div></main>;
}
