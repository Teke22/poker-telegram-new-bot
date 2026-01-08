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
    this.finished = false; // 🔹 ДОБАВИЛИ
  }

  startGame() {
    this.deck = shuffle(createDeck());
    this.communityCards = [];
    this.stage = 'preflop';
    this.currentPlayerIndex = 0;
    this.finished = false;

    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
      p.folded = false;
    });
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextPlayer() {
    let safety = 0;
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
      safety++;
    } while (this.currentPlayer.folded && safety < this.players.length);
  }

  playerAction(playerId, action) {
    if (this.finished) return;

    const player = this.currentPlayer;

    if (player.id !== playerId) {
      console.log('⛔ Not your turn');
      return; // 🔹 УБРАЛИ throw
    }

    console.log(`👤 ${player.name} → ${action}`);

    if (action === 'fold') {
      player.folded = true;
      this.finishHand();
      return;
    }

    if (action === 'check') {
      this.nextPlayer();
    }
  }

  finishHand() {
    this.finished = true;
    console.log('🏁 Hand finished');
  }

  getPublicState() {
    return {
      stage: this.stage,
      finished: this.finished,
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
