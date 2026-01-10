const { Hand } = require('pokersolver');

class HandEvaluator {
  /**
   * @param {Array} players - игроки GameState (НЕ folded)
   * @param {Array} communityCards - карты борда
   * @returns {Array} winners (players[])
   */
  static determineWinners(players, communityCards) {
    const solvedHands = [];

    for (const player of players) {
      const cards = [
        ...player.hand,
        ...communityCards
      ].map(c => `${c.rank}${c.suit}`);

      const hand = Hand.solve(cards);
      solvedHands.push({
        player,
        hand
      });
    }

    const winningHands = Hand.winners(solvedHands.map(h => h.hand));

    return solvedHands
      .filter(h => winningHands.includes(h.hand))
      .map(h => h.player);
  }
}

module.exports = { HandEvaluator };
