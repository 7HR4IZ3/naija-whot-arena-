"use client";
import { useEffect, useRef } from 'react';
export function GameModal({ title, children, close }: { title: string; children: React.ReactNode; close?: () => void }) {
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
 return <dialog className="arena-dialog" ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); close?.(); }}><h2>{title}</h2>{children}{close && <button className="button button-secondary" onClick={close}>Close</button>}</dialog>;
}
