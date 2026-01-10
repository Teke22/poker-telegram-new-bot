// backend/game/HandEvaluator.js

const { Hand } = require('pokersolver');

class HandEvaluator {
  /**
   * @param players [{ id, hand: [{rank,suit}], folded }]
   * @param communityCards [{rank,suit}]
   */
  static evaluate(players, communityCards) {
    const activePlayers = players.filter(p => !p.folded);

    if (activePlayers.length === 0) return [];

    const solvedHands = activePlayers.map(p => {
      const cards = [...p.hand, ...communityCards].map(c =>
        HandEvaluator._toSolverCard(c)
      );

      return {
        player: p,
        hand: Hand.solve(cards)
      };
    });

    const winners = Hand.winners(solvedHands.map(h => h.hand));

    return solvedHands
      .filter(h => winners.includes(h.hand))
      .map(h => h.player);
  }

  static _toSolverCard(card) {
    // pokersolver формат: "As", "Td", "7h"
    const rankMap = {
      '2':'2','3':'3','4':'4','5':'5','6':'6',
      '7':'7','8':'8','9':'9','T':'T',
      'J':'J','Q':'Q','K':'K','A':'A'
    };

    const suitMap = {
      '♠': 's',
      '♥': 'h',
      '♦': 'd',
      '♣': 'c'
    };

    return rankMap[card.rank] + suitMap[card.suit];
  }
}

module.exports = HandEvaluator;
