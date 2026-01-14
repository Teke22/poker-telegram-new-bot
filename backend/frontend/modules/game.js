import { me, room, gameState, myCards, updateStatus, getPlayerDisplayName, getStageName, renderCard } from './utils.js';
import { socket } from './socket.js';
import { showRoom, leaveRoom } from './room.js';

export function showGame() {
    if (!gameState) return;
    
    const app = document.getElementById('app');
    app.innerHTML = renderGameUI();
    
    updateGameStatus();
    
    if (isMyTurn()) {
        setTimeout(updateActions, 100);
    }
}

// ... остальные функции игры (очень длинные, их нужно разбить на подфункции)
// Я сократил для примера, но вам нужно перенести все функции связанные с игрой

// Экспортируем функции в глобальную область видимости
window.fold = fold;
window.check = check;
window.call = call;
window.allIn = allIn;
window.showBetDialog = showBetDialog;
window.submitBet = submitBet;
window.hideBetDialog = hideBetDialog;
window.startNewHand = startNewHand;