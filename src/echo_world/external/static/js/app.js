import {apiClient, ApiClientError} from './api-client.js';

const ui = {
  connectionLabel: requireElement('[data-ui="connection-label"]'),
  versionTop: requireElement('[data-ui="version-top"]'),
  storyLog: requireElement('[data-ui="story-log"]'),
  thinking: requireElement('[data-ui="thinking"]'),
  suggestions: requireElement('[data-ui="suggestions"]'),
  composer: requireElement('[data-ui="composer"]'),
  actionInput: requireElement('[data-ui="action-input"]'),
  sendButton: requireElement('[data-ui="send"]'),
  charCount: requireElement('[data-ui="char-count"]'),
  entryOverlay: requireElement('[data-ui="entry-overlay"]'),
  entryForm: requireElement('[data-ui="entry-form"]'),
  roleInput: requireElement('[data-ui="role-input"]'),
  goalInput: requireElement('[data-ui="goal-input"]'),
  enterButton: requireElement('[data-ui="enter-button"]'),
  roleValue: requireElement('[data-ui="role-value"]'),
  goalValue: requireElement('[data-ui="goal-value"]'),
  sessionValue: requireElement('[data-ui="session-value"]'),
  versionValue: requireElement('[data-ui="version-value"]'),
  worldTime: requireElement('[data-ui="world-time"]'),
  worldState: requireElement('[data-ui="world-state"]'),
  stateCount: requireElement('[data-ui="state-count"]'),
  memoryList: requireElement('[data-ui="memory-list"]'),
  memoryCount: requireElement('[data-ui="memory-count"]'),
  seraProgress: requireElement('[data-ui="sera-progress"]'),
  seraValue: requireElement('[data-ui="sera-value"]'),
  seraLabel: requireElement('[data-ui="sera-label"]'),
  morrowProgress: requireElement('[data-ui="morrow-progress"]'),
  morrowValue: requireElement('[data-ui="morrow-value"]'),
  morrowLabel: requireElement('[data-ui="morrow-label"]'),
  resetButton: requireElement('[data-action="reset"]'),
  toast: requireElement('[data-ui="toast"]'),
  toastMessage: requireElement('[data-ui="toast-message"]'),
};

const state = {
  session: null,
  relations: {sera: 0, morrow: 0},
  worldState: {},
  memories: [],
  turns: [],
  busy: false,
};

const WORLD_STATE_LABELS = {
  map_revealed: '비밀 지도 해금',
  timetable_decoded: '시간표 해독',
  morrow_contacted: '모로우와 조우',
  platform_nine_marked: '9번 승강장 표식',
  echo_heard: '역의 메아리 감지',
};

const MEMORY_KIND_LABELS = {
  PROMISE: '약속',
  DISCOVERY: '발견',
  ENCOUNTER: '조우',
  FACT: '기억',
};

let toastTimer = null;
let overlayTimer = null;

