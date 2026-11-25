const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_USERS = 5;

// socket.id -> { id, name, emoji }
const users = new Map();

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  // 현재 인원 수 안내
  socket.emit('room:count', { count: users.size, max: MAX_USERS });

  // 입장 요청 (최대 5명 제한)
  socket.on('user:join', ({ name, emoji }) => {
    if (users.size >= MAX_USERS) {
      socket.emit('room:full', `최대 ${MAX_USERS}명까지만 입장할 수 있어요.`);
      return;
    }

    const cleanName = String(name || '').trim().slice(0, 15) || '익명';
    const cleanEmoji = String(emoji || '🙂').trim();

    const user = { id: socket.id, name: cleanName, emoji: cleanEmoji };
    users.set(socket.id, user);

    socket.emit('user:joined', user);
    io.emit('system:message', `${user.emoji} ${user.name}님이 입장했어요. (${users.size}/${MAX_USERS})`);
    io.emit('users:update', Array.from(users.values()));
    io.emit('room:count', { count: users.size, max: MAX_USERS });
  });

  // 채팅 메시지 전송
  socket.on('chat:send', (rawText) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    const text = String(rawText || '').trim();
    if (!text) return;

    io.emit('chat:message', {
      id: `${Date.now()}-${socket.id}`,
      senderId: sender.id,
      name: sender.name,
      emoji: sender.emoji,
      text,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    });
  });

  // 연결 종료 처리
  socket.on('disconnect', () => {
    const leaving = users.get(socket.id);
    if (!leaving) return;

    users.delete(socket.id);
    io.emit('system:message', `${leaving.emoji} ${leaving.name}님이 퇴장했어요. (${users.size}/${MAX_USERS})`);
    io.emit('users:update', Array.from(users.values()));
    io.emit('room:count', { count: users.size, max: MAX_USERS });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
