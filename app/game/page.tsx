import { GameTable } from "@/components/game-table";
import { OnlineGame } from "@/components/online-game";
import { redirect } from "next/navigation";

type GamePageProps = {
  searchParams: Promise<{ room?: string; match?: string }>;
};

export default async function GamePage({ searchParams }: GamePageProps) {
  const params = await searchParams;
  if (params.match) return <OnlineGame id={params.match} roomCode={params.room} />;
  if (params.room) redirect(`/table/${encodeURIComponent(params.room)}`);
  return <GameTable roomCode={params.room ?? null} />;
}
