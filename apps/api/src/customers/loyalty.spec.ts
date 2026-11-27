import { pointsFor, tierFor } from './loyalty.js';

describe('loyalty', () => {
  it('1 điểm / 10.000đ, làm tròn xuống, không âm', () => {
    expect(pointsFor(569000)).toBe(56);
    expect(pointsFor(9999)).toBe(0);
    expect(pointsFor(-50000)).toBe(0);
  });

  it.each([
    [0, 'STANDARD'],
    [1_199_999, 'STANDARD'],
    [1_200_000, 'SILVER'],
    [3_500_000, 'GOLD'],
    [8_000_000, 'DIAMOND'],
  ])('chi tiêu %i → %s', (spent, tier) => {
    expect(tierFor(spent)).toBe(tier);
  });
});
