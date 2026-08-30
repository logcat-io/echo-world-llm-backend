const STORAGE_KEY = 'echo-world:mock-session:v1';
const MIN_DELAY_MS = 620;
const MAX_DELAY_MS = 980;
let volatileSession = null;

export class MockApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'MockApiError';
    this.status = status;
    this.body = {error: {code, message, request_id: createId()}};
  }
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function waitForScene() {
  const duration = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function readStoredSession() {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    return serialized ? JSON.parse(serialized) : volatileSession;
  } catch {
    return volatileSession;
  }
}

function writeStoredSession(session) {
  volatileSession = clone(session);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private browsing can reject storage. The in-memory session remains usable.
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function includesAny(action, keywords) {
  return keywords.some((keyword) => action.includes(keyword));
}

function addMemory(session, kind, fact) {
  const exists = session.memories.some((memory) => memory.fact === fact);
  if (exists) return;

  session.memories.unshift({
    id: createId(),
    kind,
    fact,
    created_at: nowIso(),
  });
  session.memories = session.memories.slice(0, 5);
}

function buildScene(session, rawAction) {
  const action = rawAction.toLowerCase();
  const sera = session.relations.sera;
  const result = {
    activeCharacter: 'sera',
    relationshipDelta: 0,
    reply: '',
  };

  if (includesAny(action, ['약속', '지키', '숨기', '비밀'])) {
    result.relationshipDelta = 1;
    session.world_state.map_revealed = true;
    addMemory(session, 'PROMISE', '사용자는 세라의 낡은 지도를 누구에게도 보여주지 않겠다고 약속했다.');
    result.reply = sera >= 1
      ? '“두 번이나 말할 필요는 없어.” 세라는 그렇게 말하면서도 접어 둔 지도를 당신 쪽으로 밀어 놓는다. 종이 아래, 보이지 않던 은빛 노선 하나가 천천히 떠오른다. “약속을 기억하는 사람에게만 보이는 길이야.”'
      : '세라의 손끝이 낡은 지도 위에서 멈춘다. 오래 침묵하던 역의 조명이 한 칸씩 살아난다. “좋아. 그 약속은 역보다 오래 남아야 해.” 그녀는 지도 뒷면에 당신의 이름 대신 작은 원을 그린다.';
  } else if (includesAny(action, ['시간표', '벽', '조사', '살펴'])) {
    session.world_state.timetable_decoded = true;
    addMemory(session, 'DISCOVERY', '23시 59분의 마지막 열차는 승객이 아니라 잃어버린 기억을 운반한다.');
    result.reply = '먼지를 걷어내자 지워진 줄 알았던 숫자들이 떠오른다. 23:59. 행선지는 적혀 있지 않다. 대신 작은 글씨 하나가 레일처럼 길게 이어진다. ‘승객이 아닌 것을 싣는다.’ 뒤에서 세라가 숨을 삼키는 소리가 들린다.';
  } else if (includesAny(action, ['누구', '발소리', '모로우', '불러'])) {
    result.activeCharacter = 'morrow';
    session.relations.morrow += 1;
    session.world_state.morrow_contacted = true;
    addMemory(session, 'ENCOUNTER', '어둠 속의 역무원 모로우가 사용자를 먼저 알고 있는 듯 반응했다.');
    result.reply = '발소리가 멎는다. 곧 어둠 속에서 금속 표찰 하나가 희미하게 빛난다. “그 질문을 세 번째로 하는군.” 모로우라 불린 남자는 당신을 처음 본 사람처럼 바라보지 않는다. “이번에는 대답을 기억할 수 있겠나?”';
  } else if (includesAny(action, ['지도', '펼쳐', '본다', '확인'])) {
    result.relationshipDelta = session.world_state.map_revealed ? 0 : -1;
    session.world_state.platform_nine_marked = true;
    result.reply = session.world_state.map_revealed
      ? '지도를 펼치자 아홉 번째 승강장 아래에 가느다란 문양이 맥박친다. 세라가 당신의 어깨 너머로 낮게 말한다. “그 표식이 켜졌다면, 역도 네 선택을 들었다는 뜻이야.”'
      : '당신이 지도에 손을 대는 순간 세라가 종이를 낚아챈다. “아직은 아니야.” 짧은 말 뒤로 경계가 내려앉는다. 다만 찰나의 순간, 아홉 번째 승강장 아래에서 빛나는 표식을 보았다.';
  } else if (includesAny(action, ['기억', '전에', '약속했', '잊'])) {
    result.relationshipDelta = session.memories.length > 0 ? 1 : 0;
    result.reply = session.memories.length > 0
      ? `세라는 당신의 말을 끝까지 듣더니 고개를 끄덕인다. “그래, 이번에는 남아 있군.” 그녀가 기억한 것은 이것이다. ${session.memories[0].fact}`
      : '세라는 대답 대신 빈 승차권을 내민다. “기억은 말한다고 생기는 게 아니야. 선택하고, 그 결과를 견뎌야 남지.” 멀리서 멈춰 있던 시계가 한 번 움직인다.';
  } else {
    session.world_state.echo_heard = true;
    result.reply = '당신의 행동이 텅 빈 승강장에 작은 파문을 만든다. 한 박자 늦게, 터널 저편에서 같은 소리가 되돌아온다. 세라는 그 메아리를 듣고 선로 쪽을 바라본다. “역이 반응했어. 계속해.”';
  }

  if (result.activeCharacter === 'sera') {
    session.relations.sera += result.relationshipDelta;
  }

  session.relations.sera = Math.max(-2, Math.min(3, session.relations.sera));
  session.relations.morrow = Math.max(-2, Math.min(3, session.relations.morrow));

  return result;
}

function toSessionResponse(session) {
  return {
    id: session.id,
    role: session.role,
    goal: session.goal,
    version: session.version,
    created_at: session.created_at,
  };
}

export const mockApi = {
  async createSession(payload) {
    const role = payload.role?.trim();
    const goal = payload.goal?.trim();

    if (!role || !goal) {
      throw new MockApiError(422, 'INPUT_INVALID', '역할과 목표를 모두 기록해주세요.');
    }

    await waitForScene();
    const timestamp = nowIso();
    const session = {
      id: createId(),
      role,
      goal,
      version: 0,
      created_at: timestamp,
      updated_at: timestamp,
      relations: {sera: 0, morrow: 0},
      world_state: {},
      memories: [],
      turns: [],
    };
    writeStoredSession(session);
    return toSessionResponse(session);
  },

  async playTurn(sessionId, payload) {
    const session = readStoredSession();
    if (!session || session.id !== sessionId) {
      throw new MockApiError(404, 'SESSION_NOT_FOUND', '기록을 찾을 수 없습니다. 새 기록을 시작해주세요.');
    }

    if (session.version !== payload.expected_version) {
      throw new MockApiError(409, 'SESSION_VERSION_CONFLICT', '다른 선택이 먼저 기록되었습니다. 최신 기록을 다시 불러와주세요.');
    }

    const action = payload.action?.trim();
    if (!action) {
      throw new MockApiError(422, 'INPUT_INVALID', '다음 행동을 한 문장으로 입력해주세요.');
    }

    await waitForScene();
    const scene = buildScene(session, action);
    session.version += 1;
    session.updated_at = nowIso();

    const turn = {
      turn_id: createId(),
      session_id: session.id,
      turn_no: session.version,
      action,
      reply: scene.reply,
      active_character: scene.activeCharacter,
      world_state: clone(session.world_state),
      relations: clone(session.relations),
      version: session.version,
      usage: {input_tokens: null, output_tokens: null, latency_ms: null},
      created_at: session.updated_at,
    };

    session.turns.push(turn);
    writeStoredSession(session);
    return clone(turn);
  },

  async restoreSession() {
    const session = readStoredSession();
    return session ? clone(session) : null;
  },

  clearSession() {
    volatileSession = null;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing else is required when storage is unavailable.
    }
  },
};
