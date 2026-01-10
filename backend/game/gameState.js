// backend/game/gameState.js

class Deck {
  constructor() {
    this.cards = [];
    const suits = ['S', 'H', 'D', 'C'];
    const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

    for (const s of suits) {
      for (const v of values) {
        this.cards.push({ rank: v, suit: s });
      }
    }

    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    return this.cards.pop();
  }
}

class GameState {
  constructor(roomId, players) {
    this.roomId = roomId;

    this.players = players.map(p => ({
      id: p.id,
      socketId: p.socketId,
      hand: [],
      chips: 1000,
      folded: false,
      acted: false
    }));

    this.deck = new Deck();
    this.pot = 0;

    this.currentPlayerIndex = 0;
    this.phase = 'preflop'; // preflop | betting | showdown
  }

  startGame() {
    console.log(`🃏 Dealing cards in room ${this.roomId}`);

    // раздаём по 2 карты
    for (let i = 0; i < 2; i++) {
      this.players.forEach(player => {
        player.hand.push(this.deck.draw());
      });
    }

    this.phase = 'betting';
    this.currentPlayerIndex = 0;
    this.players.forEach(p => {
      p.folded = false;
      p.acted = false;
    });
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextPlayer() {
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
    } while (this.players[this.currentPlayerIndex].folded);
  }

  playerAction(playerId, action) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.folded) return;

    if (action === 'fold') {
      player.folded = true;
      player.acted = true;
    }

    if (action === 'check' || action === 'call') {
      player.acted = true;
    }

    this.nextPlayer();

    if (this.isBettingRoundComplete()) {
      this.phase = 'showdown';
    }
  }

  isBettingRoundComplete() {
    const activePlayers = this.players.filter(p => !p.folded);
    return activePlayers.every(p => p.acted);
  }

  getPublicState() {
    return {
      roomId: this.roomId,
      pot: this.pot,
      phase: this.phase,
      currentPlayerId: this.getCurrentPlayer()?.id,
      players: this.players.map(p => ({
        id: p.id,
        chips: p.chips,
        folded: p.folded,
        cardsCount: p.hand.length
      }))
    };
  }

  getPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    return {
      hand: player.hand,
      chips: player.chips
    };
  }
}

module.exports = GameState;
