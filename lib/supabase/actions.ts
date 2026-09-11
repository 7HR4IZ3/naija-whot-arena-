"use client";
import { arena } from '@/lib/arena';
export type RoomCreateInput = { name: string; maxPlayers: number; rules: Record<string, unknown> };
export type TournamentCreateInput = RoomCreateInput & { startsAt: string };
async function run<T extends { code?: string; id?: string }>(action: string, input: Record<string, unknown>): Promise<{ code?: string; id?: string; error?: string }> {
 try { return await arena<T>(action, input); } catch (e) { return { error: e instanceof Error ? e.message : 'Could not connect. Please retry.' }; }
}
export function createRoom(input: RoomCreateInput) { return run<{ code: string }>('createRoom', input); }
export function joinRoom(code: string, name: string) { return run<{ code: string }>('joinRoom', { code, name }); }
export function createTournament(input: TournamentCreateInput) { return run<{ id: string }>('createTournament', input); }
export function joinTournament(tournament: string, name: string) { return run<{ id: string }>('joinTournament', { tournament, name }); }
