class HandEvaluator {
  static evaluate(cards) {
    const ranks = cards.map(c => c.value).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);

    const counts = {};
    for (const r of ranks) {
      counts[r] = (counts[r] || 0) + 1;
    }

    const valuesByCount = Object.entries(counts)
      .map(([value, count]) => ({ value: Number(value), count }))
      .sort((a, b) => b.count - a.count || b.value - a.value);

    const isFlush = this.isFlush(suits);
    const straightHigh = this.getStraightHigh(ranks);

    // Royal Flush
    if (isFlush && straightHigh === 14) {
      return { rank: 10, name: 'Royal Flush', high: 14 };
    }

    // Straight Flush
    if (isFlush && straightHigh) {
      return { rank: 9, name: 'Straight Flush', high: straightHigh };
    }

    // Four of a Kind
    if (valuesByCount[0].count === 4) {
      return { rank: 8, name: 'Four of a Kind', high: valuesByCount[0].value };
    }

    // Full House
    if (
      valuesByCount[0].count === 3 &&
      valuesByCount[1].count === 2
    ) {
      return { rank: 7, name: 'Full House', high: valuesByCount[0].value };
    }

    // Flush
    if (isFlush) {
      return { rank: 6, name: 'Flush', high: ranks[0] };
    }

    // Straight
    if (straightHigh) {
      return { rank: 5, name: 'Straight', high: straightHigh };
    }

    // Three of a Kind
    if (valuesByCount[0].count === 3) {
      return { rank: 4, name: 'Three of a Kind', high: valuesByCount[0].value };
    }

    // Two Pair
    if (
      valuesByCount[0].count === 2 &&
      valuesByCount[1].count === 2
    ) {
      return {
        rank: 3,
        name: 'Two Pair',
        high: Math.max(valuesByCount[0].value, valuesByCount[1].value),
      };
    }

    // Pair
    if (valuesByCount[0].count === 2) {
      return { rank: 2, name: 'Pair', high: valuesByCount[0].value };
    }

    // High Card
    return { rank: 1, name: 'High Card', high: ranks[0] };
  }

  static isFlush(suits) {
    return suits.some(
      suit => suits.filter(s => s === suit).length >= 5
    );
  }

  static getStraightHigh(ranks) {
    const unique = [...new Set(ranks)];
    for (let i = 0; i <= unique.length - 5; i++) {
      if (
        unique[i] - unique[i + 4] === 4
      ) {
        return unique[i];
      }
    }
    // A-2-3-4-5
    if (
      unique.includes(14) &&
      unique.includes(5) &&
      unique.includes(4) &&
      unique.includes(3) &&
      unique.includes(2)
    ) {
      return 5;
    }
    return null;
  }
}

module.exports = HandEvaluator;
