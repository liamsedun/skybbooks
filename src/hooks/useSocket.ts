import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = (import.meta as any).env.VITE_API_URL || '';
const SOCKET_URL = (import.meta as any).env.VITE_SOCKET_URL || API_URL.replace('/api', '') || '';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  const joinConversations = useCallback((convIds: string[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:join', convIds);
    }
  }, []);

  return { socket: socketRef.current, connected, joinConversations };
}
