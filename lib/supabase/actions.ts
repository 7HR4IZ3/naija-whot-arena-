"use client";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type RoomCreateInput = {
  name: string;
  maxPlayers: number;
  rules: Record<string, unknown>;
};

export type TournamentCreateInput = {
  name: string;
  startsAt: string;
  maxPlayers: number;
  rules: Record<string, unknown>;
};

export function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export async function createRoom(input: RoomCreateInput) {
  if (!isSupabaseConfigured()) return { demo: true, code: makeRoomCode() };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Sign in before creating a synced room." };

  const code = makeRoomCode();
  const { data: room, error } = await supabase
    .from("rooms")
    .insert({
      code,
      name: input.name,
      host_id: userData.user.id,
      max_players: input.maxPlayers,
      rule_config: input.rules,
      status: "waiting",
      mode: "classic",
    })
    .select("id, code")
    .single();

  if (error || !room) return { error: error?.message ?? "Could not create room." };

  const { error: playerError } = await supabase.from("room_players").insert({
    room_id: room.id,
    user_id: userData.user.id,
    display_name: userData.user.user_metadata?.display_name ?? userData.user.email?.split("@")[0] ?? "Host",
    seat: 1,
    ready: true,
  });

  if (playerError) return { error: playerError.message };
  return { code: room.code, roomId: room.id };
}

export async function joinRoom(code: string, displayName: string) {
  if (!isSupabaseConfigured()) return { demo: true, code };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Sign in before joining a synced room." };

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, code, max_players, status")
    .eq("code", code.toUpperCase())
    .single();

  if (roomError || !room) return { error: "That room code does not exist." };
  if (room.status !== "waiting") return { error: "That table has already started." };

  const { data: currentPlayers, count } = await supabase
    .from("room_players")
    .select("user_id, seat", { count: "exact" })
    .eq("room_id", room.id);
  if ((count ?? 0) >= room.max_players) return { error: "That table is full." };
  const existingPlayer = currentPlayers?.find((player: { user_id: string; seat: number }) => player.user_id === userData.user.id);
  const takenSeats = new Set((currentPlayers ?? []).map((player: { user_id: string; seat: number }) => player.seat));
  const seat = existingPlayer?.seat ?? Array.from({ length: room.max_players }, (_, index) => index + 1).find((candidate) => !takenSeats.has(candidate));
  if (!seat) return { error: "That table has no open seat." };

  const { error } = await supabase.from("room_players").upsert({
    room_id: room.id,
    user_id: userData.user.id,
    display_name: displayName || userData.user.email?.split("@")[0] || "Player",
    seat,
    ready: false,
  }, { onConflict: "room_id,user_id" });

  if (error) return { error: error.message };
  return { code: room.code, roomId: room.id };
}

export async function createTournament(input: TournamentCreateInput) {
  if (!isSupabaseConfigured()) return { demo: true, id: "demo-tournament" };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Sign in before creating a tournament." };

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      name: input.name,
      host_id: userData.user.id,
      starts_at: input.startsAt,
      max_players: input.maxPlayers,
      rule_config: input.rules,
      status: "registration",
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create tournament." };

  const { error: playerError } = await supabase.from("tournament_players").insert({
    tournament_id: data.id,
    user_id: userData.user.id,
    display_name: userData.user.user_metadata?.display_name ?? userData.user.email?.split("@")[0] ?? "Host",
    seed: 1,
    status: "registered",
  });

  if (playerError) return { error: playerError.message };
  return { id: data.id };
}

export async function joinTournament(tournamentId: string, displayName: string) {
  if (!isSupabaseConfigured()) return { demo: true, id: tournamentId };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Sign in before joining a tournament." };

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, max_players, status")
    .eq("id", tournamentId)
    .single();
  if (tournamentError || !tournament) return { error: "That tournament could not be found." };
  if (tournament.status !== "registration") return { error: "Registration for this tournament is closed." };

  const { count } = await supabase
    .from("tournament_players")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  if ((count ?? 0) >= tournament.max_players) return { error: "That tournament is full." };

  const { error } = await supabase.from("tournament_players").upsert({
    tournament_id: tournamentId,
    user_id: userData.user.id,
    display_name: displayName || userData.user.email?.split("@")[0] || "Player",
    seed: (count ?? 0) + 1,
    status: "registered",
  }, { onConflict: "tournament_id,user_id" });
  if (error) return { error: error.message };
  return { id: tournamentId };
}
