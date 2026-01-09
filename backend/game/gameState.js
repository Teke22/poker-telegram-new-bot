const HandEvaluator = require('./handEvaluator');
const config = require('../config');

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
      chips: p.chips ?? config.START_CHIPS,
      hand: [],
      folded: false,
      allIn: false,
      bet: 0,
      hasActed: false // Отслеживаем, сделал ли игрок действие в текущем раунде
    }));

    this.deck = [];
    this.communityCards = [];
    this.stage = 'waiting';
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;
    this.finished = false; // ← ВАЖНО: начинаем с false
    this.roundFinished = false;
    this.actionsInCurrentStage = 0; // Счетчик действий в текущей стадии

    // Ставки
    this.pot = 0;
    this.currentBet = 0;
    this.smallBlind = config.SMALL_BLIND;
    this.bigBlind = config.BIG_BLIND;
    this.lastAggressorIndex = null;
    this.allInPlayers = []; // Игроки, которые сделали all-in
    this.sidePots = []; // Для side pots при all-in
  }

  startGame() {
    console.log('🔄 GameState.startGame() called');
    
    if (this.players.length < 2) {
      console.log('❌ Not enough players');
      this.stage = 'waiting';
      return false;
    }
    
    // Фильтруем игроков с фишками
    const playersWithChips = this.players.filter(p => p.chips > 0);
    if (playersWithChips.length < 2) {
      console.log('❌ Not enough players with chips');
      this.stage = 'waiting';
      return false;
    }
    
    // ⚠️ ВАЖНО: Сбрасываем состояние игры
    this.finished = false; // ← ЭТО ГЛАВНОЕ ИСПРАВЛЕНИЕ!
    this.roundFinished = false;
    this.actionsInCurrentStage = 0;
    this.allInPlayers = [];
    this.sidePots = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastAggressorIndex = null;
    this.communityCards = [];
    
    this.deck = shuffle(createDeck());
    this.stage = 'preflop';
    
    // Сброс состояния игроков
    this.players.forEach(p => {
      if (p.chips > 0) {
        p.hand = [this.deck.pop(), this.deck.pop()];
        p.folded = false;
        p.allIn = false;
        p.bet = 0;
        p.hasActed = false;
      } else {
        // Игрок без фишек не участвует
        p.folded = true;
        p.hand = [];
      }
    });

    // Находим активных игроков для назначения блайндов
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Назначаем блайнды только если есть активные игроки
    if (activePlayers.length >= 2) {
      // Находим индексы игроков для блайндов
      const dealerIndexInActive = activePlayers.findIndex(p => p.id === this.players[this.dealerIndex].id);
      const sbPlayer = activePlayers[(dealerIndexInActive + 1) % activePlayers.length];
      const bbPlayer = activePlayers[(dealerIndexInActive + 2) % activePlayers.length];
      
      const sbIndex = this.players.findIndex(p => p.id === sbPlayer.id);
      const bbIndex = this.players.findIndex(p => p.id === bbPlayer.id);
      
      if (sbIndex >= 0) this.postBlind(sbIndex, this.smallBlind, 'small');
      if (bbIndex >= 0) this.postBlind(bbIndex, this.bigBlind, 'big');
      
      // Текущий игрок после big blind (если есть игроки после BB)
      const nextPlayerIndex = (dealerIndexInActive + 3) % activePlayers.length;
      if (nextPlayerIndex < activePlayers.length) {
        const nextPlayer = activePlayers[nextPlayerIndex];
        const nextPlayerGlobalIndex = this.players.findIndex(p => p.id === nextPlayer.id);
        if (nextPlayerGlobalIndex >= 0) {
          this.currentPlayerIndex = nextPlayerGlobalIndex;
        }
      } else {
        // Если нет игроков после BB, начинаем с первого игрока после дилера
        const firstPlayerAfterDealer = activePlayers[(dealerIndexInActive + 1) % activePlayers.length];
        const firstPlayerIndex = this.players.findIndex(p => p.id === firstPlayerAfterDealer.id);
        if (firstPlayerIndex >= 0) {
          this.currentPlayerIndex = firstPlayerIndex;
        }
      }
      
      this.currentBet = this.bigBlind;
      
      console.log(`🎮 Game started successfully. Dealer: ${this.players[this.dealerIndex]?.name}, Stage: ${this.stage}, Current player: ${this.currentPlayer?.name}, Finished: ${this.finished}`);
      return true;
    } else {
      // Если недостаточно активных игроков, сбрасываем
      this.stage = 'waiting';
      this.finished = true; // Помечаем как завершенную, если не можем начать
      console.log('❌ Not enough active players to start game');
      return false;
    }
  }

  postBlind(playerIndex, amount, type) {
    if (playerIndex < 0 || playerIndex >= this.players.length) return;
    
    const player = this.players[playerIndex];
    if (!player || player.folded) return;
    
    const actualAmount = Math.min(amount, player.chips);
    
    player.chips -= actualAmount;
    player.bet = actualAmount;
    this.pot += actualAmount;
    
    if (player.chips === 0) {
      player.allIn = true;
      this.allInPlayers.push(player.id);
      console.log(`⚠️ ${player.name} goes all-in with blind!`);
    }
    
    console.log(`🎲 ${player.name} posts ${type} blind: ${actualAmount}`);
  }

  get currentPlayer() {
    if (this.currentPlayerIndex < 0 || this.currentPlayerIndex >= this.players.length) {
      return null;
    }
    return this.players[this.currentPlayerIndex];
  }

  nextPlayer() {
    const startIndex = this.currentPlayerIndex;
    let attempts = 0;
    const totalPlayers = this.players.length;
    
    do {
      // Переходим к следующему игроку по кругу
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % totalPlayers;
      attempts++;
      
      // Защита от бесконечного цикла
      if (attempts > totalPlayers * 2) {
        this.currentPlayerIndex = -1;
        console.error('❌ Infinite loop in nextPlayer()');
        break;
      }
      
      const player = this.currentPlayer;
      
      // Если нашли активного игрока, не all-in, выходим
      if (player && !player.folded && !player.allIn) {
        console.log(`👤 Next player: ${player.name} (index: ${this.currentPlayerIndex})`);
        return;
      }
      
    } while (this.currentPlayerIndex !== startIndex);
    
    // Если все игроки all-in или folded, завершаем раунд
    const remainingPlayers = this.players.filter(p => !p.folded && !p.allIn);
    if (remainingPlayers.length === 0) {
      this.currentPlayerIndex = -1;
      console.log('🎲 All remaining players are all-in or folded');
      this.finishBettingRound();
    }
  }

  playerAction(playerId, action) {
    // ⚠️ ВАЖНО: Проверяем finished в начале
    if (this.finished) {
      console.error(`❌ Game is finished! Stage: ${this.stage}, Finished: ${this.finished}`);
      throw new Error('Игра уже завершена');
    }

    if (this.roundFinished) {
      console.log('⚠️ Round finished, waiting for next stage');
      return;
    }

    const player = this.currentPlayer;

    if (!player) {
      console.error('❌ No current player!');
      throw new Error('Нет текущего игрока');
    }

    if (player.id !== playerId) {
      console.error(`❌ Не ваш ход! Текущий игрок: ${player?.name || 'none'}, ID: ${player?.id || 'none'}`);
      console.error(`   Попытка действия от: ${playerId}`);
      throw new Error('Сейчас не ваш ход');
    }

    console.log(`👤 ${player.name} →`, action);
    this.actionsInCurrentStage++;
    player.hasActed = true;

    // Обработка фолда
    if (action === 'fold') {
      player.folded = true;
      console.log(`${player.name} folded`);
      this.nextPlayer();
      this.checkHandCompletion();
      this.checkBettingRoundCompletion();
      return;
    }

    // Обработка чека
    if (action === 'check') {
      // Нельзя чекать, если есть ставка, которую нужно уравнять
      if (this.currentBet > player.bet) {
        throw new Error('Нельзя чекнуть, есть ставка для колла');
      }
      
      console.log(`${player.name} checks`);
      this.nextPlayer();
      this.checkBettingRoundCompletion();
      return;
    }

    // Обработка ставки
    if (action?.type === 'bet') {
      // Нельзя беттить, если уже есть ставка
      if (this.currentBet > 0) {
        throw new Error('Уже есть ставка. Используйте колл или рейз');
      }

      const amount = action.amount;
      if (amount < this.bigBlind) {
        throw new Error(`Минимальная ставка: ${this.bigBlind}`);
      }
      
      if (amount > player.chips) {
        throw new Error('Недостаточно фишек');
      }

      this.makeBet(player, amount);
      this.currentBet = amount;
      this.lastAggressorIndex = this.currentPlayerIndex;
      console.log(`${player.name} bets ${amount}`);
      this.nextPlayer();
      this.checkBettingRoundCompletion();
      return;
    }

    // Обработка колла
    if (action?.type === 'call') {
      const toCall = this.currentBet - player.bet;
      
      if (toCall <= 0) {
        // Если нечего коллить, то это чек
        console.log(`${player.name} checks`);
        this.nextPlayer();
        this.checkBettingRoundCompletion();
        return;
      }

      if (toCall >= player.chips) {
        // All-in
        this.makeBet(player, player.chips);
        player.allIn = true;
        this.allInPlayers.push(player.id);
        console.log(`${player.name} goes all-in for ${player.chips}`);
        
        // Если все игроки all-in или folded, сразу завершаем раунд
        const activeNonAllInPlayers = this.players.filter(p => !p.folded && !p.allIn);
        if (activeNonAllInPlayers.length === 0) {
          this.finishBettingRound();
        }
      } else {
        this.makeBet(player, toCall);
        console.log(`${player.name} calls ${toCall}`);
      }
      
      this.nextPlayer();
      this.checkBettingRoundCompletion();
      return;
    }

    // Обработка рейза
    if (action?.type === 'raise') {
      const minRaise = this.currentBet > 0 ? 
        Math.max(this.currentBet * 2, this.currentBet + this.bigBlind) : 
        this.bigBlind * 2;
      const raiseTo = action.amount;
      
      if (raiseTo < minRaise) {
        throw new Error(`Минимальный рейз: ${minRaise}`);
      }

      const toCall = raiseTo - player.bet;
      
      if (toCall >= player.chips) {
        // All-in (рейз, но не хватает фишек для полного рейза)
        this.makeBet(player, player.chips);
        player.allIn = true;
        this.allInPlayers.push(player.id);
        this.currentBet = Math.max(this.currentBet, player.bet);
        this.lastAggressorIndex = this.currentPlayerIndex;
        console.log(`${player.name} raises all-in for ${player.chips}`);
        
        // Если все игроки all-in или folded, сразу завершаем раунд
        const activeNonAllInPlayers = this.players.filter(p => !p.folded && !p.allIn);
        if (activeNonAllInPlayers.length === 0) {
          this.finishBettingRound();
        }
      } else {
        this.makeBet(player, toCall);
        this.currentBet = raiseTo;
        this.lastAggressorIndex = this.currentPlayerIndex;
        console.log(`${player.name} raises to ${raiseTo}`);
      }
      
      this.nextPlayer();
      this.checkBettingRoundCompletion();
      return;
    }

    throw new Error(`Неизвестное действие: ${action}`);
  }

  makeBet(player, amount) {
    const actualAmount = Math.min(amount, player.chips);
    
    player.chips -= actualAmount;
    player.bet += actualAmount;
    this.pot += actualAmount;
    
    if (player.chips === 0 && !player.allIn) {
      player.allIn = true;
      this.allInPlayers.push(player.id);
      console.log(`⚠️ ${player.name} is now all-in`);
    }
  }

  checkBettingRoundCompletion() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Если остался один игрок, игра завершается
    if (activePlayers.length <= 1) {
      this.finishBettingRound();
      return true;
    }
    
    // Если все активные игроки all-in, завершаем раунд ставок
    const nonAllInPlayers = activePlayers.filter(p => !p.allIn);
    if (nonAllInPlayers.length === 0) {
      console.log('🎲 All players are all-in, finishing betting round');
      this.finishBettingRound();
      return true;
    }
    
    // Проверяем, все ли не-all-in игроки уравняли ставки
    const allMatched = nonAllInPlayers.every(p => p.bet === this.currentBet);
    
    if (!allMatched) {
      return false;
    }
    
    // Проверяем, дошел ли ход до последнего агрессора
    if (this.lastAggressorIndex !== null) {
      // Начинаем с игрока после агрессора
      let currentIndex = (this.lastAggressorIndex + 1) % this.players.length;
      let attempts = 0;
      
      while (attempts < this.players.length) {
        const player = this.players[currentIndex];
        
        if (player && !player.folded && !player.allIn) {
          // Если нашли активного игрока с неравной ставкой
          if (player.bet < this.currentBet) {
            return false;
          }
        }
        
        // Если вернулись к агрессору - все уравняли
        if (currentIndex === this.lastAggressorIndex) {
          this.finishBettingRound();
          return true;
        }
        
        currentIndex = (currentIndex + 1) % this.players.length;
        attempts++;
      }
    } else {
      // Если не было ставок (только чеки) - все ли сделали действие?
      const allHaveActed = activePlayers.every(p => p.hasActed || p.allIn);
      if (allHaveActed) {
        this.finishBettingRound();
        return true;
      }
    }
    
    return false;
  }

  finishBettingRound() {
    console.log(`🔁 ${this.stage} betting round finished`);
    this.roundFinished = true;
    
    // Сбрасываем флаги действий игроков
    this.players.forEach(p => {
      p.hasActed = false;
    });
    
    this.actionsInCurrentStage = 0;
    
    // Если есть игроки на all-in, проверяем нужно ли выкладывать карты
    if (this.allInPlayers.length > 0) {
      console.log(`⚠️ All-in players: ${this.allInPlayers.map(id => this.players.find(p => p.id === id)?.name).join(', ')}`);
      
      // Если на ривере или все игроки all-in, завершаем игру
      if (this.stage === 'river' || this.players.filter(p => !p.folded && !p.allIn).length === 0) {
        console.log('🏁 All-in situation, proceeding to showdown');
        this.finishHand();
        return;
      }
    }
    
    // Немедленно переходим к следующей стадии
    setTimeout(() => {
      this.advanceStage();
    }, 100);
  }

  advanceStage() {
    this.roundFinished = false;
    
    // Если все игроки all-in, выкладываем все карты до ривера
    const nonAllInPlayers = this.players.filter(p => !p.folded && !p.allIn);
    if (nonAllInPlayers.length === 0 && this.stage !== 'river') {
      console.log('🎲 All players all-in, dealing remaining cards');
      while (this.stage !== 'river') {
        this.dealRemainingCards();
      }
    }
    
    switch (this.stage) {
      case 'preflop':
        this.stage = 'flop';
        this.dealCommunityCards(3);
        console.log('🟢 FLOP:', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        this.resetForNewStage();
        break;
        
      case 'flop':
        this.stage = 'turn';
        this.dealCommunityCards(1);
        console.log('🟡 TURN:', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        this.resetForNewStage();
        break;
        
      case 'turn':
        this.stage = 'river';
        this.dealCommunityCards(1);
        console.log('🔵 RIVER:', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        this.resetForNewStage();
        break;
        
      case 'river':
        console.log('🏁 SHOWDOWN');
        this.finishHand();
        break;
    }
  }

  dealRemainingCards() {
    switch (this.stage) {
      case 'preflop':
        this.stage = 'flop';
        this.dealCommunityCards(3);
        console.log('🟢 FLOP (all-in):', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        break;
        
      case 'flop':
        this.stage = 'turn';
        this.dealCommunityCards(1);
        console.log('🟡 TURN (all-in):', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        break;
        
      case 'turn':
        this.stage = 'river';
        this.dealCommunityCards(1);
        console.log('🔵 RIVER (all-in):', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        break;
    }
  }

  resetForNewStage() {
    // Сбрасываем ставки для нового раунда
    this.currentBet = 0;
    this.lastAggressorIndex = null;
    this.players.forEach(p => {
      p.bet = 0;
    });
    
    // Устанавливаем первого активного игрока после дилера
    this.setFirstPlayerAfterDealer();
  }

  setFirstPlayerAfterDealer() {
    // Находим первого активного игрока после дилера
    for (let i = 1; i <= this.players.length; i++) {
      const index = (this.dealerIndex + i) % this.players.length;
      const player = this.players[index];
      
      if (player && !player.folded && !player.allIn) {
        this.currentPlayerIndex = index;
        console.log(`🎯 First player after dealer: ${player.name} (index: ${index})`);
        return;
      }
    }
    
    // Если не нашли активного не-all-in игрока
    this.currentPlayerIndex = -1;
    
    // Если все игроки all-in, выкладываем оставшиеся карты и завершаем
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length > 0 && activePlayers.every(p => p.allIn)) {
      console.log('🎲 All active players are all-in');
      while (this.stage !== 'river') {
        this.dealRemainingCards();
      }
      this.finishHand();
    }
  }

  dealCommunityCards(count) {
    for (let i = 0; i < count; i++) {
      if (this.deck.length > 0) {
        this.communityCards.push(this.deck.pop());
      }
    }
  }

  checkHandCompletion() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      // Остался один игрок - он победитель
      console.log(`👑 Only one player left: ${activePlayers[0].name}`);
      this.finishHand();
      return true;
    } else if (activePlayers.length === 0) {
      // Все фолднули (маловероятно)
      console.log('🤷 All players folded');
      this.finishHand();
      return true;
    }
    
    return false;
  }

  finishHand() {
    this.finished = true; // ← Устанавливаем флаг завершения
    
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      // Победитель по фолдам
      const winner = activePlayers[0];
      winner.chips += this.pot;
      console.log(`🏆 Winner by fold: ${winner.name} wins ${this.pot}`);
    } else if (activePlayers.length > 1) {
      // Шоудаун с настоящей покерной логикой
      console.log('🏆 SHOWDOWN! Comparing hands with real poker rules...');
      this.determineShowdownWinner();
    } else {
      console.log('🤷 No active players, pot returned');
    }
    
    // Перемещаем дилера для следующей раздачи
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    console.log(`♻️ Next dealer: ${this.players[this.dealerIndex]?.name}`);
    console.log(`🏁 Hand finished. Game finished: ${this.finished}`);
  }

  // НОВЫЙ МЕТОД: Настоящая покерная логика определения победителя
  determineShowdownWinner() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 0) {
      console.log('🤷 No active players in showdown');
      return;
    }
    
    console.log('🃏 Showdown hands:');
    const playerHands = [];
    
    for (const player of activePlayers) {
      // Собираем все карты (2 карты игрока + 5 карт на столе)
      const allCards = [...player.hand, ...this.communityCards];
      
      // Конвертируем карты в формат для HandEvaluator
      const evaluatorCards = allCards.map(card => ({
        rank: card.rank,
        suit: card.suit === '♠' ? 'spades' : 
              card.suit === '♥' ? 'hearts' : 
              card.suit === '♦' ? 'diamonds' : 'clubs'
      }));
      
      // Оцениваем руку с помощью HandEvaluator
      const handRank = HandEvaluator.evaluate(evaluatorCards);
      
      console.log(`${player.name}: ${player.hand.map(c => `${c.rank}${c.suit}`).join(' ')} - ${handRank.name}`);
      
      playerHands.push({
        player: player,
        handRank: handRank,
        cards: allCards
      });
    }
    
    // Сортируем игроков по силе руки (от сильной к слабой)
    playerHands.sort((a, b) => {
      return HandEvaluator.compareHands(b.handRank, a.handRank);
    });
    
    // Находим победителей (может быть несколько при равных комбинациях)
    const bestHand = playerHands[0].handRank;
    const winners = playerHands.filter(p => 
      HandEvaluator.compareHands(p.handRank, bestHand) === 0
    );
    
    // Делим банк
    const prize = Math.floor(this.pot / winners.length);
    const remainder = this.pot % winners.length;
    
    console.log(`💰 Pot: ${this.pot}, Winners: ${winners.length}, Prize per winner: ${prize}`);
    
    for (const [index, winner] of winners.entries()) {
      const winAmount = prize + (remainder > 0 && index === 0 ? remainder : 0);
      winner.player.chips += winAmount;
      console.log(`🎯 ${winner.player.name} wins ${winAmount} with ${winner.handRank.name}`);
    }
    
    console.log(`💰 Pot distributed. Winners: ${winners.map(w => w.player.name).join(', ')}`);
  }

  // Обновленный метод для получения победителя
  getWinner() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      return activePlayers[0];
    }
    
    // В шоудауне используем новую логику оценки
    if (activePlayers.length > 1) {
      const playerHands = [];
      
      for (const player of activePlayers) {
        const allCards = [...player.hand, ...this.communityCards];
        const evaluatorCards = allCards.map(card => ({
          rank: card.rank,
          suit: card.suit === '♠' ? 'spades' : 
                card.suit === '♥' ? 'hearts' : 
                card.suit === '♦' ? 'diamonds' : 'clubs'
        }));
        
        const handRank = HandEvaluator.evaluate(evaluatorCards);
        playerHands.push({ player, handRank });
      }
      
      // Находим игрока с лучшей рукой
      let bestPlayer = playerHands[0].player;
      let bestHand = playerHands[0].handRank;
      
      for (let i = 1; i < playerHands.length; i++) {
        if (HandEvaluator.compareHands(playerHands[i].handRank, bestHand) > 0) {
          bestHand = playerHands[i].handRank;
          bestPlayer = playerHands[i].player;
        }
      }
      
      return bestPlayer;
    }
    
    return null;
  }

  // Метод для выхода игрока из игры
  playerLeave(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.folded = true;
      console.log(`🚪 ${player.name} left the table`);
      this.checkHandCompletion();
      
      // Если игра еще не началась, просто удаляем игрока
      if (this.stage === 'waiting') {
        this.players = this.players.filter(p => p.id !== playerId);
      }
    }
  }

  getPublicState() {
    return {
      stage: this.stage,
      finished: this.finished,
      pot: this.pot,
      currentBet: this.currentBet,
      communityCards: this.communityCards,
      currentPlayerId: this.currentPlayer?.id || null,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        folded: p.folded,
        chips: p.chips,
        bet: p.bet,
        allIn: p.allIn,
        hasActed: p.hasActed
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return player ? { hand: player.hand } : null;
  }
}

module.exports = { GameState };