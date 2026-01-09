class HandEvaluator {
  // Константы для комбинаций
  static HAND_RANKS = {
    HIGH_CARD: 1,
    PAIR: 2,
    TWO_PAIR: 3,
    THREE_OF_A_KIND: 4,
    STRAIGHT: 5,
    FLUSH: 6,
    FULL_HOUSE: 7,
    FOUR_OF_A_KIND: 8,
    STRAIGHT_FLUSH: 9,
    ROYAL_FLUSH: 10
  };

  static HAND_NAMES = {
    1: 'High Card',
    2: 'Pair',
    3: 'Two Pair',
    4: 'Three of a Kind',
    5: 'Straight',
    6: 'Flush',
    7: 'Full House',
    8: 'Four of a Kind',
    9: 'Straight Flush',
    10: 'Royal Flush'
  };

  // Основной метод оценки руки (7 карт: 2 карты игрока + 5 общих)
  static evaluate(cards) {
    if (!cards || cards.length < 5) {
      return { rank: 0, name: 'Invalid hand', high: 0, cards: [] };
    }

    // Конвертируем карты в числовой формат
    const numericCards = this.convertCards(cards);
    
    // Находим лучшую комбинацию из 5 карт
    const bestHand = this.findBestHand(numericCards);
    
    return bestHand;
  }

  // Конвертация карт в числовой формат
  static convertCards(cards) {
    return cards.map(card => {
      let value;
      const rank = card.rank.toUpperCase();
      
      if (rank === 'A') value = 14;
      else if (rank === 'K') value = 13;
      else if (rank === 'Q') value = 12;
      else if (rank === 'J') value = 11;
      else if (rank === '10') value = 10;
      else value = parseInt(rank);
      
      // Определяем масть
      let suit;
      if (card.suit === '♠' || card.suit === 'spades') suit = 's';
      else if (card.suit === '♥' || card.suit === 'hearts') suit = 'h';
      else if (card.suit === '♦' || card.suit === 'diamonds') suit = 'd';
      else if (card.suit === '♣' || card.suit === 'clubs') suit = 'c';
      else suit = card.suit; // сохраняем как есть
      
      return {
        original: card,
        value: value,
        suit: suit,
        rank: rank
      };
    });
  }

  // Найти лучшую руку из 7 карт
  static findBestHand(cards) {
    // Сортируем по значению (от высокого к низкому)
    const sortedCards = [...cards].sort((a, b) => b.value - a.value);
    
    // Проверяем все возможные комбинации от самой сильной к слабой
    const straightFlush = this.checkStraightFlush(sortedCards);
    if (straightFlush) {
      const isRoyal = straightFlush[0].value === 14 && straightFlush[4].value === 10;
      return {
        rank: isRoyal ? this.HAND_RANKS.ROYAL_FLUSH : this.HAND_RANKS.STRAIGHT_FLUSH,
        name: isRoyal ? 'Royal Flush' : 'Straight Flush',
        high: straightFlush[0].value,
        cards: straightFlush
      };
    }
    
    const fourOfAKind = this.checkFourOfAKind(sortedCards);
    if (fourOfAKind) {
      return {
        rank: this.HAND_RANKS.FOUR_OF_A_KIND,
        name: 'Four of a Kind',
        high: fourOfAKind.value,
        cards: fourOfAKind.cards
      };
    }
    
    const fullHouse = this.checkFullHouse(sortedCards);
    if (fullHouse) {
      return {
        rank: this.HAND_RANKS.FULL_HOUSE,
        name: 'Full House',
        high: fullHouse.threeOfAKind,
        cards: fullHouse.cards
      };
    }
    
    const flush = this.checkFlush(sortedCards);
    if (flush) {
      return {
        rank: this.HAND_RANKS.FLUSH,
        name: 'Flush',
        high: flush[0].value,
        cards: flush
      };
    }
    
    const straight = this.checkStraight(sortedCards);
    if (straight) {
      return {
        rank: this.HAND_RANKS.STRAIGHT,
        name: 'Straight',
        high: straight[0].value,
        cards: straight
      };
    }
    
    const threeOfAKind = this.checkThreeOfAKind(sortedCards);
    if (threeOfAKind) {
      return {
        rank: this.HAND_RANKS.THREE_OF_A_KIND,
        name: 'Three of a Kind',
        high: threeOfAKind.value,
        cards: threeOfAKind.cards
      };
    }
    
    const twoPair = this.checkTwoPair(sortedCards);
    if (twoPair) {
      return {
        rank: this.HAND_RANKS.TWO_PAIR,
        name: 'Two Pair',
        high: twoPair.highPair,
        cards: twoPair.cards
      };
    }
    
    const pair = this.checkPair(sortedCards);
    if (pair) {
      return {
        rank: this.HAND_RANKS.PAIR,
        name: 'Pair',
        high: pair.value,
        cards: pair.cards
      };
    }
    
    // High Card (5 старших карт)
    return {
      rank: this.HAND_RANKS.HIGH_CARD,
      name: 'High Card',
      high: sortedCards[0].value,
      cards: sortedCards.slice(0, 5)
    };
  }

  // Проверка на Straight Flush (и Royal Flush)
  static checkStraightFlush(cards) {
    // Группируем по мастям
    const suits = {};
    cards.forEach(card => {
      if (!suits[card.suit]) suits[card.suit] = [];
      suits[card.suit].push(card);
    });
    
    // Ищем стрит-флеш в каждой масти
    for (const suit in suits) {
      if (suits[suit].length >= 5) {
        const straight = this.checkStraight(suits[suit]);
        if (straight) return straight;
      }
    }
    return null;
  }

  // Проверка на Four of a Kind
  static checkFourOfAKind(cards) {
    const valueCounts = this.countValues(cards);
    
    for (const [value, count] of Object.entries(valueCounts)) {
      if (count === 4) {
        const fourCards = cards.filter(c => c.value === parseInt(value));
        const kicker = cards.find(c => c.value !== parseInt(value));
        return {
          value: parseInt(value),
          cards: [...fourCards.slice(0, 4), kicker].filter(Boolean)
        };
      }
    }
    return null;
  }

  // Проверка на Full House
  static checkFullHouse(cards) {
    const valueCounts = this.countValues(cards);
    let threeValue = null;
    let twoValue = null;
    
    // Ищем трипс
    for (const [value, count] of Object.entries(valueCounts)) {
      if (count >= 3 && !threeValue) {
        threeValue = parseInt(value);
      }
    }
    
    // Ищем пару (может быть вторая тройка)
    for (const [value, count] of Object.entries(valueCounts)) {
      const numValue = parseInt(value);
      if (count >= 2 && numValue !== threeValue) {
        twoValue = numValue;
        break;
      }
    }
    
    // Если не нашли отдельную пару, но есть вторая тройка
    if (!twoValue) {
      for (const [value, count] of Object.entries(valueCounts)) {
        const numValue = parseInt(value);
        if (count >= 3 && numValue !== threeValue) {
          twoValue = numValue;
          break;
        }
      }
    }
    
    if (threeValue && twoValue) {
      const threeCards = cards.filter(c => c.value === threeValue);
      const twoCards = cards.filter(c => c.value === twoValue);
      return {
        threeOfAKind: threeValue,
        pair: twoValue,
        cards: [...threeCards.slice(0, 3), ...twoCards.slice(0, 2)]
      };
    }
    return null;
  }

  // Проверка на Flush
  static checkFlush(cards) {
    const suitCounts = {};
    cards.forEach(card => {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });
    
    for (const [suit, count] of Object.entries(suitCounts)) {
      if (count >= 5) {
        const flushCards = cards
          .filter(c => c.suit === suit)
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        return flushCards;
      }
    }
    return null;
  }

  // Проверка на Straight
  static checkStraight(cards) {
    // Убираем дубликаты по значению
    const uniqueValues = new Set();
    const uniqueCards = [];
    
    for (const card of cards) {
      if (!uniqueValues.has(card.value)) {
        uniqueValues.add(card.value);
        uniqueCards.push(card);
      }
    }
    
    // Сортируем по убыванию
    uniqueCards.sort((a, b) => b.value - a.value);
    
    // Проверяем стрит из 5 карт
    for (let i = 0; i <= uniqueCards.length - 5; i++) {
      if (uniqueCards[i].value - uniqueCards[i + 4].value === 4) {
        return uniqueCards.slice(i, i + 5);
      }
    }
    
    // Проверяем стрит с Ace как 1 (A-2-3-4-5)
    const hasAce = uniqueCards.some(c => c.value === 14);
    const hasFive = uniqueCards.some(c => c.value === 5);
    const hasFour = uniqueCards.some(c => c.value === 4);
    const hasThree = uniqueCards.some(c => c.value === 3);
    const hasTwo = uniqueCards.some(c => c.value === 2);
    
    if (hasAce && hasFive && hasFour && hasThree && hasTwo) {
      const aceCard = uniqueCards.find(c => c.value === 14);
      const lowStraight = [
        { ...aceCard, value: 1 }, // Ace как 1
        ...uniqueCards.filter(c => c.value >= 2 && c.value <= 5)
      ].sort((a, b) => b.value - a.value).slice(0, 5);
      
      return lowStraight;
    }
    
    return null;
  }

  // Проверка на Three of a Kind
  static checkThreeOfAKind(cards) {
    const valueCounts = this.countValues(cards);
    
    for (const [value, count] of Object.entries(valueCounts)) {
      if (count === 3) {
        const threeCards = cards.filter(c => c.value === parseInt(value));
        const kickers = cards
          .filter(c => c.value !== parseInt(value))
          .sort((a, b) => b.value - a.value)
          .slice(0, 2);
        return {
          value: parseInt(value),
          cards: [...threeCards.slice(0, 3), ...kickers]
        };
      }
    }
    return null;
  }

  // Проверка на Two Pair
  static checkTwoPair(cards) {
    const valueCounts = this.countValues(cards);
    const pairs = [];
    
    for (const [value, count] of Object.entries(valueCounts)) {
      if (count >= 2) {
        pairs.push(parseInt(value));
      }
    }
    
    if (pairs.length >= 2) {
      // Сортируем пары по значению
      pairs.sort((a, b) => b - a);
      const highPair = pairs[0];
      const lowPair = pairs[1];
      
      const highPairCards = cards.filter(c => c.value === highPair).slice(0, 2);
      const lowPairCards = cards.filter(c => c.value === lowPair).slice(0, 2);
      const kicker = cards
        .filter(c => c.value !== highPair && c.value !== lowPair)
        .sort((a, b) => b.value - a.value)[0];
      
      return {
        highPair: highPair,
        lowPair: lowPair,
        cards: [...highPairCards, ...lowPairCards, kicker].filter(Boolean)
      };
    }
    return null;
  }

  // Проверка на Pair
  static checkPair(cards) {
    const valueCounts = this.countValues(cards);
    
    for (const [value, count] of Object.entries(valueCounts)) {
      if (count === 2) {
        const pairCards = cards.filter(c => c.value === parseInt(value)).slice(0, 2);
        const kickers = cards
          .filter(c => c.value !== parseInt(value))
          .sort((a, b) => b.value - a.value)
          .slice(0, 3);
        return {
          value: parseInt(value),
          cards: [...pairCards, ...kickers]
        };
      }
    }
    return null;
  }

  // Подсчет количества карт каждого значения
  static countValues(cards) {
    const counts = {};
    cards.forEach(card => {
      counts[card.value] = (counts[card.value] || 0) + 1;
    });
    return counts;
  }

  // Сравнение двух рук (возвращает 1 если hand1 сильнее, -1 если hand2 сильнее, 0 если равны)
  static compareHands(hand1, hand2) {
    // Сначала сравниваем по рангу комбинации
    if (hand1.rank !== hand2.rank) {
      return hand1.rank > hand2.rank ? 1 : -1;
    }
    
    // Если одинаковый ранг, сравниваем по старшей карте комбинации
    if (hand1.high !== hand2.high) {
      return hand1.high > hand2.high ? 1 : -1;
    }
    
    // Сравниваем кикеры
    const values1 = hand1.cards.map(c => c.value).sort((a, b) => b - a);
    const values2 = hand2.cards.map(c => c.value).sort((a, b) => b - a);
    
    for (let i = 0; i < Math.min(values1.length, values2.length); i++) {
      if (values1[i] !== values2[i]) {
        return values1[i] > values2[i] ? 1 : -1;
      }
    }
    
    return 0; // Полное равенство
  }

  // Вспомогательный метод для отладки
  static handToString(hand) {
    return hand.cards.map(c => `${c.rank}${c.original?.suit || c.suit}`).join(' ');
  }
}

module.exports = HandEvaluator;