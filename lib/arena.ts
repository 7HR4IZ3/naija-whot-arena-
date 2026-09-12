import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Card } from '@/lib/cards';
import type { RoomSettings } from '@/lib/rules';

export type Player = { id: string; name: string; ready?: boolean; connected?: boolean; seat?: number; count: number; total: number; roundScore?: number; eliminated: boolean; status?: string };
export type Room = { id: string; code: string; name: string; host: string; me: string; maxPlayers: number; rules: RoomSettings; status: string; players: Player[]; game: string | null };
export type Game = { roomCode?: string; roomHost?: string; recentMoves?: {version:number;message:string}[]; roundResults?: import('@/components/match-extras').RoundResult[]; reactions?: {id:string;name:string;message:string}[]; id: string; version: number; me: string; players: Player[]; hand: Card[]; top: Card; marketCount: number; rules: RoomSettings; turn: number; penalty: number; penaltyType: number; calledSuit: string | null; winner: string | null; status: string; message: string; deadline: string | null; serverTime: string; round: number; tournamentId: string | null; roomId: string | null; tenderTally?: Array<{ id: string; name: string; score: number; eliminated: boolean }>; event: { type: string; actor?: string; card?: Card; count?: number } };
export type MatchHistoryActive = { game_id: string; room_id: string | null; room_code: string | null; room_name: string | null; tournament_id: string | null; round: number; status: string; turn_id: string | null; turn_name: string | null; my_turn: boolean; updated_at: string; message: string; player_count: number };
export type MatchHistoryCompleted = { game_id: string; score: number; won: boolean; created_at: string; tournament_id: string | null; room_id: string | null; room_code: string | null; room_name: string | null; round: number; winner_id: string | null; winner_name: string | null };
export type MatchHistory = { stats?: {mode:string;played:number;wins:number}[]; active: MatchHistoryActive[]; completed: MatchHistoryCompleted[]; history?: MatchHistoryCompleted[]; leaderboard: { display_name: string; games: number; wins: number }[] };
export type Tournament = { id: string; name: string; host: string; me: string; startsAt: string; maxPlayers: number; rules: RoomSettings; status: string; players: Player[]; matches: { id: string; round: number; status: string; winner: string | null; players: { id: string; name: string }[] }[] };

export async function arena<T>(action: string, input: Record<string, unknown> = {}): Promise<T> {
 if (!isSupabaseConfigured()) throw new Error('Online play is not connected yet. You can still play a practice round.');
 const { data, error } = await createClient().rpc('arena', { action, input: { requestId: crypto.randomUUID(), ...input } }).abortSignal(AbortSignal.timeout(15000));
 if (error) throw new Error(error.code === 'PGRST202' ? 'Online tables are awaiting the database update. Please try again after setup.' : error.message);
 return data as T;
}

export function canPlay(game: Game, card: Card) {
 if (game.penalty > 0) return card.value === game.penaltyType && (game.penaltyType === 2 ? game.rules.pickTwoMode : game.rules.pickThreeMode) !== 'none';
 if (card.suit === 'whot') return true;
 if (game.calledSuit) return card.suit === game.calledSuit;
 return game.top.suit === 'whot' || card.suit === game.top.suit || card.value === game.top.value;
}
