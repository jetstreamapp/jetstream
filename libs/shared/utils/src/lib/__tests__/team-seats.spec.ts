import { describe, expect, it } from 'vitest';
import {
  centsToDollars,
  classifySeatChange,
  convertStripePriceTiers,
  getIncludedSeatsFromPriceTiers,
  getPurchasedSeatCount,
} from '../team-seats';

describe('centsToDollars', () => {
  it('converts cents and passes null through', () => {
    expect(centsToDollars(2500)).toBe(25);
    expect(centsToDollars(0)).toBe(0);
    expect(centsToDollars(null)).toBeNull();
    expect(centsToDollars(undefined)).toBeNull();
  });
});

describe('convertStripePriceTiers', () => {
  it('returns null when the price carries no tier table', () => {
    expect(convertStripePriceTiers(undefined)).toBeNull();
    expect(convertStripePriceTiers(null)).toBeNull();
  });

  it('converts each tier to dollars, keeping flat and per-unit amounts distinct', () => {
    expect(
      convertStripePriceTiers([
        { flat_amount: 2500, unit_amount: null, up_to: 5 },
        { flat_amount: null, unit_amount: 500, up_to: null },
      ]),
    ).toEqual([
      { flatAmount: 25, unitAmount: null, upTo: 5 },
      { flatAmount: null, unitAmount: 5, upTo: null },
    ]);
  });
});

describe('getIncludedSeatsFromPriceTiers', () => {
  it('reads the upper bound of a flat first tier', () => {
    expect(getIncludedSeatsFromPriceTiers([{ flatAmount: 25, unitAmount: null, upTo: 5 }])).toBe(5);
  });

  it('treats a $0 flat first tier as included seats rather than a missing flat amount', () => {
    expect(getIncludedSeatsFromPriceTiers([{ flatAmount: 0, unitAmount: null, upTo: 5 }])).toBe(5);
  });

  it('includes nothing for per-seat prices, missing tables or an unbounded first tier', () => {
    expect(getIncludedSeatsFromPriceTiers([{ flatAmount: null, unitAmount: 10, upTo: 5 }])).toBe(0);
    expect(getIncludedSeatsFromPriceTiers([{ flatAmount: 25, unitAmount: null, upTo: null }])).toBe(0);
    expect(getIncludedSeatsFromPriceTiers(null)).toBe(0);
    expect(getIncludedSeatsFromPriceTiers([])).toBe(0);
  });
});

describe('getPurchasedSeatCount', () => {
  it('is the larger of the item quantity and the seats the price includes', () => {
    expect(getPurchasedSeatCount({ quantity: 1, includedSeats: 5 })).toBe(5);
    expect(getPurchasedSeatCount({ quantity: 8, includedSeats: 5 })).toBe(8);
    expect(getPurchasedSeatCount({ quantity: 3, includedSeats: 0 })).toBe(3);
  });
});

describe('classifySeatChange', () => {
  it('classifies relative to the purchased count when nothing is pending', () => {
    expect(classifySeatChange({ requested: 7, purchased: 5, pending: null })).toBe('INCREASE');
    expect(classifySeatChange({ requested: 3, purchased: 5, pending: null })).toBe('DECREASE');
    expect(classifySeatChange({ requested: 5, purchased: 5, pending: null })).toBe('NONE');
  });

  it('returning to the purchased count cancels a pending decrease', () => {
    expect(classifySeatChange({ requested: 5, purchased: 5, pending: 3 })).toBe('CANCEL_PENDING_DECREASE');
  });

  it('treats the pending count as the current target', () => {
    // Requesting the count that is already scheduled is not a change
    expect(classifySeatChange({ requested: 3, purchased: 5, pending: 3 })).toBe('NONE');
    // A different count still replaces the scheduled decrease
    expect(classifySeatChange({ requested: 4, purchased: 5, pending: 3 })).toBe('DECREASE');
    expect(classifySeatChange({ requested: 8, purchased: 5, pending: 3 })).toBe('INCREASE');
  });
});
