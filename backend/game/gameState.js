// backend/game/gameState.js
const HandEvaluator = require("./HandEvaluator");

class GameState {
  constructor(roomId, players, DeckClass) {
    this.roomId = roomId;
    this.players = players; // [{ id, socketId }]
    this.DeckClass = DeckClass;

    this.deck = null;
    this.communityCards = [];
    this.stage = "waiting"; // waiting | preflop | flop | turn | river | showdown
    this.hands = new Map(); // playerId -> cards[]
  }

  // ========================
  // START HAND
  // ========================
  startGame() {
    console.log(`🔄 Starting new hand in ${this.roomId}`);

    // создаём новую колоду
    this.deck = new this.DeckClass();

    // активные карты колоды
    let activeCards = [...this.deck.deck];

    // очищаем состояние
    this.communityCards = [];
    this.hands.clear();

    // === раздаём по 2 карты каждому игроку ===
    this.players.forEach(player => {
      const dealt = this.deck.dealCards(activeCards, 2);
      activeCards = dealt[0];

      this.hands.set(player.id, dealt[1]);
    });

    this.deck.deck = activeCards;
    this.stage = "preflop";
  }

  // ========================
  // COMMUNITY CARDS
  // ========================
  dealFlop() {
    if (this.stage !== "preflop") return;

    let dealt = this.deck.dealCards(this.deck.deck, 3);
    this.deck.deck = dealt[0];
    this.communityCards.push(...dealt[1]);

    this.stage = "flop";
  }

  dealTurn() {
    if (this.stage !== "flop") return;

    let dealt = this.deck.dealCards(this.deck.deck, 1);
    this.deck.deck = dealt[0];
    this.communityCards.push(dealt[1][0]);

    this.stage = "turn";
  }

  dealRiver() {
    if (this.stage !== "turn") return;

    let dealt = this.deck.dealCards(this.deck.deck, 1);
    this.deck.deck = dealt[0];
    this.communityCards.push(dealt[1][0]);

    this.stage = "river";
  }

  // ========================
  // SHOWDOWN
  // ========================
  showdown() {
    if (this.stage !== "river") return;

    const results = [];

    for (const player of this.players) {
      const hand = this.hands.get(player.id);

      const allCards = [...hand, ...this.communityCards];

      const evaluated = HandEvaluator.evaluate(
        allCards.map(c => this.normalizeCard(c))
      );

      results.push({
        playerId: player.id,
        hand,
        result: evaluated
      });
    }

    this.stage = "showdown";
    return results;
  }

  // ========================
  // CARD NORMALIZER
  // ========================
  normalizeCard(card) {
    // card: "AH", "10S", "7D"
    const rank = card.slice(0, card.length - 1);
    const suitChar = card[card.length - 1];

    const suitMap = {
      H: "hearts",
      D: "diamonds",
      C: "clubs",
      S: "spades"
    };

    return {
      rank,
      suit: suitMap[suitChar]
    };
  }

  // ========================
  // STATE FOR CLIENT
  // ========================
  getPublicState() {
    return {
      stage: this.stage,
      communityCards: this.communityCards,
      players: this.players.map(p => ({
        id: p.id
      }))
    };
  }

  getPrivateState(playerId) {
    return {
      hand: this.hands.get(playerId) || [],
      communityCards: this.communityCards,
      stage: this.stage
    };
  }
}

module.exports = GameState;
