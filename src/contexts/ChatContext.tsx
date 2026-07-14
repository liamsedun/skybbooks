import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, orgApi } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const API_URL = (import.meta as any).env.VITE_API_URL || '';
const SOCKET_URL = (import.meta as any).env.VITE_SOCKET_URL || API_URL.replace('/api', '') || '';

interface UserInfo { id: string; fullName: string; }

interface ChatContextType {
  connected: boolean;
  onlineUserIds: Set<string>;
  orgUsers: UserInfo[];
  usersError: string | null;
  conversations: any[];
  activeConvId: string | null;
  messages: any[];
  unreadTotal: number;
  chatOpen: boolean;
  chatMinimized: boolean;
  setActiveConvId: (id: string | null) => void;
  sendMessage: (text: string) => void;
  toggleChat: () => void;
  setChatMinimized: (v: boolean) => void;
  startConversation: (targetUserId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [orgUsers, setOrgUsers] = useState<UserInfo[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);

  // Keep activeConvId in a ref for socket handlers
  const activeConvRef = useRef(activeConvId);
  activeConvRef.current = activeConvId;

  // Load org users
  const loadUsers = useCallback(async () => {
    if (!user?.orgId) return;
    try {
      const res = await orgApi.getUsers();
      const list = Array.isArray(res) ? res : (res?.users || res?.data || []);
      setOrgUsers(list.filter((u: any) => u.id !== user.id));
      setUsersError(null);
    } catch (err: any) {
      console.warn('[ChatContext] Failed to load org users:', err?.message || err);
      setUsersError(err?.response?.status === 401 ? 'Session expired. Please refresh.' : 'Failed to load users.');
    }
  }, [user?.orgId, user?.id]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Fetch conversations
  const refreshConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      const data = res.data?.data || [];
      setConversations(data);
      setUnreadTotal(data.reduce((s: number, c: any) => s + (c.unreadCount || 0), 0));
    } catch (err: any) {
      console.warn('[ChatContext] Failed to load conversations:', err?.response?.status, err?.message);
    }
  }, []);

  // Socket connection — register all event handlers here
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !user?.orgId) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('presence:update', (data: { onlineUserIds: string[] }) => {
      setOnlineUserIds(new Set(data.onlineUserIds || []));
    });

    socket.on('chat:message', (msg: any) => {
      if (msg.conversationId === activeConvRef.current) {
        setMessages((prev: any[]) => [...prev, msg]);
        api.post(`/chat/conversations/${msg.conversationId}/read`).catch(() => {});
      }
      refreshConversations();
    });

    socket.on('chat:notification', () => {
      refreshConversations();
    });

    socketRef.current = socket;
    refreshConversations();

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.orgId, refreshConversations]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:join', [activeConvId]);
    }
    api.post(`/chat/conversations/${activeConvId}/read`).catch(() => {});
    api.get(`/chat/conversations/${activeConvId}/messages?limit=100`)
      .then(res => setMessages(res.data?.data || []))
      .catch(() => setMessages([]));
  }, [activeConvId]);

  // Load conversations when chat opens
  useEffect(() => {
    if (chatOpen) refreshConversations();
  }, [chatOpen, refreshConversations]);

  function sendMessage(text: string) {
    if (!text.trim() || !socketRef.current?.connected || !activeConvId) return;
    socketRef.current.emit('chat:send', { conversationId: activeConvId, message: text.trim() });
  }

  function toggleChat() {
    setChatOpen(prev => !prev);
    if (chatMinimized) setChatMinimized(false);
  }

  async function startConversation(targetUserId: string) {
    try {
      const res = await api.post('/chat/conversations', { participantIds: [targetUserId] });
      const conv = res.data?.data;
      setActiveConvId(conv.id);
      if (socketRef.current?.connected) {
        socketRef.current.emit('chat:join', [conv.id]);
      }
      setChatMinimized(false);
      await refreshConversations();
    } catch (e: any) {
      console.error('[Chat] startConversation failed:', e?.response?.data || e?.message || e);
    }
  }

  return (
    <ChatContext.Provider value={{
      connected, onlineUserIds, orgUsers, usersError, conversations,
      activeConvId, messages, unreadTotal,
      chatOpen, chatMinimized,
      setActiveConvId, sendMessage, toggleChat, setChatMinimized, startConversation,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
