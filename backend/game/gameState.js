// backend/game/gameState.js

/* ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---------- */

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

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

/* ---------- GAME STATE ---------- */

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
    this.stage = 'preflop'; // preflop | flop | turn | river | showdown
    this.pot = 0;
  }

  /* ---------- ЗАПУСК ИГРЫ ---------- */

  startGame() {
    this.deck = shuffle(createDeck());
    this.communityCards = [];
    this.stage = 'preflop';
    this.pot = 0;

    // очистка рук
    this.players.forEach(player => {
      player.hand = [];
      player.folded = false;
    });

    // раздача по 2 карты
    this.players.forEach(player => {
      player.hand.push(this.deck.pop());
      player.hand.push(this.deck.pop());
    });

    console.log('🃏 Cards dealt');
  }

  /* ---------- ПУБЛИЧНОЕ СОСТОЯНИЕ ---------- */

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
        cardsCount: p.hand.length
      }))
    };
  }

  /* ---------- ПРИВАТНОЕ СОСТОЯНИЕ ИГРОКА ---------- */

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    return {
      hand: player.hand
    };
  }
}

module.exports = { GameState };
