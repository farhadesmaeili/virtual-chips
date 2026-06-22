import { describe, expect, it } from 'vitest';
import type { AppliedActionType } from '@/presentation/lib/socket-events';
import { actionVerbLabel } from './seat-action';

describe('actionVerbLabel', () => {
  it('maps each verb to its display label (verb only, no amount)', () => {
    const cases: ReadonlyArray<[AppliedActionType, string]> = [
      ['FOLD', 'Fold'],
      ['CHECK', 'Check'],
      ['CALL', 'Call'],
      ['BET', 'Bet'],
      ['RAISE', 'Raise'],
      ['ALL_IN', 'All-in'],
    ];
    for (const [verb, label] of cases) {
      expect(actionVerbLabel(verb)).toBe(label);
    }
  });

  it('never contains a digit (no amount leaks into the label)', () => {
    const verbs: AppliedActionType[] = [
      'FOLD',
      'CHECK',
      'CALL',
      'BET',
      'RAISE',
      'ALL_IN',
    ];
    for (const verb of verbs) {
      expect(actionVerbLabel(verb)).not.toMatch(/\d/);
    }
  });

  it('returns an empty string when there is no action (null)', () => {
    expect(actionVerbLabel(null)).toBe('');
  });
});
