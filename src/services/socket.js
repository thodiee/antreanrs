import { io } from 'socket.io-client';

// In dev or production, connect to relative path or direct port 3001 if on different port
const getSocketUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  // If served via vite dev server on port 3000, Vite proxies /socket.io, but connecting directly to :3001 or window.location.origin ensures reliability
  if (window.location.port === '3000') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return undefined; // Same origin
};

export const socket = io(getSocketUrl(), {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  auth: (cb) => {
    try {
      const saved = localStorage.getItem('antrean_user');
      const token = saved ? JSON.parse(saved)?.token : null;
      cb({ token });
    } catch {
      cb({});
    }
  }
});

export function updateSocketAuth(token) {
  socket.auth = { token };
  if (socket.connected) {
    socket.emit('authenticate', { token });
  }
}
