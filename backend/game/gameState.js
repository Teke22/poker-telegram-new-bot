const HandEvaluator = require('./HandEvaluator');

/**
 * GameState — полностью автономная логика покера (Texas Hold'em)
 */
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

    this.stage = 'waiting'; // waiting | preflop | flop | turn | river | showdown
    this.pot = 0;
    this.communityCards = [];
    this.currentPlayerIndex = 0;
    this.finished = false;

    this.deck = this.createDeck();
    this.shuffleDeck();
  }

  /* ================== DECK ================== */

  createDeck() {
    const suits = ['h', 'd', 'c', 's'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit });
      }
    }
    return deck;
  }

  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  draw() {
    return this.deck.pop();
  }

  /* ================== GAME FLOW ================== */

  startGame() {
    if (this.players.length < 2) return false;

    this.stage = 'preflop';
    this.finished = false;
    this.communityCards = [];
    this.pot = 0;

    // раздаём по 2 карты
    this.players.forEach(player => {
      player.hand = [this.draw(), this.draw()];
      player.folded = false;
      player.bet = 0;
    });

    return true;
  }

  nextStage() {
    if (this.stage === 'preflop') {
      this.stage = 'flop';
      this.communityCards.push(this.draw(), this.draw(), this.draw());
    } else if (this.stage === 'flop') {
      this.stage = 'turn';
      this.communityCards.push(this.draw());
    } else if (this.stage === 'turn') {
      this.stage = 'river';
      this.communityCards.push(this.draw());
    } else if (this.stage === 'river') {
      this.stage = 'showdown';
      this.finishGame();
    }
  }

  /* ================== ACTIONS ================== */

  playerAction(playerId, action) {
    if (this.finished) return;

    const player = this.players.find(p => p.id === playerId);
    if (!player || player.folded) return;

    if (action.type === 'fold') {
      player.folded = true;
    }

    if (action.type === 'call') {
      const amount = action.amount || 0;
      if (player.chips >= amount) {
        player.chips -= amount;
        player.bet += amount;
        this.pot += amount;
      }
    }

    if (action.type === 'check') {
      // ничего не делаем
    }

    // если остался 1 игрок — конец
    const active = this.players.filter(p => !p.folded);
    if (active.length === 1) {
      active[0].chips += this.pot;
      this.finished = true;
    }
  }

  /* ================== SHOWDOWN ================== */

  finishGame() {
    const activePlayers = this.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      activePlayers[0].chips += this.pot;
      this.finished = true;
      return;
    }

    // оцениваем руки
    const results = activePlayers.map(player => {
      const hand = HandEvaluator.evaluate([
        ...player.hand,
        ...this.communityCards
      ]);
      return { player, hand };
    });

    // сортировка по силе руки
    results.sort((a, b) => HandEvaluator.compareHands(b.hand, a.hand));

    const best = results[0].hand;
    const winners = results.filter(r =>
      HandEvaluator.compareHands(r.hand, best) === 0
    );

    const winAmount = Math.floor(this.pot / winners.length);
    winners.forEach(w => {
      w.player.chips += winAmount;
    });

    this.winners = winners.map(w => ({
      id: w.player.id,
      name: w.player.name,
      hand: w.hand.name
    }));

    this.finished = true;
  }

  /* ================== STATE ================== */

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
      })),
      finished: this.finished,
      winners: this.winners || []
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
    }
  }
}

module.exports = { GameState };
