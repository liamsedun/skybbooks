import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = (import.meta as any).env.VITE_API_URL || '';
const SOCKET_URL = (import.meta as any).env.VITE_SOCKET_URL || API_URL.replace('/api', '') || '';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setConnectError('No auth token'); return; }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => { setConnected(true); setConnectError(null); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      console.error('[Socket] connect_error:', err.message);
      setConnectError(err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConnectError(null);
    };
  }, []);

  const joinConversations = useCallback((convIds: string[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:join', convIds);
    }
  }, []);

  return { socket: socketRef.current, connected, connectError, joinConversations };
}
