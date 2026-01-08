class BotAI {
  decideAction(game, player) {
    const stage = game.stage;
    const currentBet = game.currentBet;
    const callAmount = currentBet - player.currentBet;

    // если можно чекнуть — чаще чекаем
    if (callAmount === 0) {
      if (Math.random() < 0.8) {
        return { action: 'check' };
      }

      // редкий бет
      return { action: 'bet', amount: 20 };
    }

    // если нужно коллить
    if (callAmount > 0) {
      // иногда фолдим
      if (Math.random() < 0.3) {
        return { action: 'fold' };
      }

      return { action: 'call' };
    }

    return { action: 'check' };
  }
}

module.exports = BotAI;
