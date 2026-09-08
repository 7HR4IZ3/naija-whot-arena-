import { TournamentRoom } from "@/components/tournament-room";

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TournamentRoom id={id} />;
}
