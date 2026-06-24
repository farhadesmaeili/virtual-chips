import type { HandStore, RoomRepository } from '@/application/ports';
import type {
  AdvanceStreet,
  EndGame,
  PlayerAct,
  RequestTimeExtension,
  SettleHand,
  StartHand,
} from '@/application/use-cases';
import type { Hand } from '@/domain/entities';
import { autoActionType, type ActionType } from '@/domain/engine';
import type { PotDeclaration } from '@/domain/engine';
import { toPublicHandState } from './hand-projection';
import { toPublicGameEnded, toPublicRoomState } from './room-projection';
import type { AppServer } from './socket-auth';

/**
 * Owns the live betting flow for all rooms: it runs the hand use-cases,
 * broadcasts the resulting state, and manages one turn timer per room.
 *
 * The timer is deadline-based (the server is authoritative): when a turn's
 * deadline passes, the server applies the auto-action through the SAME
 * PlayerAct path (CHECK if nothing is owed, otherwise FOLD — §6). The timer is
 * reset on every turn change and cleared when betting ends or a room empties,
 * so no zombie timers linger.
 *
 * When the turn lands on a player who is sitting out (task 4.14), that same
 * auto-action is applied immediately rather than after the full timeout, so the
 * table never stalls on a seat whose owner has stepped away. `sittingOut` stays
 * set, so they are excluded from the next hand's deal.
 */
