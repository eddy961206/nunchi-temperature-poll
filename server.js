const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ rooms: {} }, null, 2));
}

function loadState() {
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    return parsed && parsed.rooms ? parsed : { rooms: {} };
  } catch (error) {
    console.error('Failed to load rooms.json. Starting with empty state.', error);
    return { rooms: {} };
  }
}

let state = loadState();
let saveTimer = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  }, 250);
}

function nowIso() {
  return new Date().toISOString();
}

function randomCode(length = 5) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

function createRoomId() {
  let roomId = randomCode(5);
  while (state.rooms[roomId]) roomId = randomCode(5);
  return roomId;
}

function createHostToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getPublicOrigin(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
}

function cleanExpiredVotes(room) {
  const ttlMs = (room.ttlMinutes || 45) * 60 * 1000;
  const cutoff = Date.now() - ttlMs;
  let changed = false;

  Object.entries(room.votes || {}).forEach(([deviceId, voteRecord]) => {
    const ts = new Date(voteRecord.updatedAt).getTime();
    if (!ts || ts < cutoff) {
      delete room.votes[deviceId];
      changed = true;
    }
  });

  if (changed) scheduleSave();
}

function getSnapshot(room) {
  cleanExpiredVotes(room);

  const counts = { hot: 0, ok: 0, cold: 0 };
  const voters = [];
  Object.entries(room.votes || {}).forEach(([deviceId, voteRecord]) => {
    if (counts[voteRecord.vote] !== undefined) {
      counts[voteRecord.vote] += 1;
      voters.push({
        deviceId,
        vote: voteRecord.vote,
        updatedAt: voteRecord.updatedAt
      });
    }
  });

  const total = counts.hot + counts.ok + counts.cold;
  const decisiveGap = Math.max(2, Math.ceil(total * 0.25));
  let mood = '아직 투표 없음';
  let hint = 'QR을 공유하고 한 번씩 눌러보면 돼.';

  if (total > 0) {
    if (counts.ok >= counts.hot + counts.cold) {
      mood = '대체로 괜찮음';
      hint = '지금은 유지가 제일 무난해.';
    } else if (counts.hot >= counts.cold + decisiveGap) {
      mood = '더운 쪽으로 기울었음';
      hint = '선풍기나 에어컨을 한 단계 올려도 눈치 덜 보일 상황이야.';
    } else if (counts.cold >= counts.hot + decisiveGap) {
      mood = '추운 쪽으로 기울었음';
      hint = '냉방을 낮추거나 히터/담요 쪽을 먼저 보는 게 안전해.';
    } else if (counts.hot > counts.cold) {
      mood = '살짝 더운 편';
      hint = '강하게 바꾸기보다는 약하게 조절하는 정도가 좋아.';
    } else if (counts.cold > counts.hot) {
      mood = '살짝 추운 편';
      hint = '냉난방기를 크게 건드리기보다는 한 단계만 조심스럽게 가자.';
    } else {
      mood = '의견이 갈림';
      hint = '공용 기기보다 개인 선풍기, 자리 이동, 바람 방향 조절이 나아.';
    }
  }

  return {
    id: room.id,
    name: room.name,
    createdAt: room.createdAt,
    ttlMinutes: room.ttlMinutes,
    counts,
    total,
    mood,
    hint,
    voters,
    lastUpdatedAt: room.lastUpdatedAt || room.createdAt
  };
}

function getRoomOr404(req, res) {
  const room = state.rooms[String(req.params.roomId || '').toUpperCase()];
  if (!room) {
    res.status(404).json({ error: 'ROOM_NOT_FOUND', message: '방을 찾을 수 없어.' });
    return null;
  }
  return room;
}

