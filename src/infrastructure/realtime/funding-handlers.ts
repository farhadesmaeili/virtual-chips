import type { ChipRequest } from '@/application/ports';
import type {
  AdjustMemberChips,
  ApproveChipRequest,
  RejectChipRequest,
  RequestChips,
} from '@/application/use-cases';
import type { RateLimiter } from './rate-limiter';
import { toPublicChipRequest, toPublicRoomState } from './room-projection';
import {
  adjustChipsSchema,
  chipsApproveSchema,
  chipsRejectSchema,
  chipsRequestSchema,
} from './schemas';
import { emitError, handleError } from './socket-errors';
import type { AppServer, AppSocket } from './socket-auth';

export interface FundingHandlerDeps {
  readonly requestChips: RequestChips;
  readonly approveChipRequest: ApproveChipRequest;
  readonly rejectChipRequest: RejectChipRequest;
  readonly adjustMemberChips: AdjustMemberChips;
  /** Anti-spam limiter for player-initiated chip requests. */
  readonly requestLimiter: RateLimiter;
}

function broadcastRequests(
  io: AppServer,
  roomId: string,
  requests: readonly ChipRequest[],
): void {
  io.to(roomId).emit('chips:requests', {
    requests: requests.map(toPublicChipRequest),
  });
}

/**
 * Binds the chip-request (buy-in) events (task 4.15). A seated player requests
 * chips; the banker approves or rejects. Authorization (member / banker) and
 * the chip movement live in the use-cases — never trusted from the client.
 */
export function registerFundingHandlers(
  io: AppServer,
  socket: AppSocket,
  deps: FundingHandlerDeps,
): void {
  const userId = socket.data.user.id;

  socket.on('chips:request', (payload: unknown) => {
    void (async () => {
      const parsed = chipsRequestSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid chips:request payload');
        return;
      }
      if (!deps.requestLimiter.tryAcquire(userId)) {
        emitError(socket, 'RATE_LIMITED', 'Too many requests; slow down');
        return;
      }
      try {
        const requests = await deps.requestChips.execute({
          roomId: parsed.data.roomId,
          userId,
          amount: parsed.data.amount,
        });
        broadcastRequests(io, parsed.data.roomId, requests);
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });

  socket.on('chips:approve', (payload: unknown) => {
    void (async () => {
      const parsed = chipsApproveSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid chips:approve payload');
        return;
      }
      try {
        // Banker-only; the use-case enforces authorization.
        const { snapshot, requests } = await deps.approveChipRequest.execute({
          roomId: parsed.data.roomId,
          requesterId: userId,
          requestId: parsed.data.requestId,
        });
        io.to(parsed.data.roomId).emit(
          'room:state',
          toPublicRoomState(snapshot),
        );
        broadcastRequests(io, parsed.data.roomId, requests);
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });

  // Banker directly adjusts a member's chips (task 6.7). Mirrors chips:approve:
  // changes a member's chips, then broadcasts the fresh room:state. Banker-only
  // and the between-hands / floor guards live in the use-case.
  socket.on('banker:adjustChips', (payload: unknown) => {
    void (async () => {
      const parsed = adjustChipsSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(
          socket,
          'INVALID_PAYLOAD',
          'Invalid banker:adjustChips payload',
        );
        return;
      }
      try {
        const { snapshot } = await deps.adjustMemberChips.execute({
          roomId: parsed.data.roomId,
          requesterId: userId,
          targetSeat: parsed.data.seat,
          amount: parsed.data.amount,
        });
        io.to(parsed.data.roomId).emit(
          'room:state',
          toPublicRoomState(snapshot),
        );
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });

  socket.on('chips:reject', (payload: unknown) => {
    void (async () => {
      const parsed = chipsRejectSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid chips:reject payload');
        return;
      }
      try {
        const requests = await deps.rejectChipRequest.execute({
          roomId: parsed.data.roomId,
          requesterId: userId,
          requestId: parsed.data.requestId,
        });
        broadcastRequests(io, parsed.data.roomId, requests);
      } catch (error) {
        handleError(socket, error);
      }
    })();
  });
}
