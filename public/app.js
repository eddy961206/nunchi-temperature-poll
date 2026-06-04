const app = document.querySelector('#app');
const socket = io();

const labels = {
  hot: '더워요',
  ok: '괜찮아요',
  cold: '추워요'
};

let currentRoomId = null;
let currentHostToken = null;
let snapshot = null;

function getDeviceId() {
  const key = 'nunchi-temperature-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function getMyVote(roomId) {
  return localStorage.getItem(`nunchi-temperature-vote-${roomId}`);
}

function setMyVote(roomId, vote) {
  localStorage.setItem(`nunchi-temperature-vote-${roomId}`, vote);
}

function qs(selector) {
  return document.querySelector(selector);
}

function renderTemplate(id) {
  const template = document.querySelector(id);
  app.innerHTML = '';
  app.appendChild(template.content.cloneNode(true));
}

function getRoute() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/r\/([A-Za-z0-9]+)/);
  if (!match) return { page: 'home' };
  const queryString = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(queryString);
  return {
    page: 'room',
    roomId: match[1].toUpperCase(),
    hostToken: params.get('host') || localStorage.getItem(`nunchi-temperature-host-${match[1].toUpperCase()}`)
  };
}

function setLoading(button, isLoading, textWhenLoading = '처리 중...') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = textWhenLoading;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

async function createRoom(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);

  setLoading(button, true, '방 만드는 중...');
  try {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        ttlMinutes: Number(formData.get('ttlMinutes'))
      })
    });
    if (!response.ok) throw new Error('방 생성 실패');
    const data = await response.json();
    localStorage.setItem(`nunchi-temperature-host-${data.roomId}`, data.hostToken);
    window.location.hash = `#/r/${data.roomId}?host=${data.hostToken}`;
  } catch (error) {
    alert('방을 못 만들었어. 서버가 켜져 있는지 확인해줘.');
  } finally {
    setLoading(button, false);
  }
}

function renderHome() {
  currentRoomId = null;
  currentHostToken = null;
  snapshot = null;
  renderTemplate('#home-template');
  qs('#create-room-form').addEventListener('submit', createRoom);
}

function renderRoomShell(roomId, hostToken) {
  currentRoomId = roomId;
  currentHostToken = hostToken;
  renderTemplate('#room-template');

  qs('#room-id').textContent = roomId;

  if (hostToken) {
    qs('#host-panel').classList.remove('hidden');
    qs('#qr-image').src = `/api/rooms/${roomId}/qr.svg`;
    const publicUrl = `${window.location.origin}/#/r/${roomId}`;
    qs('#share-url').value = publicUrl;
    qs('#copy-link-button').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(publicUrl);
        qs('#copy-link-button').textContent = '복사됨';
        setTimeout(() => { qs('#copy-link-button').textContent = '링크 복사'; }, 1200);
      } catch {
        qs('#share-url').select();
        document.execCommand('copy');
      }
    });
    qs('#reset-button').addEventListener('click', () => {
      if (!confirm('지금 투표를 전부 초기화할까?')) return;
      socket.emit('room:reset', { roomId, hostToken }, (result) => {
        if (!result?.ok) alert(result?.error || '초기화 실패');
      });
    });
  }

  document.querySelectorAll('.vote-button').forEach((button) => {
    button.addEventListener('click', () => submitVote(button.dataset.vote));
  });

  socket.emit('room:join', { roomId }, (result) => {
    if (!result?.ok) {
      app.innerHTML = `<section class="card hero"><h1>방을 못 찾았어</h1><p class="lead">코드가 틀렸거나 방이 지워졌을 수 있어.</p><a class="primary-button" href="/">새 방 만들기</a></section>`;
      return;
    }
    updateSnapshot(result.snapshot);
  });
}

function submitVote(vote) {
  const deviceId = getDeviceId();
  qs('#vote-status').textContent = `${labels[vote]}로 반영하는 중...`;
  socket.emit('room:vote', {
    roomId: currentRoomId,
    deviceId,
    vote
  }, (result) => {
    if (!result?.ok) {
      qs('#vote-status').textContent = result?.error || '투표 실패';
      return;
    }
    setMyVote(currentRoomId, vote);
    qs('#vote-status').textContent = `${labels[vote]}로 반영됐어. 언제든 다시 누르면 바뀌어.`;
    updateSelectedVote();
  });
}

function updateSelectedVote() {
  const myVote = getMyVote(currentRoomId);
  document.querySelectorAll('.vote-button').forEach((button) => {
    button.classList.toggle('selected', button.dataset.vote === myVote);
  });
}

function pct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function formatTime(iso) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function updateSnapshot(nextSnapshot) {
  snapshot = nextSnapshot;
  if (!snapshot) return;

  qs('#room-name').textContent = snapshot.name;
  qs('#mood-text').textContent = snapshot.mood;
  qs('#hint-text').textContent = snapshot.hint;
  qs('#total-count').textContent = snapshot.total;

  qs('#hot-count').textContent = snapshot.counts.hot;
  qs('#ok-count').textContent = snapshot.counts.ok;
  qs('#cold-count').textContent = snapshot.counts.cold;

  qs('#hot-bar').style.width = `${pct(snapshot.counts.hot, snapshot.total)}%`;
  qs('#ok-bar').style.width = `${pct(snapshot.counts.ok, snapshot.total)}%`;
  qs('#cold-bar').style.width = `${pct(snapshot.counts.cold, snapshot.total)}%`;

  qs('#room-meta').textContent = `최근 ${snapshot.ttlMinutes}분 투표만 반영 · 마지막 업데이트 ${formatTime(snapshot.lastUpdatedAt)}`;
  updateSelectedVote();
}

socket.on('room:update', updateSnapshot);

function route() {
  const next = getRoute();
  if (next.page === 'room') {
    renderRoomShell(next.roomId, next.hostToken);
  } else {
    renderHome();
  }
}

window.addEventListener('hashchange', route);
route();
