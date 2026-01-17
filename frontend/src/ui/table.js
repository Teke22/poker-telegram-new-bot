import { renderCard } from './cards.js';
import { stageName } from '../utils/format.js';

export function showGame(state) {
  const app = document.getElementById('app');
  const game = state.game;

  app.innerHTML = `
    <h2>🎯 Poker Table</h2>

    <div>Стадия: ${stageName(game.stage)}</div>
    <div>Банк: 💰 ${game.pot}</div>

    <h3>Карты стола</h3>
    <div>
      ${game.communityCards.map(c => renderCard(c)).join('')}
    </div>

    <h3>Ваши карты</h3>
    <div>
      ${state.myCards.map(c => renderCard(c)).join('')}
    </div>

    <button id="foldBtn">Фолд</button>
    <button id="callBtn">Колл</button>
  `;

  document.getElementById('foldBtn').onclick = () => {
    state.socket.emit('player_action', {
      code: state.room.code,
      playerId: state.me.id,
      action: 'fold'
    });
  };

  document.getElementById('callBtn').onclick = () => {
    state.socket.emit('player_action', {
      code: state.room.code,
      playerId: state.me.id,
      action: { type: 'call' }
    });
  };
}
