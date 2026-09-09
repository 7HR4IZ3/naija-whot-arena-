import { GameTable } from "@/components/game-table";

type GamePageProps = {
  searchParams: Promise<{ room?: string }>;
};

export default async function GamePage({ searchParams }: GamePageProps) {
  const params = await searchParams;
  return <GameTable roomCode={params.room ?? null} />;
}
