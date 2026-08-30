import {mockApi, MockApiError} from './mock-api.js';

const query = new URLSearchParams(window.location.search);
const USE_MOCK = query.get('mode') !== 'api';
const API_BASE_URL = (query.get('apiBase') ?? '').replace(/\/$/, '');

export class ApiClientError extends Error {
  constructor(status, body) {
    const fallback = '요청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
    super(body?.error?.message ?? fallback);
    this.name = 'ApiClientError';
    this.status = status;
    this.body = body ?? {error: {code: 'UNKNOWN', message: fallback}};
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiClientError(response.status, null);
    }
    return null;
  }

  const body = await response.json();
  if (!response.ok) {
    throw new ApiClientError(response.status, body);
  }
  return body;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw new ApiClientError(0, {
      error: {
        code: 'NETWORK_UNAVAILABLE',
        message: '서버에 닿지 못했습니다. 서버 실행 상태를 확인해주세요.',
      },
    });
  }

  return parseResponse(response);
}

async function runMock(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof MockApiError) {
      throw new ApiClientError(error.status, error.body);
    }
    throw error;
  }
}

export const apiClient = {
  mode: USE_MOCK ? 'mock' : 'api',

  async createSession(payload) {
    if (USE_MOCK) {
      return runMock(() => mockApi.createSession(payload));
    }
    return request('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async playTurn(sessionId, payload) {
    if (USE_MOCK) {
      return runMock(() => mockApi.playTurn(sessionId, payload));
    }
    return request(`/api/v1/sessions/${sessionId}/turns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async restoreSession() {
    if (!USE_MOCK) return null;
    return mockApi.restoreSession();
  },

  clearLocalSession() {
    if (USE_MOCK) mockApi.clearSession();
  },
};
