

function getUserId() {
  let uid = localStorage.getItem('aichat_user_id');
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem('aichat_user_id', uid);
  }
  return uid;
}

function getStoredSessionId(plotId) {
  return localStorage.getItem(`aichat_session_${plotId}`);
}

function setStoredSessionId(plotId, sessionId) {
  localStorage.setItem(`aichat_session_${plotId}`, sessionId);
}



const api = {
  async getPlots() {
    const res = await fetch('/api/plots');
    if (!res.ok) throw new Error('failed to load plots');
    return (await res.json()).plots;
  },

  async getRanking(period) {
    const res = await fetch(`/api/plots/ranking?period=${encodeURIComponent(period)}`);
    if (!res.ok) throw new Error('failed to load ranking');
    return (await res.json()).plots;
  },

  async getPlot(id) {
    const res = await fetch(`/api/plots/${encodeURIComponent(id)}?userId=${encodeURIComponent(getUserId())}`);
    if (!res.ok) return null;
    return res.json();
  },

  async getHistory() {
    const res = await fetch(`/api/history?userId=${encodeURIComponent(getUserId())}`);
    if (!res.ok) throw new Error('failed to load history');
    return (await res.json()).history;
  },

  async sendMessage(plotId, sessionId, message) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, plotId, sessionId, userId: getUserId() }),
    });
    return res.json();
  },
};



function formatCount(n) {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  return String(n);
}

function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  if (diff < MIN) return 'たった今';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}分前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}時間前`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}日前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function avatarGradient(color) {
  return `linear-gradient(135deg, ${color}, #222)`;
}

function createAvatar(emoji, color, extraClass) {
  const el = document.createElement('div');
  el.className = 'avatar' + (extraClass ? ' ' + extraClass : '');
  el.style.background = avatarGradient(color);
  el.textContent = emoji;
  return el;
}


function renderStateBlock(container, { icon, title, desc, actionLabel, onAction, loading = false }) {
  container.innerHTML = '';
  const block = document.createElement('div');
  block.className = 'state-block' + (loading ? ' is-loading' : '');

  const iconEl = document.createElement('div');
  iconEl.className = 'state-icon';
  iconEl.textContent = icon;
  block.appendChild(iconEl);

  const titleEl = document.createElement('p');
  titleEl.className = 'state-title';
  titleEl.textContent = title;
  block.appendChild(titleEl);

  if (desc) {
    const descEl = document.createElement('p');
    descEl.className = 'state-desc';
    descEl.textContent = desc;
    block.appendChild(descEl);
  }

  if (actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'state-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', onAction);
    block.appendChild(btn);
  }

  container.appendChild(block);
}


function renderPlotCard(plot, rank) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'plot-card';

  if (rank) {
    const rankEl = document.createElement('div');
    rankEl.className = 'rank-badge' + (rank <= 3 ? ` rank-${rank}` : '');
    rankEl.textContent = String(rank);
    card.appendChild(rankEl);
  }

  card.appendChild(createAvatar(plot.avatarEmoji, plot.avatarColor));

  const main = document.createElement('div');
  main.className = 'plot-main';

  const nameRow = document.createElement('div');
  nameRow.className = 'plot-name-row';
  const name = document.createElement('span');
  name.className = 'plot-name';
  name.textContent = plot.name;
  const tag = document.createElement('span');
  tag.className = 'plot-tag';
  tag.textContent = plot.tag;
  nameRow.appendChild(name);
  nameRow.appendChild(tag);

  const tagline = document.createElement('div');
  tagline.className = 'plot-tagline';
  tagline.textContent = plot.tagline;

  const meta = document.createElement('div');
  meta.className = 'plot-meta';
  meta.textContent = `by ${plot.creatorName}`;

  main.appendChild(nameRow);
  main.appendChild(tagline);
  main.appendChild(meta);
  card.appendChild(main);

  const count = document.createElement('div');
  count.className = 'plot-count';
  const countStrong = document.createElement('strong');
  countStrong.textContent = formatCount(plot.chatCount);
  count.appendChild(countStrong);
  count.appendChild(document.createTextNode('チャット'));
  card.appendChild(count);

  card.addEventListener('click', () => openRoom(plot.id));
  return card;
}


