// backend/game/gameState.js
const { Hand } = require('pokersolver');

const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 9;

class GameState {
  constructor(players) {
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
      throw new Error(`Players count must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`);
    }

    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      hand: [],
      bet: 0,
      folded: false,
      allIn: false,
      acted: false,
      lastHand: null,
      contributedToPot: 0, // Для side pots
    }));

    this.deck = [];
    this.communityCards = [];
    this.mainPot = 0;
    this.sidePots = []; // Массив боковых банков {amount: number, eligiblePlayers: []}

    this.stage = 'preflop';
    this.currentBet = 0;
    this.lastRaise = BIG_BLIND;
    this.minRaise = BIG_BLIND;

    this.dealerIndex = 0;
    this.sbIndex = 0;
    this.bbIndex = 0;
    this.currentPlayerIndex = 0;

    this.finished = false;
    this.winners = [];
    this.winningHandName = null;
  }

  /* ================= INIT ================= */

  startGame() {
    if (this.players.length < MIN_PLAYERS) {
      throw new Error(`Need at least ${MIN_PLAYERS} players to start`);
    }

    // Убираем игроков с 0 фишек
    this.players = this.players.filter(p => p.chips > 0);
    if (this.players.length < MIN_PLAYERS) {
      throw new Error('Not enough players with chips');
    }

    this._initDeck();
    this._shuffle();

    this.communityCards = [];
    this.mainPot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.lastRaise = BIG_BLIND;
    this.minRaise = BIG_BLIND;
    this.stage = 'preflop';
    this.finished = false;
    this.winners = [];
    this.winningHandName = null;

    // Раздаем карты
    this.players.forEach(p => {
      if (p.chips > 0) {
        p.hand = [this.deck.pop(), this.deck.pop()];
      } else {
        p.hand = [];
      }
      p.bet = 0;
      p.contributedToPot = 0;
      p.folded = false;
      p.allIn = false;
      p.acted = false;
      p.lastHand = null;
    });

    // Ротация дилера
    this.dealerIndex = this._nextActivePlayer(this.dealerIndex);
    this._postBlinds();
    
    // Определяем первого игрока для хода (после BB)
    const bbIndex = this.bbIndex;
    this.currentPlayerIndex = this._nextActivePlayer(bbIndex);

    return true;
  }

  _postBlinds() {
    // Находим позиции SB и BB
    this.sbIndex = this._nextActivePlayer(this.dealerIndex);
    this.bbIndex = this._nextActivePlayer(this.sbIndex);

    // Ставим SB
    const sbPlayer = this.players[this.sbIndex];
    const sbAmount = Math.min(SMALL_BLIND, sbPlayer.chips);
    sbPlayer.chips -= sbAmount;
    sbPlayer.bet = sbAmount;
    sbPlayer.contributedToPot = sbAmount;
    this.mainPot += sbAmount;
    if (sbPlayer.chips === 0) {
      sbPlayer.allIn = true;
      sbPlayer.acted = true;
    }

    // Ставим BB
    const bbPlayer = this.players[this.bbIndex];
    const bbAmount = Math.min(BIG_BLIND, bbPlayer.chips);
    bbPlayer.chips -= bbAmount;
    bbPlayer.bet = bbAmount;
    bbPlayer.contributedToPot = bbAmount;
    this.mainPot += bbAmount;
    this.currentBet = bbAmount;
    
    if (bbPlayer.chips === 0) {
      bbPlayer.allIn = true;
      bbPlayer.acted = true;
    }

    // Игроки, которые не могут поставить блайнд, идут all-in
    this.players.forEach((p, idx) => {
      if (p.chips > 0 && !p.allIn) {
        p.acted = false;
      }
    });
  }

  /* ================= ACTIONS ================= */

  playerAction(playerId, action) {
    if (this.finished) throw new Error('Hand finished');

    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (typeof action === 'string') action = { type: action };

    const toCall = this.currentBet - player.bet;
    const maxBet = player.chips + player.bet;

    switch (action.type) {
      case 'fold':
        player.folded = true;
        player.acted = true;
        this._checkForEarlyWinner();
        break;

      case 'check':
        if (toCall > 0) {
          throw new Error('Cannot check, need to call');
        }
        player.acted = true;
        break;

      case 'call':
        if (toCall <= 0) {
          throw new Error('Cannot call, no bet to call');
        }

        const callAmount = Math.min(toCall, player.chips);
        player.chips -= callAmount;
        player.bet += callAmount;
        player.contributedToPot += callAmount;
        this.mainPot += callAmount;

        if (player.chips === 0) {
          player.allIn = true;
          player.acted = true;
        } else {
          player.acted = true;
        }
        break;

      case 'bet':
        // Бет возможен только если никто не ставил до этого на этой улице
        if (this.currentBet > 0) {
          throw new Error('Cannot bet, someone has already bet. Use raise instead.');
        }

        const betAmount = action.amount;
        if (betAmount < BIG_BLIND) {
          throw new Error(`Minimum bet is ${BIG_BLIND}`);
        }
        if (betAmount > maxBet) {
          throw new Error('Not enough chips');
        }

        const betDiff = betAmount - player.bet;
        player.chips -= betDiff;
        player.bet = betAmount;
        player.contributedToPot += betDiff;
        this.mainPot += betDiff;

        this.currentBet = betAmount;
        this.lastRaise = betAmount;
        this.minRaise = betAmount;

        // Сбрасываем acted у всех игроков, кроме all-in
        this._resetActedFlags();

        player.acted = true;
        if (player.chips === 0) player.allIn = true;
        break;

      case 'raise':
        const raiseAmount = action.amount;
        const totalRaise = raiseAmount - player.bet;
        
        // Проверяем минимальный рейз
        const minValidRaise = this.currentBet + this.minRaise;
        if (raiseAmount < minValidRaise && raiseAmount < maxBet) {
          throw new Error(`Minimum raise to ${minValidRaise}`);
        }

        if (totalRaise > player.chips) {
          throw new Error('Not enough chips');
        }

        player.chips -= totalRaise;
        player.bet = raiseAmount;
        player.contributedToPot += totalRaise;
        this.mainPot += totalRaise;

        this.lastRaise = raiseAmount - this.currentBet;
        this.currentBet = raiseAmount;
        this.minRaise = this.lastRaise;

        // Сбрасываем acted у всех игроков, кроме all-in
        this._resetActedFlags();

        player.acted = true;
        if (player.chips === 0) player.allIn = true;
        break;

      case 'allin':
        const allInAmount = player.chips + player.bet;
        
        if (allInAmount <= this.currentBet) {
          // Это по сути колл
          const callDiff = this.currentBet - player.bet;
          player.chips -= callDiff;
          player.bet += callDiff;
          player.contributedToPot += callDiff;
          this.mainPot += callDiff;
        } else {
          // Это рейз
          player.chips = 0;
          player.bet = allInAmount;
          player.contributedToPot += player.chips;
          this.mainPot += player.chips;
          
          this.lastRaise = allInAmount - this.currentBet;
          this.currentBet = allInAmount;
          this.minRaise = Math.max(this.minRaise, this.lastRaise);
          
          this._resetActedFlags();
        }
        
        player.allIn = true;
        player.acted = true;
        break;

      default:
        throw new Error('Unknown command');
    }

    this._checkForEarlyWinner();
    
    if (!this.finished && this._bettingRoundFinished()) {
      this._nextStage();
    } else if (!this.finished) {
      this._moveToNextPlayer();
    }
  }

  _resetActedFlags() {
    this.players.forEach(p => {
      if (!p.folded && !p.allIn) {
        p.acted = false;
      }
    });
  }

  /* ================= FLOW ================= */

  _nextStage() {
    // Создаем side pots если есть all-in игроки
    this._createSidePots();
    
    // Сбрасываем текущие ставки для следующей улицы
    this.players.forEach(p => {
      p.bet = 0;
      if (!p.folded && !p.allIn) {
        p.acted = false;
      }
    });

    this.currentBet = 0;
    this.lastRaise = BIG_BLIND;
    this.minRaise = BIG_BLIND;

    switch (this.stage) {
      case 'preflop':
        this.stage = 'flop';
        this.communityCards.push(
          this.deck.pop(),
          this.deck.pop(),
          this.deck.pop()
        );
        break;
      case 'flop':
        this.stage = 'turn';
        this.communityCards.push(this.deck.pop());
        break;
      case 'turn':
        this.stage = 'river';
        this.communityCards.push(this.deck.pop());
        break;
      case 'river':
        this.stage = 'showdown';
        this.finishShowdown();
        return;
    }

    // Начинаем с первого активного игрока после дилера
    this.currentPlayerIndex = this._nextActivePlayer(this.dealerIndex);
  }

  _createSidePots() {
    // Собираем всех all-in игроков с разными суммами ставок
    const allInPlayers = this.players
      .filter(p => p.allIn && !p.folded && p.contributedToPot > 0)
      .map(p => ({ player: p, amount: p.contributedToPot }))
      .sort((a, b) => a.amount - b.amount);

    if (allInPlayers.length === 0) return;

    let previousAmount = 0;
    for (const allInInfo of allInPlayers) {
      const amount = allInInfo.amount - previousAmount;
      if (amount <= 0) continue;

      // Игроки, которые могут претендовать на этот side pot
      const eligiblePlayers = this.players.filter(p => 
        !p.folded && p.contributedToPot >= allInInfo.amount
      ).map(p => p.id);

      const sidePotAmount = eligiblePlayers.reduce((total, playerId) => {
        const player = this.players.find(p => p.id === playerId);
        return total + Math.min(amount, player.contributedToPot - previousAmount);
      }, 0);

      if (sidePotAmount > 0) {
        this.sidePots.push({
          amount: sidePotAmount,
          eligiblePlayers: eligiblePlayers,
          level: allInInfo.amount
        });
      }

      previousAmount = allInInfo.amount;
    }

    // Вычитаем side pots из main pot
    const totalSidePots = this.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
    this.mainPot -= totalSidePots;
  }

  finishShowdown() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 0) {
      this.finished = true;
      return;
    }

    // Решаем руки для каждого игрока
    activePlayers.forEach(p => {
      const cards = [...p.hand, ...this.communityCards].map(
        c => c.rank + c.suit.toLowerCase()
      );
      p.lastHand = Hand.solve(cards);
    });

    // Обрабатываем main pot
    this._distributePot(this.mainPot, activePlayers.map(p => p.id));

    // Обрабатываем side pots
    for (const sidePot of this.sidePots) {
      const eligiblePlayers = activePlayers.filter(p => 
        sidePot.eligiblePlayers.includes(p.id)
      );
      
      if (eligiblePlayers.length > 0) {
        this._distributePot(sidePot.amount, eligiblePlayers.map(p => p.id));
      }
    }

    this.finished = true;
  }

  _distributePot(potAmount, eligiblePlayerIds) {
    const eligiblePlayers = this.players.filter(p => 
      eligiblePlayerIds.includes(p.id) && !p.folded
    );

    if (eligiblePlayers.length === 0) return;

    // Собираем руки
    const hands = eligiblePlayers.map(p => p.lastHand);
    const winningHands = Hand.winners(hands);

    // Определяем победителей
    const winners = eligiblePlayers.filter(p => 
      winningHands.includes(p.lastHand)
    );

    // Делим банк
    const share = Math.floor(potAmount / winners.length);
    const remainder = potAmount % winners.length;

    winners.forEach((winner, index) => {
      winner.chips += share + (index < remainder ? 1 : 0);
    });

    // Добавляем в общий список победителей
    winners.forEach(winner => {
      if (!this.winners.some(w => w.id === winner.id)) {
        this.winners.push(winner);
      }
    });

    if (this.winningHandName === null && winners.length > 0) {
      this.winningHandName = winners[0].lastHand.name;
    }
  }

  _checkForEarlyWinner() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner.chips += this.mainPot + this.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
      this.winners = [winner];
      this.winningHandName = 'Fold';
      this.finished = true;
    }
  }

  /* ================= HELPERS ================= */

  _bettingRoundFinished() {
    // Все игроки либо сделали действие, либо all-in, либо сбросили
    const activePlayers = this.players.filter(p => !p.folded);
    
    return activePlayers.every(p => {
      if (p.allIn) return true;
      return p.acted && p.bet === this.currentBet;
    });
  }

  _moveToNextPlayer() {
    const startIndex = this.currentPlayerIndex;
    let nextIndex = this._nextActivePlayer(startIndex);
    
    // Ищем игрока, который может сделать ход
    while (nextIndex !== startIndex) {
      const player = this.players[nextIndex];
      if (!player.folded && !player.allIn) {
        this.currentPlayerIndex = nextIndex;
        return;
      }
      nextIndex = this._nextActivePlayer(nextIndex);
    }
    
    // Если дошли сюда, значит только all-in игроки остались
    this._nextStage();
  }

  _nextActivePlayer(from) {
    let i = (from + 1) % this.players.length;
    let iterations = 0;
    
    while (iterations < this.players.length) {
      if (!this.players[i].folded) {
        return i;
      }
      i = (i + 1) % this.players.length;
      iterations++;
    }
    
    return from; // fallback
  }

  _initDeck() {
    const suits = ['s', 'h', 'd', 'c']; // ♠ ♥ ♦ ♣
    const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
    this.deck = [];
    for (const s of suits) {
      for (const r of ranks) {
        this.deck.push({ rank: r, suit: s });
      }
    }
  }

  _shuffle() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  /* ================= STATE ================= */

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.mainPot,
      sidePots: this.sidePots,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      communityCards: this.communityCards,
      dealerIndex: this.dealerIndex,
      sbIndex: this.sbIndex,
      bbIndex: this.bbIndex,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      finished: this.finished,
      winningHandName: this.winningHandName,
      winners: this.winners.map(w => ({ id: w.id, name: w.name })),
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        contributedToPot: p.contributedToPot,
        showHand: (this.finished || p.folded) ? p.hand : []
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const p = this.players.find(x => x.id === playerId);
    if (!p) return null;
    
    return {
      hand: p.hand,
      canCheck: this.currentBet === p.bet,
      canCall: this.currentBet > p.bet && this.currentBet - p.bet <= p.chips,
      canRaise: p.chips > 0 && this.currentBet - p.bet < p.chips,
      minRaiseAmount: Math.max(
        this.currentBet + this.minRaise,
        BIG_BLIND
      ),
      maxRaiseAmount: p.chips + p.bet,
      toCall: this.currentBet - p.bet
    };
  }

  // Дополнительные методы для управления игрой
  removePlayer(playerId) {
    const index = this.players.findIndex(p => p.id === playerId);
    if (index !== -1) {
      const player = this.players[index];
      player.folded = true;
      
      // Если это текущий игрок, переходим к следующему
      if (index === this.currentPlayerIndex) {
        this._moveToNextPlayer();
      }
    }
  }

  addPlayer(player) {
    if (this.players.length >= MAX_PLAYERS) {
      throw new Error('Max players reached');
    }
    
    this.players.push({
      id: player.id,
      name: player.name,
      chips: player.chips,
      hand: [],
      bet: 0,
      folded: false,
      allIn: false,
      acted: false,
      lastHand: null,
      contributedToPot: 0,
    });
    
    return true;
  }
}

module.exports = { GameState, SMALL_BLIND, BIG_BLIND, MIN_PLAYERS, MAX_PLAYERS };