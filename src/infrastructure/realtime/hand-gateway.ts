import type { HandStore } from '@/application/ports';
import type {
  AdvanceStreet,
  PlayerAct,
  SettleHand,
  StartHand,
} from '@/application/use-cases';
import type { Hand } from '@/domain/entities';
import { autoActionType, type ActionType } from '@/domain/engine';
import type { PotDeclaration } from '@/domain/engine';
import { toPublicHandState } from './hand-projection';
import { toPublicRoomState } from './room-projection';
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
 */
export class HandGateway {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly io: AppServer,
    private readonly startHand: StartHand,
    private readonly playerAct: PlayerAct,
    private readonly advanceStreet: AdvanceStreet,
    private readonly settleHand: SettleHand,
    private readonly hands: HandStore,
  ) {}

  async start(roomId: string, requesterId: string): Promise<void> {
    const hand = await this.startHand.execute({ roomId, requesterId });
    const state = toPublicHandState(hand);
    this.io.to(roomId).emit('hand:state', state);
    this.io.to(roomId).emit('turn:changed', {
      actingSeat: state.actingSeat,
      actionDeadline: state.actionDeadline,
    });
    this.scheduleTimer(roomId, hand);
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
    this.scheduleTimer(roomId, hand);
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
    this.scheduleTimer(roomId, hand);
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

  /** Cancels a room's turn timer (e.g. when the room empties). */
  clear(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(roomId);
    }
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
    const type = autoActionType(hand);
    if (type === null) return;
    const player = hand.players.find((p) => p.seat === hand.actingSeat);
    if (player === undefined) return;
    try {
      // Auto-action goes through the same server-authoritative path.
      await this.act(roomId, player.userId, { type });
    } catch {
      // The state changed underneath the timer; ignore.
    }
  }
}