export class HandGateway {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly io: AppServer,
    private readonly startHand: StartHand,
    private readonly playerAct: PlayerAct,
    private readonly advanceStreet: AdvanceStreet,
    private readonly settleHand: SettleHand,
    private readonly requestTimeExtension: RequestTimeExtension,
    private readonly endGameUseCase: EndGame,
    private readonly hands: HandStore,
    private readonly rooms: RoomRepository,
  ) {}

  async start(roomId: string, requesterId: string): Promise<void> {
    const hand = await this.startHand.execute({ roomId, requesterId });
    const state = toPublicHandState(hand);
    this.io.to(roomId).emit('hand:state', state);
    this.io.to(roomId).emit('turn:changed', {
      actingSeat: state.actingSeat,
      actionDeadline: state.actionDeadline,
    });
    await this.resolveTurn(roomId, hand);
  }

  async act(
    roomId: string,
    userId: string,
    action: { type: ActionType; amount?: number },
  ): Promise<void> {
    const { hand, applied } = await this.playerAct.execute({
      roomId,
      userId,
      action,
    });
    const state = toPublicHandState(hand);
    this.io.to(roomId).emit('action:applied', {
      seat: applied.seat,
      action: applied.type,
      amount: applied.amount ?? null,
    });
    this.io.to(roomId).emit('hand:state', state);
    this.io.to(roomId).emit('turn:changed', {
      actingSeat: state.actingSeat,
      actionDeadline: state.actionDeadline,
    });
    this.io.to(roomId).emit('pot:updated', { pots: state.pots });
    await this.resolveTurn(roomId, hand);
  }

  /**
   * Grants the acting player a time-bank extension (task 4.12): pushes their
   * deadline out and re-arms the turn timer for the new, later deadline.
   * `scheduleTimer` clears the existing timer before arming the new one, so the
   * prior auto-action can never still fire against the old deadline (no race).
   */
  async requestTime(roomId: string, userId: string): Promise<void> {
    const hand = await this.requestTimeExtension.execute({ roomId, userId });
    this.scheduleTimer(roomId, hand);
    const state = toPublicHandState(hand);
    this.io.to(roomId).emit('hand:state', state);
    this.io.to(roomId).emit('turn:changed', {
      actingSeat: state.actingSeat,
      actionDeadline: state.actionDeadline,
    });
  }

  async advanceStreetDeal(roomId: string, userId: string): Promise<void> {
    const hand = await this.advanceStreet.execute({
      roomId,
      requesterId: userId,
    });
    const state = toPublicHandState(hand);
    this.io.to(roomId).emit('hand:state', state);
    this.io.to(roomId).emit('turn:changed', {
      actingSeat: state.actingSeat,
      actionDeadline: state.actionDeadline,
    });
    // Starts a timer only if the new street has someone to act; a paused
    // all-in run-out (awaiting_street again) schedules nothing.
    await this.resolveTurn(roomId, hand);
  }

  async settle(
    roomId: string,
    userId: string,
    declarations?: readonly PotDeclaration[],
  ): Promise<void> {
    const { hand, payouts, snapshot } = await this.settleHand.execute({
      roomId,
      requesterId: userId,
      declarations,
    });
    // A settled hand has no turn pending.
    this.clear(roomId);
    this.io.to(roomId).emit('hand:state', toPublicHandState(hand));
    // Members' stacks changed — push the fresh room state too.
    this.io.to(roomId).emit('room:state', toPublicRoomState(snapshot));
    this.io.to(roomId).emit('hand:settled', {
      payouts: [...payouts].map(([seat, amount]) => ({ seat, amount })),
    });
  }

  /**
   * Ends the room's game (banker-only; the use-case enforces it). On success the
   * game is settled and the room is `ended`, so there is no live hand or turn:
   * cancel the per-room turn timer and delete the hand snapshot (so a reconnect
   * resync returns no stale settled hand), then broadcast the projected
   * `game:ended` (seat + net only — no raw userId) and the fresh `room:state`.
   */
  async endGame(roomId: string, userId: string): Promise<void> {
    const result = await this.endGameUseCase.execute({
      roomId,
      requesterId: userId,
    });
    this.clear(roomId);
    await this.hands.clear(roomId);
    this.io.to(roomId).emit('game:ended', toPublicGameEnded(result));
    this.io.to(roomId).emit('room:state', toPublicRoomState(result.snapshot));
  }

  /** Cancels a room's turn timer (e.g. when the room empties). */
  clear(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(roomId);
    }
  }

  /**
   * Decides what happens once it is the acting seat's turn: if that player is
   * sitting out, resolve their turn immediately with the timeout auto-action
   * (so the table never waits on them); otherwise arm the normal turn timer.
   * The auto-action re-enters `act`, which calls back here — so a run of
   * consecutive sitting-out seats is resolved in one pass.
   */
  private async resolveTurn(roomId: string, hand: Hand): Promise<void> {
    if (
      hand.status === 'betting' &&
      hand.actingSeat !== null &&
      (await this.isSeatSittingOut(roomId, hand.actingSeat))
    ) {
      await this.applyAutoAction(roomId, hand);
      return;
    }
    this.scheduleTimer(roomId, hand);
  }

  /** True when the member occupying `seat` has sat out (task 4.14). */
  private async isSeatSittingOut(
    roomId: string,
    seat: number,
  ): Promise<boolean> {
    const members = await this.rooms.listMembers(roomId);
    return members.find((m) => m.seat === seat)?.sittingOut ?? false;
  }

  private scheduleTimer(roomId: string, hand: Hand): void {
    this.clear(roomId);
    if (
      hand.status !== 'betting' ||
      hand.actingSeat === null ||
      hand.actionDeadline === null
    ) {
      return;
    }
    const delay = Math.max(0, hand.actionDeadline - Date.now());
    this.timers.set(
      roomId,
      setTimeout(() => {
        void this.onTimeout(roomId);
      }, delay),
    );
  }

  private async onTimeout(roomId: string): Promise<void> {
    this.timers.delete(roomId);
    const hand = await this.hands.get(roomId);
    if (hand === null) return;
    await this.applyAutoAction(roomId, hand);
  }

  /**
   * Applies the standard auto-action for the acting seat (CHECK when nothing is
   * owed, otherwise FOLD — docs/BETTING-ENGINE.md §6) through the same
   * server-authoritative `act` path used by real and timed-out actions. Used
   * both on timeout and to resolve a sitting-out player's turn immediately.
   */
  private async applyAutoAction(roomId: string, hand: Hand): Promise<void> {
    const type = autoActionType(hand);
    if (type === null) return;
    const player = hand.players.find((p) => p.seat === hand.actingSeat);
    if (player === undefined) return;
    try {
      await this.act(roomId, player.userId, { type });
    } catch {
      // The state changed underneath us (e.g. the hand was settled); ignore.
    }
  }
}
