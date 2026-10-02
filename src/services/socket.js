import { io } from 'socket.io-client';

// Connect via Vite proxy if on dev port 3000, or directly to :3001
const URL = typeof window !== 'undefined'
  ? (window.location.port === '3000' ? undefined : `${window.location.protocol}//${window.location.hostname}:3001`)
  : 'http://localhost:3001';

export const socket = io(URL, {
  autoConnect: true,
});
