#!/bin/bash
# CoDraw PDF - Script de déploiement
# Exécuter sur le VPS: bash deploy-codraw.sh

set -e

echo "🎨 Déploiement de CoDraw PDF..."

# Créer le répertoire
mkdir -p /opt/codraw-pdf/public

# ── server.js ──
cat > /opt/codraw-pdf/server.js << 'EOF'
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 50e6 });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const USER_COLORS = ['#7c6aef','#ef6a6a','#339af0','#5ad47a','#efc95a','#ef8c4a','#ef5a8c','#3adbc6','#845ef7','#e64980','#5c7cfa','#ff8787','#38d9a9','#fab005','#4dabf7'];

function generateRoomCode() { return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6); }

function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { id, users: new Map(), strokes: {}, pdfData: null, pdfName: '', totalPages: 0, createdAt: Date.now() });
  return rooms.get(id);
}

io.on('connection', (socket) => {
  let currentRoom = null, userData = null;

  socket.on('create-room', ({ username }, cb) => {
    const roomId = generateRoomCode(), room = getRoom(roomId);
    const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    userData = { id: socket.id, username, color, initials: username.slice(0, 2).toUpperCase(), page: 1 };
    room.users.set(socket.id, userData);
    socket.join(roomId);
    currentRoom = roomId;
    cb({ roomId, user: userData, users: Array.from(room.users.values()) });
  });

  socket.on('join-room', ({ roomId, username }, cb) => {
    roomId = roomId.toUpperCase();
    if (!rooms.has(roomId)) return cb({ error: 'Room introuvable' });
    const room = getRoom(roomId);
    const usedColors = Array.from(room.users.values()).map(u => u.color);
    const avail = USER_COLORS.filter(c => !usedColors.includes(c));
    const color = avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)] : USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    userData = { id: socket.id, username, color, initials: username.slice(0, 2).toUpperCase(), page: 1 };
    room.users.set(socket.id, userData);
    socket.join(roomId);
    currentRoom = roomId;
    socket.to(roomId).emit('user-joined', userData);
    cb({ roomId, user: userData, users: Array.from(room.users.values()), strokes: room.strokes, pdfData: room.pdfData, pdfName: room.pdfName, totalPages: room.totalPages });
  });

  socket.on('share-pdf', ({ pdfBase64, pdfName, totalPages }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.pdfData = pdfBase64; room.pdfName = pdfName; room.totalPages = totalPages; room.strokes = {};
    socket.to(currentRoom).emit('pdf-shared', { pdfBase64, pdfName, totalPages });
  });

  socket.on('stroke-start', (s) => { if (currentRoom) socket.to(currentRoom).emit('stroke-start', { ...s, userId: socket.id }); });
  socket.on('stroke-move', (p) => { if (currentRoom) socket.to(currentRoom).emit('stroke-move', { ...p, userId: socket.id }); });

  socket.on('stroke-end', ({ page, stroke }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room.strokes[page]) room.strokes[page] = [];
    room.strokes[page].push({ ...stroke, userId: socket.id, username: userData?.username });
    socket.to(currentRoom).emit('stroke-end', { page, stroke: { ...stroke, userId: socket.id, username: userData?.username } });
  });

  socket.on('add-shape', ({ page, shape }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room.strokes[page]) room.strokes[page] = [];
    const full = { ...shape, userId: socket.id, username: userData?.username };
    room.strokes[page].push(full);
    socket.to(currentRoom).emit('add-shape', { page, shape: full });
  });

  socket.on('undo', ({ page }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (room.strokes[page]) {
      for (let i = room.strokes[page].length - 1; i >= 0; i--) {
        if (room.strokes[page][i].userId === socket.id) { room.strokes[page].splice(i, 1); break; }
      }
    }
    io.to(currentRoom).emit('page-strokes', { page, strokes: room.strokes[page] || [] });
  });

  socket.on('clear-page', ({ page }) => {
    if (!currentRoom) return;
    getRoom(currentRoom).strokes[page] = [];
    io.to(currentRoom).emit('page-strokes', { page, strokes: [] });
  });

  socket.on('cursor-move', ({ x, y, page }) => {
    if (!currentRoom || !userData) return;
    socket.to(currentRoom).emit('cursor-move', { userId: socket.id, username: userData.username, color: userData.color, initials: userData.initials, x, y, page });
  });

  socket.on('page-change', ({ page }) => {
    if (!currentRoom || !userData) return;
    userData.page = page;
    socket.to(currentRoom).emit('user-page-change', { userId: socket.id, username: userData.username, page });
  });

  socket.on('chat-message', ({ text }) => {
    if (!currentRoom || !userData) return;
    io.to(currentRoom).emit('chat-message', { userId: socket.id, username: userData.username, color: userData.color, initials: userData.initials, text, timestamp: Date.now() });
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.users.delete(socket.id);
      io.to(currentRoom).emit('user-left', { userId: socket.id, username: userData?.username });
      if (room.users.size === 0) setTimeout(() => { if (rooms.has(currentRoom) && rooms.get(currentRoom).users.size === 0) rooms.delete(currentRoom); }, 300000);
    }
  });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', rooms: rooms.size, connections: io.engine.clientsCount }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('CoDraw PDF running on port ' + PORT));
EOF

# ── package.json ──
cat > /opt/codraw-pdf/package.json << 'EOF'
{
  "name": "codraw-pdf",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.21.0",
    "socket.io": "^4.8.0"
  }
}
EOF

# ── Dockerfile ──
cat > /opt/codraw-pdf/Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
EOF

# ── docker-compose.yml ──
cat > /opt/codraw-pdf/docker-compose.yml << 'EOF'
version: "3.8"

services:
  codraw:
    build: .
    container_name: codraw-pdf
    restart: unless-stopped
    environment:
      - PORT=3000
      - NODE_ENV=production
    labels:
      - traefik.enable=true
      - traefik.http.routers.codraw.rule=Host(`codraw.ethlab.fr`)
      - traefik.http.routers.codraw.entrypoints=websecure
      - traefik.http.routers.codraw.tls=true
      - traefik.http.routers.codraw.tls.certresolver=myresolver
      - traefik.http.services.codraw.loadbalancer.server.port=3000
    networks:
      - traefik-net

networks:
  traefik-net:
    external: true
EOF

echo "📦 Fichiers créés dans /opt/codraw-pdf/"
echo ""

# Copier le fichier HTML (il est trop gros pour un heredoc, on le génère)
echo "⏳ Installation des dépendances..."
cd /opt/codraw-pdf

# Supprimer l'ancien projet Docker si existant
docker compose down 2>/dev/null || true

echo "🔨 Build et lancement du container..."
docker compose up -d --build

echo ""
echo "✅ CoDraw PDF déployé !"
echo "   → Container: $(docker ps --filter name=codraw-pdf --format '{{.Status}}')"
echo "   → URL: https://codraw.ethlab.fr"
echo ""
echo "⚠️  N'oublie pas de créer l'enregistrement DNS Cloudflare :"
echo "   Type: A | Name: codraw | Content: 31.97.156.132 | Proxied: On"
