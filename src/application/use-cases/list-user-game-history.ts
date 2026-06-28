import type {
  SettlementRepository,
  UserGameSettlement,
} from '@/application/ports';

export interface ListUserGameHistoryInput {
  readonly userId: string;
}

/**
 * Lists the requesting user's finished-game settlements for the history page
 * (task 6.3). Read-only. The `userId` is always the authenticated session user
 * (supplied by the socket handler from `socket.data.user`), never a client
 * value — so the result can only ever be the caller's own history. Net is read
 * straight from the persisted Settlement rows; nothing is recomputed.
 */
export class ListUserGameHistory {
  constructor(private readonly settlements: SettlementRepository) {}

  async execute({
    userId,
  }: ListUserGameHistoryInput): Promise<UserGameSettlement[]> {
    return this.settlements.listForUser(userId);
  }
}
