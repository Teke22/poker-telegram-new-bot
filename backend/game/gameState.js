// backend/game/gameState.js

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }

  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips ?? 1000,
      hand: [],
      folded: false
    }));

    this.deck = [];
    this.communityCards = [];
    this.stage = 'preflop';
    this.currentPlayerIndex = 0;
  }

  startGame() {
    this.deck = shuffle(createDeck());
    this.communityCards = [];
    this.stage = 'preflop';
    this.currentPlayerIndex = 0;

    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
      p.folded = false;
    });
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextPlayer() {
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
    } while (this.currentPlayer.folded);
  }

  playerAction(playerId, action) {
    const player = this.currentPlayer;

    if (player.id !== playerId) {
      throw new Error('Сейчас не ваш ход');
    }

    if (action === 'fold') {
      player.folded = true;
    }

    if (action === 'check') {
      // ничего не меняем
    }

    this.nextPlayer();
  }

  getPublicState() {
    return {
      stage: this.stage,
      currentPlayerId: this.currentPlayer.id,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        folded: p.folded,
        chips: p.chips
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return player ? { hand: player.hand } : null;
  }
}

module.exports = { GameState };
