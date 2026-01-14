import { initUser, updateStatus } from './modules/utils.js';
import { showLobby } from './modules/lobby.js';

// Инициализация приложения
function initApp() {
    initUser();
    
    document.getElementById('app').innerHTML = `
        <div style="text-align:center; padding:50px;">
            <h2 style="color:#2ecc71;">🎴 POKER ROYALE</h2>
            <p style="color:#bdc3c7;">Загрузка...</p>
        </div>
    `;
    
    updateStatus('Инициализация...');
}

// Запуск приложения
initApp();

// Экспортируем что нужно глобально
window.showLobby = showLobby;