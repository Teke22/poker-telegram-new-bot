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
      contributedToPot: 0,
      handRank: null,
      handDescription: null,
      best5Cards: null,
    }));

    this.deck = [];
    this.communityCards = [];
    this.totalPot = 0;
    this.sidePots = [];

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
    this.winningHandDescription = null;
    this.handHistory = [];
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
    this.totalPot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.lastRaise = BIG_BLIND;
    this.minRaise = BIG_BLIND;
    this.stage = 'preflop';
    this.finished = false;
    this.winners = [];
    this.winningHandName = null;
    this.winningHandDescription = null;

    // Раздаем карты
    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
      p.bet = 0;
      p.contributedToPot = 0;
      p.folded = false;
      p.allIn = false;
      p.acted = false;
      p.lastHand = null;
      p.handRank = null;
      p.handDescription = null;
      p.best5Cards = null;
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
    this.totalPot += sbAmount;
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
    this.totalPot += bbAmount;
    this.currentBet = bbAmount;

    if (bbPlayer.chips === 0) {
      bbPlayer.allIn = true;
      bbPlayer.acted = true;
    }

    // Сбрасываем флаги acted для всех кроме all-in
    this.players.forEach(p => {
      if (!p.allIn) {
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
        this._handleCall(player);
        break;

      case 'bet':
        if (this.currentBet > 0) {
          throw new Error('Cannot bet, someone has already bet. Use raise instead.');
        }
        this._handleBet(player, action.amount);
        break;

      case 'raise':
        this._handleRaise(player, action.amount);
        break;

      case 'allin':
        this._handleAllIn(player);
        break;

      default:
        throw new Error('Unknown command');
    }

    // Проверяем, не завершилась ли игра после действия
    this._checkForEarlyWinner();
    
    if (!this.finished) {
      // Если все активные игроки all-in, сразу идем в шоудаун
      if (this._allPlayersAllIn()) {
        console.log('Все активные игроки all-in, переход к шоудауну');
        this._goToShowdown();
      } else if (this._bettingRoundFinished()) {
        this._nextStage();
      } else {
        this._moveToNextPlayer();
      }
    }
  }

  _allPlayersAllIn() {
    const activePlayers = this.players.filter(p => !p.folded);
    return activePlayers.length > 0 && activePlayers.every(p => p.allIn);
  }

  _goToShowdown() {
    console.log('Немедленный переход к шоудауну');
    
    // Добиваем карты до ривера если нужно
    while (this.communityCards.length < 5) {
      this.communityCards.push(this.deck.pop());
    }
    
    this.stage = 'showdown';
    this.finishShowdown();
  }

  _handleCall(player) {
    const toCall = this.currentBet - player.bet;
    if (toCall <= 0) {
      throw new Error('Cannot call, no bet to call');
    }

    const callAmount = Math.min(toCall, player.chips);
    player.chips -= callAmount;
    player.bet += callAmount;
    player.contributedToPot += callAmount;
    this.totalPot += callAmount;

    if (player.chips === 0) {
      player.allIn = true;
      player.acted = true;
    } else {
      player.acted = true;
    }
  }

  _handleBet(player, amount) {
    if (amount < BIG_BLIND) {
      throw new Error(`Minimum bet is ${BIG_BLIND}`);
    }

    const totalAmount = player.bet + amount;
    if (amount > player.chips) {
      throw new Error('Not enough chips');
    }

    player.chips -= amount;
    player.bet = totalAmount;
    player.contributedToPot += amount;
    this.totalPot += amount;

    this.currentBet = totalAmount;
    this.lastRaise = amount;
    this.minRaise = Math.max(this.lastRaise, BIG_BLIND);

    this._resetActedFlags();
    player.acted = true;

    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  _handleRaise(player, amount) {
    const totalAmount = player.bet + amount;
    const raiseAmount = totalAmount - this.currentBet;

    // Проверяем минимальный рейз
    const minValidRaise = this.currentBet + this.minRaise;
    if (totalAmount < minValidRaise && totalAmount < (player.chips + player.bet)) {
      throw new Error(`Minimum raise to ${minValidRaise}`);
    }

    if (amount > player.chips) {
      throw new Error('Not enough chips');
    }

    player.chips -= amount;
    player.bet = totalAmount;
    player.contributedToPot += amount;
    this.totalPot += amount;

    this.lastRaise = totalAmount - this.currentBet;
    this.currentBet = totalAmount;
    this.minRaise = Math.max(this.lastRaise, BIG_BLIND);

    this._resetActedFlags();
    player.acted = true;

    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  _handleAllIn(player) {
    const allInAmount = player.chips;
    const totalBet = player.bet + allInAmount;

    if (allInAmount === 0) {
      throw new Error('No chips to go all-in');
    }

    player.chips = 0;
    player.bet = totalBet;
    player.contributedToPot += allInAmount;
    this.totalPot += allInAmount;
    player.allIn = true;
    player.acted = true;

    if (totalBet > this.currentBet) {
      // All-in как рейз
      this.lastRaise = totalBet - this.currentBet;
      this.currentBet = totalBet;
      this.minRaise = Math.max(this.lastRaise, BIG_BLIND);
      this._resetActedFlags();
    }
    
    console.log(`${player.name} идет ALL-IN на ${allInAmount}, общая ставка: ${totalBet}`);
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
    console.log(`Переход на следующую улицу: ${this.stage} -> ${this._getNextStage()}`);
    
    // Создаем side pots если нужно (при наличии олл-инов)
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

    const nextStage = this._getNextStage();
    this.stage = nextStage;

    // Если все активные игроки all-in, сразу переходим к шоудауну
    if (this._allPlayersAllIn()) {
      console.log('Все активные игроки all-in, пропускаем улицы до шоудауна');
      this._goToShowdown();
      return;
    }

    switch (nextStage) {
      case 'flop':
        for (let i = 0; i < 3; i++) {
          this.communityCards.push(this.deck.pop());
        }
        break;
      case 'turn':
        this.communityCards.push(this.deck.pop());
        break;
      case 'river':
        this.communityCards.push(this.deck.pop());
        break;
      case 'showdown':
        this.finishShowdown();
        return;
    }

    // Начинаем с первого активного игрока после дилера
    this.currentPlayerIndex = this._nextActivePlayer(this.dealerIndex);
    console.log(`Новый текущий игрок: ${this.players[this.currentPlayerIndex]?.name}`);
  }

  _getNextStage() {
    switch (this.stage) {
      case 'preflop': return 'flop';
      case 'flop': return 'turn';
      case 'turn': return 'river';
      case 'river': return 'showdown';
      default: return 'showdown';
    }
  }

  _createSidePots() {
    // Создаем side pots только если есть игроки с разным количеством фишек
    const playersWithDifferentBets = this.players
      .filter(p => !p.folded && p.contributedToPot > 0)
      .map(p => p.contributedToPot);
    
    const uniqueBets = [...new Set(playersWithDifferentBets)];
    
    if (uniqueBets.length <= 1) {
      this.sidePots = [];
      return;
    }

    // Сортируем уникальные ставки по возрастанию
    uniqueBets.sort((a, b) => a - b);
    
    this.sidePots = [];
    let previousLevel = 0;

    for (let i = 0; i < uniqueBets.length - 1; i++) {
      const currentLevel = uniqueBets[i];
      const levelAmount = currentLevel - previousLevel;
      
      // Находим игроков, которые могут претендовать на этот банк
      const eligiblePlayers = this.players.filter(p => 
        !p.folded && p.contributedToPot >= currentLevel
      );

      let potAmount = 0;
      eligiblePlayers.forEach(p => {
        const contribution = Math.min(levelAmount, p.contributedToPot - previousLevel);
        potAmount += contribution;
      });

      if (potAmount > 0) {
        this.sidePots.push({
          amount: potAmount,
          level: currentLevel,
          eligiblePlayers: eligiblePlayers.map(p => p.id)
        });
      }

      previousLevel = currentLevel;
    }
    
    console.log(`Создано side pots: ${this.sidePots.length}`);
  }

  finishShowdown() {
    console.log('Запуск шоудауна...');
    
    const activePlayers = this.players.filter(p => !p.folded);

    if (activePlayers.length === 0) {
      this.finished = true;
      return;
    }

    // Создаем side pots перед распределением
    this._createSidePots();

    // Оцениваем руки всех активных игроков
    console.log('Оценка комбинаций:');
    activePlayers.forEach(player => {
      const handResult = this._evaluateHand(player);
      player.handRank = handResult;
      player.handDescription = this._getHandDescription(handResult);
      console.log(`${player.name}: ${player.handDescription} - ${JSON.stringify(player.hand)}`);
    });

    // Распределяем фишки
    this._distributePots();

    // Определяем победителей для отображения
    if (this.winners.length > 0) {
      const winningPlayer = this.winners[0];
      this.winningHandName = winningPlayer.handRank?.name || 'Win';
      this.winningHandDescription = winningPlayer.handDescription || 'Выигрыш';
      console.log(`Победитель: ${winningPlayer.name} с комбинацией ${this.winningHandName}`);
    }

    this.finished = true;
    console.log('Игра завершена');
  }

  _getHandDescription(hand) {
    if (!hand) return '';
    
    const name = hand.name;
    const descr = hand.descr || '';
    
    // Улучшаем читаемость описания комбинаций
    const descriptions = {
      'Straight Flush': 'Стрит-флеш',
      'Four of a Kind': 'Каре',
      'Full House': 'Фулл-хаус',
      'Flush': 'Флеш',
      'Straight': 'Стрит',
      'Three of a Kind': 'Тройка',
      'Two Pair': 'Две пары',
      'Pair': 'Пара',
      'High Card': 'Старшая карта'
    };
    
    const russianName = descriptions[name] || name;
    
    // Упрощаем описание для русскоязычных пользователей
    if (descr) {
      const cleanDescr = descr
        .replace(name + ': ', '')
        .replace(/J/g, 'Валет')
        .replace(/Q/g, 'Дама')
        .replace(/K/g, 'Король')
        .replace(/A/g, 'Туз')
        .replace(/T/g, '10')
        .replace(/s/g, '♠')
        .replace(/h/g, '♥')
        .replace(/d/g, '♦')
        .replace(/c/g, '♣');
      
      return `${russianName} (${cleanDescr})`;
    }
    
    return russianName;
  }

  _evaluateHand(player) {
    const allCards = [...player.hand, ...this.communityCards];
    
    const cardStrings = allCards.map(card => {
      const rank = card.rank;
      const suit = card.suit.toLowerCase();
      return rank + suit;
    });

    try {
      return Hand.solve(cardStrings);
    } catch (error) {
      console.error('Error evaluating hand:', error);
      console.error('Card strings:', cardStrings);
      console.error('Player cards:', player.hand);
      console.error('Community cards:', this.communityCards);
      // В случае ошибки возвращаем базовую оценку
      return { name: 'High Card', descr: 'Старшая карта' };
    }
  }

  _distributePots() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Если только один активный игрок, он получает весь банк
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner.chips += this.totalPot;
      this.winners = [winner];
      console.log(`${winner.name} получает весь банк: ${this.totalPot}`);
      return;
    }

    // Сначала распределяем side pots (если есть)
    this.sidePots.forEach((sidePot, index) => {
      if (sidePot.amount > 0) {
        const eligiblePlayers = activePlayers.filter(p => 
          sidePot.eligiblePlayers.includes(p.id)
        );
        
        if (eligiblePlayers.length === 1) {
          // Один игрок получает весь side pot
          eligiblePlayers[0].chips += sidePot.amount;
          if (!this.winners.some(w => w.id === eligiblePlayers[0].id)) {
            this.winners.push(eligiblePlayers[0]);
          }
          console.log(`${eligiblePlayers[0].name} получает side pot ${index + 1}: ${sidePot.amount}`);
        } else if (eligiblePlayers.length > 1) {
          // Определяем победителей для этого side pot
          const hands = eligiblePlayers.map(p => p.handRank);
          const winningHands = Hand.winners(hands);
          const winners = eligiblePlayers.filter(p => 
            winningHands.some(winningHand => winningHand.toString() === p.handRank.toString())
          );
          
          const share = Math.floor(sidePot.amount / winners.length);
          const remainder = sidePot.amount % winners.length;
          
          winners.forEach((winner, idx) => {
            const amount = share + (idx < remainder ? 1 : 0);
            winner.chips += amount;
            if (!this.winners.some(w => w.id === winner.id)) {
              this.winners.push(winner);
            }
            console.log(`${winner.name} получает часть side pot ${index + 1}: ${amount}`);
          });
        }
      }
    });

    // Распределяем оставшийся главный банк
    const sidePotsTotal = this.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
    const mainPotAmount = this.totalPot - sidePotsTotal;
    
    if (mainPotAmount > 0) {
      // Главный банк получают все активные игроки
      const hands = activePlayers.map(p => p.handRank);
      const winningHands = Hand.winners(hands);
      const winners = activePlayers.filter(p => 
        winningHands.some(winningHand => winningHand.toString() === p.handRank.toString())
      );
      
      const share = Math.floor(mainPotAmount / winners.length);
      const remainder = mainPotAmount % winners.length;
      
      winners.forEach((winner, idx) => {
        const amount = share + (idx < remainder ? 1 : 0);
        winner.chips += amount;
        if (!this.winners.some(w => w.id === winner.id)) {
          this.winners.push(winner);
        }
        console.log(`${winner.name} получает часть главного банка: ${amount}`);
      });
    }
  }

  _checkForEarlyWinner() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner.chips += this.totalPot;
      this.winners = [winner];
      this.winningHandName = 'Победа по фолду';
      this.winningHandDescription = 'Все оппоненты сбросили карты';
      this.finished = true;
      console.log(`Досрочный победитель: ${winner.name} получает ${this.totalPot}`);
      return true;
    }
    return false;
  }

  /* ================= HELPERS ================= */

  _bettingRoundFinished() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Если все активные игроки all-in, раунд завершен
    if (activePlayers.every(p => p.allIn)) {
      console.log('Все активные игроки all-in, раунд завершен');
      return true;
    }
    
    // Иначе проверяем стандартные условия
    const allDone = activePlayers.every(p => {
      return p.allIn || (p.acted && p.bet === this.currentBet);
    });
    
    console.log(`Раунд торговли завершен: ${allDone}`);
    return allDone;
  }

  _moveToNextPlayer() {
    const startIndex = this.currentPlayerIndex;
    let nextIndex = this._nextActivePlayer(startIndex);
    
    while (nextIndex !== startIndex) {
      const player = this.players[nextIndex];
      
      if (!player.folded && !player.allIn && !player.acted) {
        this.currentPlayerIndex = nextIndex;
        console.log(`Новый текущий игрок: ${this.currentPlayerIndex} (${player.name})`);
        return;
      }
      nextIndex = this._nextActivePlayer(nextIndex);
    }
    
    // Если не нашли следующего игрока, проверяем завершение раунда
    if (this._bettingRoundFinished()) {
      this._nextStage();
    } else {
      console.log('Ошибка: не найден следующий игрок, но раунд не завершен!');
      // Аварийный переход на следующую стадию
      this._nextStage();
    }
  }

  _nextActivePlayer(from) {
    let i = (from + 1) % this.players.length;
    const start = i;
    
    do {
      if (!this.players[i].folded) {
        return i;
      }
      i = (i + 1) % this.players.length;
    } while (i !== start);
    
    return from;
  }

  _initDeck() {
    const suits = ['s', 'h', 'd', 'c'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    
    this.deck = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        this.deck.push({ rank, suit });
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
      pot: this.totalPot,
      totalPot: this.totalPot,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      communityCards: this.communityCards,
      dealerIndex: this.dealerIndex,
      sbIndex: this.sbIndex,
      bbIndex: this.bbIndex,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      finished: this.finished,
      winningHandName: this.winningHandName,
      winningHandDescription: this.winningHandDescription,
      winners: this.winners.map(w => ({ 
        id: w.id, 
        name: w.name,
        handRank: w.handRank?.name,
        handDescription: w.handDescription
      })),
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        contributedToPot: p.contributedToPot,
        showHand: this.finished || p.folded ? p.hand : [],
        handRank: this.finished ? p.handRank?.name : null,
        handDescription: this.finished ? p.handDescription : null
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    const toCall = this.currentBet - player.bet;
    const minRaiseAmount = Math.max(
      this.currentBet + this.minRaise,
      BIG_BLIND
    );
    const maxRaiseAmount = player.chips + player.bet;

    return {
      hand: player.hand,
      canCheck: toCall === 0,
      canCall: toCall > 0 && toCall <= player.chips,
      canBet: this.currentBet === 0 && player.chips > 0,
      canRaise: player.chips > 0 && toCall < player.chips,
      minBetAmount: BIG_BLIND,
      minRaiseAmount: Math.min(minRaiseAmount, maxRaiseAmount),
      maxRaiseAmount: maxRaiseAmount,
      toCall: toCall,
      chips: player.chips,
      isAllIn: player.allIn
    };
  }

  /* ================= DEBUG ================= */

  debugHands() {
    console.log('\n=== DEBUG HANDS ===');
    console.log('Community cards:', this.communityCards);
    
    this.players.forEach(player => {
      if (!player.folded) {
        console.log(`Player ${player.name}:`);
        console.log('  Cards:', player.hand);
        console.log('  Hand rank:', player.handRank?.name);
        console.log('  Hand desc:', player.handDescription);
      }
    });
    console.log('==================\n');
  }

  debugState() {
    console.log('\n=== GAME STATE DEBUG ===');
    console.log('Stage:', this.stage);
    console.log('Current bet:', this.currentBet);
    console.log('Total pot:', this.totalPot);
    console.log('Side pots:', this.sidePots.length);
    console.log('Current player:', this.currentPlayerIndex, this.players[this.currentPlayerIndex]?.name);
    console.log('Finished:', this.finished);
    console.log('Players:');
    this.players.forEach((p, i) => {
      console.log(`  [${i}] ${p.name}: chips=${p.chips}, bet=${p.bet}, folded=${p.folded}, allIn=${p.allIn}, acted=${p.acted}, contributed=${p.contributedToPot}`);
    });
    console.log('=======================\n');
  }
}

module.exports = { 
  GameState, 
  SMALL_BLIND, 
  BIG_BLIND, 
  MIN_PLAYERS, 
  MAX_PLAYERS 
};