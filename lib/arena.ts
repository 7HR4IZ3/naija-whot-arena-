import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Card } from '@/lib/cards';
import type { RoomSettings } from '@/lib/rules';

export type Player = { id: string; name: string; ready?: boolean; connected?: boolean; seat?: number; count: number; total: number; roundScore?: number; eliminated: boolean; status?: string };
export type Room = { id: string; code: string; name: string; host: string; me: string; maxPlayers: number; rules: RoomSettings; status: string; players: Player[]; game: string | null };
export type Game = { id: string; version: number; me: string; players: Player[]; hand: Card[]; top: Card; marketCount: number; rules: RoomSettings; turn: number; penalty: number; penaltyType: number; calledSuit: string | null; winner: string | null; status: string; message: string; deadline: string | null; serverTime: string; round: number; tournamentId: string | null; roomId: string | null; tenderTally?: Array<{ id: string; name: string; score: number; eliminated: boolean }>; event: { type: string; actor?: string; card?: Card; count?: number } };
export type Tournament = { id: string; name: string; host: string; me: string; startsAt: string; maxPlayers: number; rules: RoomSettings; status: string; players: Player[]; matches: { id: string; round: number; status: string; winner: string | null; players: { id: string; name: string }[] }[] };

export async function arena<T>(action: string, input: Record<string, unknown> = {}): Promise<T> {
 if (!isSupabaseConfigured()) throw new Error('Online play is not connected yet. You can still play a practice round.');
 const { data, error } = await createClient().rpc('arena', { action, input: { requestId: crypto.randomUUID(), ...input } });
 if (error) throw new Error(error.code === 'PGRST202' ? 'Online tables are awaiting the database update. Please try again after setup.' : error.message);
 return data as T;
}

export function canPlay(game: Game, card: Card) {
 if (game.penalty > 0) return card.value === game.penaltyType && (game.penaltyType === 2 ? game.rules.pickTwoMode : game.rules.pickThreeMode) !== 'none';
 if (card.suit === 'whot') return true;
 if (game.calledSuit) return card.suit === game.calledSuit;
 return game.top.suit === 'whot' || card.suit === game.top.suit || card.value === game.top.value;
}
