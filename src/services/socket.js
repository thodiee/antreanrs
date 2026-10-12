import { io } from 'socket.io-client';

// Connect via Vite proxy if on dev port 3000, or directly to :3001
const URL = typeof window !== 'undefined'
  ? (window.location.port === '3000' ? undefined : `${window.location.protocol}//${window.location.hostname}:3001`)
  : 'http://localhost:3001';

export const socket = io(URL, {
  autoConnect: true,
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
