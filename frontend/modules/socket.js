import { me, room, gameState, myCards, winnersShown, showWinnersTimeout, hasNickname } from './utils.js';
import { updateStatus } from './utils.js';
import { showLobby } from './lobby.js';
import { showRoom } from './room.js';
import { showGame } from './game.js';
import { showNicknameDialog } from './nickname.js';

export const socket = io({ transports: ['websocket'] });

socket.on('connect', () => {
    console.log('Connected to server');
    updateStatus('✅ Подключено к серверу');
    
    setTimeout(() => {
        socket.emit('check_nickname_on_enter', { user: me });
    }, 500);
});

socket.on('disconnect', () => {
    updateStatus('❌ Соединение потеряно. Переподключение...');
});

// ... все остальные socket обработчики

export function updateGameState(newState) {
    gameState = newState;
}

// Экспортируем в глобальную область видимости
window.socket = socket;