import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const API_URL = (import.meta as any).env.VITE_API_URL || '';
const SOCKET_URL = (import.meta as any).env.VITE_SOCKET_URL || API_URL.replace('/api', '') || '';

interface UserInfo {
  id: string;
  fullName: string;
}

interface Participant {
  userId: string;
  userName: string | null;
}

interface Conversation {
  id: string;
  title: string | null;
  participants: Participant[];
  lastMessage: { message: string; createdAt: string; userId: string; userName: string | null } | null;
  unreadCount: number;
}

interface ChatMsg {
  id: string;
  conversationId: string;
  message: string;
  userId: string;
  createdAt: string;
  userName: string | null;
}

interface ChatContextType {
  connected: boolean;
  onlineUserIds: Set<string>;
  orgUsers: UserInfo[];
  conversations: Conversation[];
  activeConvId: string | null;
  messages: ChatMsg[];
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);

  // Load org users
  useEffect(() => {
    if (!user?.orgId) return;
    api.get('/org/users').then(res => {
      const users = Array.isArray(res.data) ? res.data : (res.data?.users || res.data?.data || []);
      setOrgUsers(users.filter((u: any) => u.id !== user.id));
    }).catch(() => {});
  }, [user?.orgId, user?.id]);

  // Socket connection
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !user?.orgId) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Presence updates
    socket.on('presence:update', (data: { onlineUserIds: string[] }) => {
      setOnlineUserIds(new Set(data.onlineUserIds || []));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.orgId]);

  // Listen for new messages
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handler = (msg: ChatMsg) => {
      if (msg.conversationId === activeConvId) {
        setMessages(prev => [...prev, msg]);
        markRead(msg.conversationId);
      }
      // Update conversation list + unread
      refreshConversations();
    };
    socket.on('chat:message', handler);
    return () => { socket.off('chat:message', handler); };
  }, [activeConvId]);

  // Notification handler for unread badge
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handler = () => {
      refreshConversations();
    };
    socket.on('chat:notification', handler);
    return () => { socket.off('chat:notification', handler); };
  }, []);

  // Refresh conversations
  const refreshConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      const data: Conversation[] = res.data.data || [];
      setConversations(data);
      setUnreadTotal(data.reduce((s, c) => s + (c.unreadCount || 0), 0));
    } catch {}
  }, []);

  // Load conversations when chat opens
  useEffect(() => {
    if (chatOpen) refreshConversations();
  }, [chatOpen, refreshConversations]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    joinConversations([activeConvId]);
    markRead(activeConvId);
    api.get(`/chat/conversations/${activeConvId}/messages?limit=100`)
      .then(res => setMessages(res.data.data || []))
      .catch(() => setMessages([]));
  }, [activeConvId]);

  function joinConversations(convIds: string[]) {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:join', convIds);
    }
  }

  async function markRead(convId: string) {
    try { await api.post(`/chat/conversations/${convId}/read`); } catch {}
  }

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
      const conv = res.data.data;
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
      connected,
      onlineUserIds,
      orgUsers,
      conversations,
      activeConvId,
      messages,
      unreadTotal,
      chatOpen,
      chatMinimized,
      setActiveConvId,
      sendMessage,
      toggleChat,
      setChatMinimized,
      startConversation,
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
