import { me, room, updateStatus, getPlayerDisplayName } from './utils.js';
import { socket } from './socket.js';
import { showLobby } from './lobby.js';
import { showGame } from './game.js';

export function showRoom() {
    if (!room) return;
    
    const app = document.getElementById('app');
    app.innerHTML = `
        <div style="max-width:600px; margin:0 auto;">
            <h2 style="text-align:center; color:#f1c40f;">🎯 КОМНАТА: ${room.code}</h2>
            
            <div style="background:rgba(52, 73, 94, 0.8); padding:15px; border-radius:10px; text-align:center; margin:15px 0;">
                <p style="font-size:20px; margin:0;">
                    <strong>Код для приглашения:</strong><br>
                    <span style="font-size:28px; color:#2ecc71; letter-spacing:3px;">${room.code}</span>
                </p>
            </div>
            
            <div style="background:rgba(0,0,0,0.3); padding:20px; border-radius:10px; margin:20px 0;">
                <h3 style="margin-top:0;">👥 Игроки в комнате (${room.players.length})</h3>
                ${room.players.map(p => `
                    <div class="player-row" style="${p.id === me.id ? 'background:rgba(46, 204, 113, 0.2);' : ''}">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <span class="${p.id === me.id ? 'you-name' : 'player-name'}">
                                    ${getPlayerDisplayName(p, p.id === me.id)}
                                </span>
                                ${p.id === me.id ? '<span class="badge badge-you">ВЫ</span>' : ''}
                            </div>
                            <div>
                                <span class="chips-amount">💰 ${p.chips}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div style="text-align:center; margin-top:30px;">
                ${room.players.length >= 2 ? `
                    <button onclick="window.startGame()" style="
                        background:linear-gradient(145deg, #27ae60, #219653); 
                        padding:15px 40px; 
                        font-size:18px;
                        margin-right:15px;">
                        🎯 НАЧАТЬ ИГРУ
                    </button>
                ` : `
                    <div style="background:rgba(243, 156, 18, 0.2); padding:15px; border-radius:8px; margin-bottom:20px;">
                        <p>⏳ Ожидаем второго игрока...</p>
                        <p>Отправьте код <strong>${room.code}</strong> другу</p>
                    </div>
                `}
                
                <button onclick="window.leaveRoom()" style="
                    background:linear-gradient(145deg, #e74c3c, #c0392b); 
                    padding:15px 30px; 
                    font-size:16px;">
                    🚪 ВЫЙТИ
                </button>
            </div>
        </div>
    `;
    updateStatus(`Вы в комнате ${room.code} | Игроков: ${room.players.length} | Ваш ник: ${me.name}`);
}

export function leaveRoom() {
    if (!room) return;
    if (confirm('Вы уверены, что хотите покинуть комнату?')) {
        socket.emit('leave_room', { code: room.code, playerId: me.id });
        room = null;
        showLobby();
    }
}

export function startGame() {
    if (!room) return;
    socket.emit('start_game', { code: room.code });
    updateStatus('Запуск игры...');
}

// Экспортируем функции в глобальную область видимости
window.leaveRoom = leaveRoom;
window.startGame = startGame;