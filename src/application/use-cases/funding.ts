/**
 * TEMPORARY default buy-in granted automatically when a player sits, so a hand
 * can be dealt (StartHand only deals funded members, chips > 0) before any
 * buy-in flow exists.
 *
 * Task 4.6 (banker view) replaces this with banker-controlled buy-ins / rebuys;
 * at that point seating should grant 0 chips and the banker funds players.
 */
export const DEFAULT_BUY_IN = 1000;
