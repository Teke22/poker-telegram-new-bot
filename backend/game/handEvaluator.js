// backend/game/handEvaluator.js
const { Hand } = require('pokersolver');

/**
 * players: [
 *   {
 *     id,
 *     hand: [{rank, suit}, {rank, suit}],
 *     folded
 *   }
 * ]
 *
 * communityCards: [{rank, suit}, ...]
 */
function evaluateHands(players, communityCards) {
  const activePlayers = players.filter(p => !p.folded);

  const solved = activePlayers.map(p => {
    const cards = [
      ...p.hand,
      ...communityCards
    ].map(c => convertCard(c));

    const hand = Hand.solve(cards);

    return {
      playerId: p.id,
      hand,
      cards: p.hand
    };
  });

  const winners = Hand.winners(solved.map(x => x.hand));

  return solved.filter(s => winners.includes(s.hand));
}

/* -------- helpers -------- */

function convertCard(card) {
  const rankMap = {
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    'T': 'T',
    'J': 'J',
    'Q': 'Q',
    'K': 'K',
    'A': 'A'
  };

  const suitMap = {
    '♠': 's',
    '♥': 'h',
    '♦': 'd',
    '♣': 'c'
  };

  return rankMap[card.rank] + suitMap[card.suit];
}

module.exports = {
  evaluateHands
};