app.post('/api/rooms', (req, res) => {
  const name = String(req.body.name || '우리 공간').trim().slice(0, 40) || '우리 공간';
  const ttlInput = Number(req.body.ttlMinutes);
  const ttlMinutes = Number.isFinite(ttlInput) ? Math.min(240, Math.max(5, Math.round(ttlInput))) : 45;
  const roomId = createRoomId();
  const hostToken = createHostToken();

  state.rooms[roomId] = {
    id: roomId,
    name,
    hostToken,
    ttlMinutes,
    createdAt: nowIso(),
    lastUpdatedAt: nowIso(),
    votes: {}
  };

  scheduleSave();
  const origin = getPublicOrigin(req);
  res.status(201).json({
    roomId,
    hostToken,
    roomUrl: `${origin}/#/r/${roomId}`,
    hostUrl: `${origin}/#/r/${roomId}?host=${hostToken}`,
    snapshot: getSnapshot(state.rooms[roomId])
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  res.json({ snapshot: getSnapshot(room) });
});

app.get('/api/rooms/:roomId/qr.svg', async (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;

  try {
    const origin = getPublicOrigin(req);
    const publicUrl = `${origin}/#/r/${room.id}`;
    const svg = await QRCode.toString(publicUrl, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#111827',
        light: '#ffffff'
      }
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'QR_FAILED', message: 'QR 생성에 실패했어.' });
  }
});


app.post('/api/rooms/:roomId/vote', (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;

  const normalizedVote = String(req.body.vote || '').toLowerCase();
  const normalizedDeviceId = String(req.body.deviceId || '').slice(0, 80);

  if (!['hot', 'ok', 'cold'].includes(normalizedVote)) {
    res.status(400).json({ error: 'BAD_VOTE', message: '투표 값이 이상해.' });
    return;
  }
  if (!normalizedDeviceId || normalizedDeviceId.length < 8) {
    res.status(400).json({ error: 'BAD_DEVICE_ID', message: '기기 ID가 필요해.' });
    return;
  }

  room.votes[normalizedDeviceId] = {
    vote: normalizedVote,
    updatedAt: nowIso()
  };
  room.lastUpdatedAt = nowIso();
  scheduleSave();
  const snapshot = getSnapshot(room);
  io.to(room.id).emit('room:update', snapshot);
  res.json({ snapshot });
});

app.post('/api/rooms/:roomId/reset', (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  if (req.body.hostToken !== room.hostToken) {
    res.status(403).json({ error: 'FORBIDDEN', message: '호스트만 초기화할 수 있어.' });
    return;
  }
  room.votes = {};
  room.lastUpdatedAt = nowIso();
  scheduleSave();
  const snapshot = getSnapshot(room);
  io.to(room.id).emit('room:update', snapshot);
  res.json({ snapshot });
});

io.on('connection', (socket) => {
  socket.on('room:join', ({ roomId }, callback = () => {}) => {
    const id = String(roomId || '').toUpperCase();
    const room = state.rooms[id];
    if (!room) {
      callback({ ok: false, error: '방을 찾을 수 없어.' });
      return;
    }
    socket.join(id);
    callback({ ok: true, snapshot: getSnapshot(room) });
  });

  socket.on('room:vote', ({ roomId, deviceId, vote }, callback = () => {}) => {
    const id = String(roomId || '').toUpperCase();
    const room = state.rooms[id];
    const normalizedVote = String(vote || '').toLowerCase();
    const normalizedDeviceId = String(deviceId || '').slice(0, 80);

    if (!room) {
      callback({ ok: false, error: '방을 찾을 수 없어.' });
      return;
    }
    if (!['hot', 'ok', 'cold'].includes(normalizedVote)) {
      callback({ ok: false, error: '투표 값이 이상해.' });
      return;
    }
    if (!normalizedDeviceId || normalizedDeviceId.length < 8) {
      callback({ ok: false, error: '기기 ID가 필요해.' });
      return;
    }

    room.votes[normalizedDeviceId] = {
      vote: normalizedVote,
      updatedAt: nowIso()
    };
    room.lastUpdatedAt = nowIso();
    scheduleSave();

    const snapshot = getSnapshot(room);
    io.to(id).emit('room:update', snapshot);
    callback({ ok: true, snapshot });
  });

  socket.on('room:reset', ({ roomId, hostToken }, callback = () => {}) => {
    const id = String(roomId || '').toUpperCase();
    const room = state.rooms[id];
    if (!room) {
      callback({ ok: false, error: '방을 찾을 수 없어.' });
      return;
    }
    if (hostToken !== room.hostToken) {
      callback({ ok: false, error: '호스트만 초기화할 수 있어.' });
      return;
    }
    room.votes = {};
    room.lastUpdatedAt = nowIso();
    scheduleSave();
    const snapshot = getSnapshot(room);
    io.to(id).emit('room:update', snapshot);
    callback({ ok: true, snapshot });
  });
});

server.listen(PORT, () => {
  console.log(`눈치온도 running on http://localhost:${PORT}`);
});
