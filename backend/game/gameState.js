const Deck = require('./deck');
const HandEvaluator = require('./handEvaluator');

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      hand: [],
      folded: false,
      bet: 0
    }));

    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;

    this.stage = 'waiting'; // waiting | preflop | finished
    this.currentPlayerIndex = 0;
    this.finished = false;
  }

  startGame() {
    if (this.players.length < 2) {
      return false;
    }

    this.stage = 'preflop';
    this.deck.shuffle();

    // раздаём по 2 карты
    this.players.forEach(player => {
      player.hand = [
        this.deck.draw(),
        this.deck.draw()
      ];
    });

    return true;
  }

  playerAction(playerId, action) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.folded || this.finished) return;

    if (action.type === 'fold') {
      player.folded = true;
    }

    if (action.type === 'call') {
      const bet = action.amount || 0;
      if (player.chips >= bet) {
        player.chips -= bet;
        player.bet += bet;
        this.pot += bet;
      }
    }

    this.checkGameEnd();
  }

  checkGameEnd() {
    const activePlayers = this.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      activePlayers[0].chips += this.pot;
      this.finished = true;
      this.stage = 'finished';
      return;
    }

    // пока сразу считаем шоудаун (временно)
    if (activePlayers.length >= 2) {
      this.resolveShowdown();
    }
  }

  resolveShowdown() {
    const results = this.players
      .filter(p => !p.folded)
      .map(p => ({
        player: p,
        hand: HandEvaluator.evaluate(
          p.hand.map(card => ({
            rank: card.rank,
            suit: card.suit
          }))
        )
      }));

    results.sort((a, b) =>
      HandEvaluator.compareHands(b.hand, a.hand)
    );

    const winner = results[0].player;
    winner.chips += this.pot;

    this.finished = true;
    this.stage = 'finished';
  }

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      communityCards: this.communityCards,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        folded: p.folded,
        bet: p.bet
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    return {
      hand: player.hand
    };
  }

  playerLeave(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.folded = true;
      this.checkGameEnd();
    }
  }
}

module.exports = { GameState };
