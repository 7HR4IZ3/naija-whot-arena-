import { Suspense } from "react";
import { LobbyView } from "@/components/lobby-view";

export default function LobbyPage() {
  return <Suspense fallback={<main className="page-wrap"><p className="muted">Loading table builder…</p></main>}><LobbyView /></Suspense>;
}