function requireElement(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Required UI element not found: ${selector}`);
  return element;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatClock(isoString) {
  if (!isoString) return '23:47';
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoString));
}

function formatVersion(version) {
  return String(version ?? 0).padStart(2, '0');
}

function formatRelation(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function relationLabel(value, character) {
  if (value >= 2) return '신뢰의 신호';
  if (value >= 1) return '미약한 신뢰';
  if (value <= -2) return '적대적 경계';
  if (value <= -1) return '불편한 침묵';
  return character === 'morrow' ? '신호 없음' : '경계 중';
}

function relationProgress(value) {
  return Math.max(0, Math.min(100, ((value + 2) / 5) * 100));
}

function renderEmptyStory() {
  ui.storyLog.replaceChildren();
  const empty = createElement('div', 'emptyStory');
  const glyph = createElement('span', 'openingGlyph', '09');
  glyph.setAttribute('aria-hidden', 'true');
  empty.append(
    glyph,
    createElement('h2', '', '아직 기록되지 않은 밤'),
    createElement('p', '', '역할과 목표를 남기면 루미나 폐역이 당신의 첫 번째 선택을 기다립니다.'),
  );
  ui.storyLog.append(empty);
}

function createSceneDivider(label) {
  return createElement('div', 'sceneDivider', label);
}

function appendMessage(kind, speaker, body, createdAt) {
  const article = createElement('article', `message ${kind === 'npc' ? 'messageNpc' : 'messageUser'}`);
  const avatar = createElement('div', 'messageAvatar', kind === 'npc' ? speaker.slice(0, 1) : '나');
  avatar.setAttribute('aria-hidden', 'true');

  const content = createElement('div', 'messageContent');
  const head = createElement('div', 'messageHead');
  head.append(
    createElement('strong', '', speaker),
    createElement('time', '', formatClock(createdAt)),
  );
  content.append(head, createElement('p', 'messageBody', body));
  article.append(avatar, content);
  ui.storyLog.append(article);
  return article;
}

function openingMessage(session) {
  return `${session.role}. 그 호칭만이 희미하게 남아 있다.\n\n눈을 뜨자 멈춘 시계와 젖은 선로, 그리고 당신을 기다린 듯한 한 사람이 보인다. 세라가 낡은 표를 접으며 말한다. “${session.goal}… 그 목적까지 잊지는 않았네.”`;
}

function renderStory({restored = false} = {}) {
  if (!state.session) {
    renderEmptyStory();
    return;
  }

  ui.storyLog.replaceChildren();
  ui.storyLog.append(createSceneDivider(restored ? 'RECOVERED ARCHIVE' : 'ARRIVAL / 23:47'));
  appendMessage('npc', '세라', openingMessage(state.session), state.session.created_at);

  for (const turn of state.turns) {
    ui.storyLog.append(createSceneDivider(`TURN ${formatVersion(turn.turn_no)}`));
    appendMessage('user', '당신', turn.action, turn.created_at);
    const speaker = turn.active_character === 'morrow' ? '모로우' : '세라';
    appendMessage('npc', speaker, turn.reply, turn.created_at);
  }
  scrollStoryToEnd(false);
}

function renderSession() {
  const session = state.session;
  const version = session?.version ?? 0;
  ui.roleValue.textContent = session?.role ?? '미지정';
  ui.goalValue.textContent = session?.goal ?? '기록 대기 중';
  ui.sessionValue.textContent = session ? session.id.slice(0, 8) : '—';
  ui.sessionValue.title = session?.id ?? '';
  ui.versionValue.textContent = `v.${formatVersion(version)}`;
  ui.versionTop.textContent = formatVersion(version);
  ui.worldTime.textContent = version === 0 ? '23:47' : `23:${String(Math.min(59, 47 + version * 2)).padStart(2, '0')}`;
  ui.resetButton.disabled = !session || state.busy;
}

function renderRelations() {
  const sera = state.relations.sera ?? 0;
  const morrow = state.relations.morrow ?? 0;
  ui.seraProgress.value = relationProgress(sera);
  ui.seraValue.value = formatRelation(sera);
  ui.seraValue.textContent = formatRelation(sera);
  ui.seraLabel.textContent = relationLabel(sera, 'sera');
  ui.morrowProgress.value = relationProgress(morrow);
  ui.morrowValue.value = formatRelation(morrow);
  ui.morrowValue.textContent = formatRelation(morrow);
  ui.morrowLabel.textContent = relationLabel(morrow, 'morrow');
}

function humanizeStateKey(key) {
  if (WORLD_STATE_LABELS[key]) return WORLD_STATE_LABELS[key];
  return key.replaceAll('_', ' ');
}

function renderWorldState() {
  const activeStates = Object.entries(state.worldState).filter(([, value]) => Boolean(value));
  ui.worldState.replaceChildren();
  ui.stateCount.textContent = String(activeStates.length);

  if (activeStates.length === 0) {
    ui.worldState.append(createElement('span', 'emptyTag', '아직 변한 것은 없다'));
    return;
  }

  for (const [key] of activeStates) {
    ui.worldState.append(createElement('span', 'stateTag', humanizeStateKey(key)));
  }
}

function renderMemories() {
  ui.memoryList.replaceChildren();
  ui.memoryCount.textContent = String(state.memories.length);

  if (state.memories.length === 0) {
    const empty = createElement('li', 'emptyMemory');
    const rune = createElement('span', 'memoryRune', '◇');
    rune.setAttribute('aria-hidden', 'true');
    empty.append(rune, createElement('p', '', '중요한 약속과 사건이\n여기에 남습니다.'));
    ui.memoryList.append(empty);
    return;
  }

  for (const memory of state.memories) {
    const item = createElement('li', 'memoryItem');
    item.append(
      createElement('span', '', MEMORY_KIND_LABELS[memory.kind] ?? memory.kind ?? '기억'),
      createElement('p', '', memory.fact),
    );
    ui.memoryList.append(item);
  }
}

function renderComposer() {
  const available = Boolean(state.session) && !state.busy;
  ui.actionInput.disabled = !available;
  ui.sendButton.disabled = !available || ui.actionInput.value.trim().length === 0;
  ui.suggestions.hidden = !state.session || state.turns.length >= 3;
  ui.thinking.hidden = !state.busy || !state.session;
}

function renderAll(options) {
  renderSession();
  renderRelations();
  renderWorldState();
  renderMemories();
  renderComposer();
  renderStory(options);
}

function setBusy(isBusy) {
  state.busy = isBusy;
  ui.enterButton.disabled = isBusy;
  const label = ui.enterButton.querySelector('span');
  if (label) label.textContent = isBusy ? '기억을 불러오는 중…' : '기억 속으로 입장';
  renderSession();
  renderComposer();
}

function updateCharacterCount() {
  ui.charCount.textContent = String(ui.actionInput.value.length);
  renderComposer();
}

function scrollStoryToEnd(smooth = true) {
  ui.storyLog.scrollTo({
    top: ui.storyLog.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

function showToast(message) {
  if (toastTimer) window.clearTimeout(toastTimer);
  ui.toastMessage.textContent = message;
  ui.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    ui.toast.hidden = true;
  }, 5200);
}

function showEntryOverlay() {
  if (overlayTimer) window.clearTimeout(overlayTimer);
  ui.entryOverlay.hidden = false;
  window.requestAnimationFrame(() => ui.entryOverlay.classList.remove('isClosing'));
  window.setTimeout(() => ui.roleInput.focus(), 100);
}

function hideEntryOverlay() {
  ui.entryOverlay.classList.add('isClosing');
  overlayTimer = window.setTimeout(() => {
    ui.entryOverlay.hidden = true;
  }, 430);
}

function normalizeSession(snapshot) {
  state.session = {
    id: snapshot.id,
    role: snapshot.role,
    goal: snapshot.goal,
    version: snapshot.version ?? 0,
    created_at: snapshot.created_at,
  };
  state.relations = snapshot.relations ?? {sera: 0, morrow: 0};
  state.worldState = snapshot.world_state ?? {};
  state.memories = snapshot.memories ?? [];
  state.turns = snapshot.turns ?? [];
}

async function handleEntrySubmit(event) {
  event.preventDefault();
  if (state.busy) return;

  const role = ui.roleInput.value.trim();
  const goal = ui.goalInput.value.trim();
  if (!role || !goal) {
    showToast('역할과 목표를 모두 기록해주세요.');
    return;
  }

  setBusy(true);
  try {
    const session = await apiClient.createSession({role, goal});
    const snapshot = await apiClient.restoreSession();
    normalizeSession(snapshot ?? {...session, relations: {sera: 0, morrow: 0}});
    renderAll();
    hideEntryOverlay();
    window.setTimeout(() => ui.actionInput.focus(), 460);
  } catch (error) {
    showToast(error instanceof ApiClientError ? error.message : '기록을 시작하지 못했습니다. 다시 시도해주세요.');
  } finally {
    setBusy(false);
  }
}

async function handleActionSubmit(event) {
  event.preventDefault();
  if (!state.session || state.busy) return;

  const action = ui.actionInput.value.trim();
  if (!action) return;

  setBusy(true);
  ui.storyLog.append(createSceneDivider(`TURN ${formatVersion(state.session.version + 1)}`));
  const pendingMessage = appendMessage('user', '당신', action, new Date().toISOString());
  scrollStoryToEnd();

  try {
    const turn = await apiClient.playTurn(state.session.id, {
      action,
      expected_version: state.session.version,
    });
    state.session.version = turn.version;
    state.relations = turn.relations;
    state.worldState = turn.world_state;
    state.turns.push(turn);

    const snapshot = await apiClient.restoreSession();
    if (snapshot) state.memories = snapshot.memories ?? [];

    const speaker = turn.active_character === 'morrow' ? '모로우' : '세라';
    appendMessage('npc', speaker, turn.reply, turn.created_at);
    ui.actionInput.value = '';
    updateCharacterCount();
    renderSession();
    renderRelations();
    renderWorldState();
    renderMemories();
    scrollStoryToEnd();
  } catch (error) {
    pendingMessage.remove();
    const lastDivider = ui.storyLog.querySelector('.sceneDivider:last-of-type');
    if (lastDivider?.textContent?.includes(formatVersion(state.session.version + 1))) {
      lastDivider.remove();
    }
    showToast(error instanceof ApiClientError ? error.message : '행동을 기록하지 못했습니다. 다시 시도해주세요.');
  } finally {
    setBusy(false);
    ui.actionInput.focus();
  }
}

function resetSession() {
  if (!state.session || state.busy) return;
  const accepted = window.confirm('현재 브라우저의 모험 기록을 지우고 새로 시작할까요?');
  if (!accepted) return;

  apiClient.clearLocalSession();
  state.session = null;
  state.relations = {sera: 0, morrow: 0};
  state.worldState = {};
  state.memories = [];
  state.turns = [];
  ui.actionInput.value = '';
  renderAll();
  showEntryOverlay();
}

function bindEvents() {
  ui.entryForm.addEventListener('submit', handleEntrySubmit);
  ui.composer.addEventListener('submit', handleActionSubmit);
  ui.actionInput.addEventListener('input', updateCharacterCount);
  ui.actionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      ui.composer.requestSubmit();
    }
  });
  ui.resetButton.addEventListener('click', resetSession);

  document.querySelectorAll('[data-role]').forEach((button) => {
    button.addEventListener('click', () => {
      const role = button.getAttribute('data-role');
      if (!role) return;
      ui.roleInput.value = role;
      document.querySelectorAll('[data-role]').forEach((candidate) => {
        candidate.setAttribute('aria-pressed', String(candidate === button));
      });
    });
  });

  document.querySelectorAll('[data-suggestion]').forEach((button) => {
    button.addEventListener('click', () => {
      const suggestion = button.getAttribute('data-suggestion');
      if (!suggestion) return;
      ui.actionInput.value = suggestion;
      updateCharacterCount();
      ui.actionInput.focus();
    });
  });

  requireElement('[data-action="close-toast"]').addEventListener('click', () => {
    ui.toast.hidden = true;
  });
}

async function initialize() {
  ui.connectionLabel.textContent = apiClient.mode === 'mock'
    ? 'MOCK · 브라우저 저장'
    : 'API · 서버 연결';
  renderEmptyStory();
  bindEvents();
  updateCharacterCount();

  const restored = await apiClient.restoreSession();
  if (!restored) {
    showEntryOverlay();
    return;
  }

  normalizeSession(restored);
  renderAll({restored: true});
  hideEntryOverlay();
}

initialize().catch(() => {
  renderEmptyStory();
  showEntryOverlay();
  showToast('저장된 기록을 읽지 못했습니다. 새 기록으로 시작해주세요.');
});