function renderHistoryRow(item) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'history-row';
  row.appendChild(createAvatar(item.avatarEmoji, item.avatarColor));

  const main = document.createElement('div');
  main.className = 'plot-main';

  const nameRow = document.createElement('div');
  nameRow.className = 'plot-name-row';
  const name = document.createElement('span');
  name.className = 'plot-name';
  name.textContent = item.name;
  nameRow.appendChild(name);

  const preview = document.createElement('div');
  preview.className = 'history-preview';
  preview.textContent = item.lastMessage || item.tagline;

  main.appendChild(nameRow);
  main.appendChild(preview);

  const time = document.createElement('div');
  time.className = 'history-time';
  time.textContent = formatRelativeTime(item.lastOpenedAt);

  row.appendChild(main);
  row.appendChild(time);

  row.addEventListener('click', () => openRoom(item.plotId));
  return row;
}



const screens = {
  home: document.getElementById('screen-home'),
  chat: document.getElementById('screen-chat'),
  create: document.getElementById('screen-create'),
  account: document.getElementById('screen-account'),
  room: document.getElementById('screen-room'),
};
const bottomNav = document.getElementById('bottomNav');
const navTabs = document.querySelectorAll('.nav-tab');

let lastMainTab = 'home';

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('is-hidden', key !== name);
  });
}

function switchMainTab(tab) {
  lastMainTab = tab;
  showScreen(tab);
  bottomNav.classList.remove('is-hidden');
  navTabs.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === tab));

  if (tab === 'home') loadHomeSubtab();
  if (tab === 'chat') loadHistory();
}

navTabs.forEach((btn) => {
  btn.addEventListener('click', () => switchMainTab(btn.dataset.tab));
});



let homeSubtab = 'feed'; 
let rankingPeriod = 'daily';
let homeRequestId = 0;

const plotListEl = document.getElementById('plotList');
const periodPillsEl = document.getElementById('periodPills');
const subnavTabs = document.querySelectorAll('.subnav-tab');
const periodButtons = document.querySelectorAll('.pill');

subnavTabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.subtab === homeSubtab) return;
    homeSubtab = btn.dataset.subtab;
    subnavTabs.forEach((b) => b.classList.toggle('is-active', b === btn));
    periodPillsEl.classList.toggle('is-hidden', homeSubtab !== 'ranking');
    loadHomeSubtab();
  });
});

periodButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.period === rankingPeriod) return;
    rankingPeriod = btn.dataset.period;
    periodButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
    loadHomeSubtab();
  });
});

async function loadHomeSubtab() {
  const requestId = ++homeRequestId;
  renderStateBlock(plotListEl, { icon: '⏳', title: '読み込み中…', loading: true });

  try {
    const plots = homeSubtab === 'feed'
      ? await api.getPlots()
      : await api.getRanking(rankingPeriod);

    if (requestId !== homeRequestId) return; 

    if (!plots.length) {
      renderStateBlock(plotListEl, homeSubtab === 'feed' ? {
        icon: '📭',
        title: 'まだプロットがありません',
        desc: '最初のプロットが作成されるのをお楽しみに。',
      } : {
        icon: '📊',
        title: 'この期間はまだデータがありません',
        desc: '他の期間も見てみてください。',
      });
      return;
    }

    plotListEl.innerHTML = '';
    plots.forEach((plot, i) => {
      plotListEl.appendChild(renderPlotCard(plot, homeSubtab === 'ranking' ? i + 1 : null));
    });
  } catch (err) {
    if (requestId !== homeRequestId) return;
    renderStateBlock(plotListEl, {
      icon: '⚠️',
      title: '読み込みに失敗しました',
      desc: 'もう一度お試しください。',
      actionLabel: '再読み込み',
      onAction: loadHomeSubtab,
    });
  }
}



let historyRequestId = 0;
const historyListEl = document.getElementById('historyList');

