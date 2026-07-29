import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectSocket, initSocket } from '../client-socket-data';

type FakeSocket = {
  on: ReturnType<typeof vi.fn>;
  io: { on: ReturnType<typeof vi.fn> };
  disconnect: ReturnType<typeof vi.fn>;
  connected: boolean;
};

const { mockIo, createdSockets } = vi.hoisted(() => {
  const createdSockets: FakeSocket[] = [];
  const mockIo = vi.fn(() => {
    const socket: FakeSocket = {
      on: vi.fn(),
      io: { on: vi.fn() },
      disconnect: vi.fn(),
      connected: false,
    };
    createdSockets.push(socket);
    return socket;
  });
  return { mockIo, createdSockets };
});

// vitest hoists vi.mock above the imports above, so mocking socket.io-client before the
// client-socket-data import resolves takes effect despite appearing lower in the file.
vi.mock('socket.io-client', () => ({
  io: mockIo,
  Socket: class {},
}));

const SERVER_URL = 'https://example.com';

describe('client-socket-data socket lifecycle', () => {
  beforeEach(() => {
    // Reset module-level socket state, then clear recorded calls for a clean slate.
    disconnectSocket();
    createdSockets.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    disconnectSocket();
  });

  it('creates a socket on first initSocket and reuses it on subsequent calls', () => {
    initSocket(SERVER_URL, { Authorization: 'Bearer a' });
    initSocket(SERVER_URL, { Authorization: 'Bearer a' });
    expect(mockIo).toHaveBeenCalledTimes(1);
  });

  it('disconnects and clears the socket even when it is not connected, allowing a fresh connection', () => {
    initSocket(SERVER_URL, { Authorization: 'Bearer a' });
    expect(mockIo).toHaveBeenCalledTimes(1);
    const [firstSocket] = createdSockets;
    expect(firstSocket.connected).toBe(false);

    // Regression (F6): disconnectSocket() previously no-oped while the socket was not connected,
    // leaving a stale socket so the next user's initSocket() early-returned and silently reused the
    // prior user's authenticated connection.
    disconnectSocket();
    expect(firstSocket.disconnect).toHaveBeenCalledTimes(1);

    // The next login must open a brand-new socket rather than inherit the previous one.
    initSocket(SERVER_URL, { Authorization: 'Bearer b' });
    expect(mockIo).toHaveBeenCalledTimes(2);
  });

  it('is a safe no-op when no socket exists', () => {
    expect(() => disconnectSocket()).not.toThrow();
    expect(mockIo).not.toHaveBeenCalled();
  });
});