async function loadHistory() {
  const requestId = ++historyRequestId;
  renderStateBlock(historyListEl, { icon: '⏳', title: '読み込み中…', loading: true });

  try {
    const history = await api.getHistory();
    if (requestId !== historyRequestId) return;

    if (!history.length) {
      renderStateBlock(historyListEl, {
        icon: '💬',
        title: 'まだチャットがありません',
        desc: '気になるプロットを開いて話しかけてみましょう。',
        actionLabel: 'プロットを探す',
        onAction: () => switchMainTab('home'),
      });
      return;
    }

    historyListEl.innerHTML = '';
    history.forEach((item) => historyListEl.appendChild(renderHistoryRow(item)));
  } catch (err) {
    if (requestId !== historyRequestId) return;
    renderStateBlock(historyListEl, {
      icon: '⚠️',
      title: '読み込みに失敗しました',
      desc: 'もう一度お試しください。',
      actionLabel: '再読み込み',
      onAction: loadHistory,
    });
  }
}



const chatEl = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const roomAvatarEl = document.getElementById('roomAvatar');
const roomNameEl = document.getElementById('roomName');
const backButton = document.getElementById('backButton');

let currentPlotId = null;
let currentSessionId = null;
let currentPlotEmoji = 'AI';
let currentPlotColor = '#555';
let isSending = false;

function getTime() {
  const now = new Date();
  return now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function addMessage(text, type) {
  const row = document.createElement('div');
  row.className = 'message-row ' + type;

  if (type === 'ai') {
    const icon = document.createElement('div');
    icon.className = 'ai-icon';
    icon.style.background = avatarGradient(currentPlotColor);
    icon.textContent = currentPlotEmoji;
    row.appendChild(icon);
  }

  const content = document.createElement('div');
  content.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = getTime();

  content.appendChild(bubble);
  content.appendChild(time);
  row.appendChild(content);

  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'message-row ai';
  row.id = 'typingMessage';

  const icon = document.createElement('div');
  icon.className = 'ai-icon';
  icon.style.background = avatarGradient(currentPlotColor);
  icon.textContent = currentPlotEmoji;

  const content = document.createElement('div');
  content.className = 'message-content';

  const typing = document.createElement('div');
  typing.className = 'bubble typing';
  typing.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;

  content.appendChild(typing);
  row.appendChild(icon);
  row.appendChild(content);

  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function removeTyping() {
  const typing = document.getElementById('typingMessage');
  if (typing) typing.remove();
}

async function openRoom(plotId) {
  showScreen('room');
  bottomNav.classList.add('is-hidden');

  chatEl.innerHTML = '';
  currentPlotId = null;
  currentSessionId = null;
  currentPlotEmoji = 'AI';
  currentPlotColor = '#555';
  roomNameEl.textContent = '読み込み中...';
  roomAvatarEl.style.background = avatarGradient('#555');
  roomAvatarEl.textContent = 'AI';

  const plot = await api.getPlot(plotId);
  if (!plot) {
    roomNameEl.textContent = 'エラー';
    addMessage('プロットが見つかりませんでした。', 'ai');
    return;
  }

  currentPlotId = plot.id;
  currentSessionId = getStoredSessionId(plot.id);
  currentPlotEmoji = plot.avatarEmoji;
  currentPlotColor = plot.avatarColor;

  roomNameEl.textContent = plot.name;
  roomAvatarEl.style.background = avatarGradient(plot.avatarColor);
  roomAvatarEl.textContent = plot.avatarEmoji;

  addMessage(plot.greeting, 'ai');
  messageInput.value = '';
  messageInput.focus();
}

function closeRoom() {
  currentPlotId = null;
  currentSessionId = null;
  switchMainTab(lastMainTab);
}

backButton.addEventListener('click', closeRoom);

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isSending || !currentPlotId) return;

  addMessage(text, 'user');
  messageInput.value = '';
  messageInput.focus();
  showTyping();
  isSending = true;
  sendButton.disabled = true;

  try {
    const data = await api.sendMessage(currentPlotId, currentSessionId, text);

    if (data.sessionId) {
      currentSessionId = data.sessionId;
      setStoredSessionId(currentPlotId, currentSessionId);
    }

    removeTyping();

    if (data.error) {
      addMessage('エラー：' + data.error, 'ai');
    } else {
      addMessage(data.reply, 'ai');
    }
  } catch (err) {
    removeTyping();
    addMessage('通信エラーが発生しました。もう一度お試しください。', 'ai');
  } finally {
    isSending = false;
    sendButton.disabled = false;
  }
}

sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendMessage();
  }
});



getUserId();
switchMainTab('home');
