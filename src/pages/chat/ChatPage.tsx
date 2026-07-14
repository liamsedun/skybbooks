import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Send, MessageCircle, Loader, Plus, Users, ArrowLeft, Check, X } from 'lucide-react';

interface UserInfo {
  userId: string;
  userName: string | null;
}

interface Conversation {
  id: string;
  title: string | null;
  participants: UserInfo[];
  lastMessage: { message: string; createdAt: string; userId: string; userName: string | null } | null;
}

interface ChatMsg {
  id: string;
  conversationId: string;
  message: string;
  userId: string;
  createdAt: string;
  userName: string | null;
}

export default function ChatPage() {
  const { socket, connected, joinConversations } = useSocket();
  const { user } = useAuth();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [orgUsers, setOrgUsers] = useState<{ id: string; fullName: string }[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const loadConvs = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConvs(res.data.data || []);
    } catch { /* ignore */ }
  }, []);

  // Fetch org users for new chat modal
  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/org/users');
      setOrgUsers(Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.users || []));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadConvs().finally(() => setLoading(false)); }, [loadConvs]);

  // When active conversation changes, load messages & join socket room
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    setMsgLoading(true);
    joinConversations([activeConvId]);
    api.get(`/chat/conversations/${activeConvId}/messages?limit=100`)
      .then(res => setMessages(res.data.data || []))
      .catch(() => setMessages([]))
      .finally(() => setMsgLoading(false));
  }, [activeConvId, joinConversations]);

  // Listen for new messages via socket
  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMsg) => {
      if (msg.conversationId === activeConvId) {
        setMessages(prev => [...prev, msg]);
      }
      // Update conversation list last message
      setConvs(prev => prev.map(c =>
        c.id === msg.conversationId
          ? { ...c, lastMessage: { message: msg.message, createdAt: msg.createdAt, userId: msg.userId, userName: msg.userName } }
          : c
      ));
    };
    socket.on('chat:message', handler);
    return () => { socket.off('chat:message', handler); };
  }, [socket, activeConvId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text || !socket || !activeConvId) return;
    socket.emit('chat:send', { conversationId: activeConvId, message: text });
    setInput('');
  }

  async function createConversation() {
    if (selectedUsers.length === 0) return;
      setCreating(true);
    try {
      const res = await api.post('/chat/conversations', { participantIds: selectedUsers });
      const conv = res.data.data;
      setActiveConvId(conv.id);
      setShowNewChat(false);
      setSelectedUsers([]);
      await loadConvs();
    } catch (e: any) {
      console.error('[Chat] Create conversation failed:', e?.response?.data || e?.message || e);
      alert('Failed to create conversation. Check console for details.');
    }
    finally { setCreating(false); }
  }

  function convDisplayName(c: Conversation): string {
    if (c.title) return c.title;
    const others = c.participants.filter(p => p.userId !== user?.id);
    return others.map(p => p.userName || 'Unknown').join(', ') || 'Just you';
  }

  const currentUserId = user?.id || '';

  return (
    <div className="flex h-[calc(100vh-8rem)] max-w-6xl mx-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Sidebar: conversation list */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200/80 flex flex-col bg-slate-50/50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-bold text-slate-800">Chats</span>
          </div>
          <button onClick={() => { setShowNewChat(true); loadUsers(); }} className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 transition-colors" title="New Chat">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400"><Loader className="w-4 h-4 animate-spin mr-2" />Loading...</div>
          ) : convs.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs text-slate-400">No conversations yet</p>
              <button onClick={() => { setShowNewChat(true); loadUsers(); }} className="mt-3 text-xs text-indigo-600 font-medium hover:underline">Start a new chat</button>
            </div>
          ) : (
            convs.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-100/60 transition-colors ${activeConvId === c.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}`}
              >
                <p className="text-sm font-medium text-slate-800 truncate">{convDisplayName(c)}</p>
                {c.lastMessage && (
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {c.lastMessage.userName}: {c.lastMessage.message}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-slate-200/80 flex items-center gap-2 text-[10px]">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-300'}`} />
          <span className="text-slate-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Main: messages area */}
      <div className="flex-1 flex flex-col">
        {!activeConvId ? (
          <div className="flex items-center justify-center flex-1 text-slate-400">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Select a chat or start a new one</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200/80 bg-white flex items-center gap-2">
              <button onClick={() => setActiveConvId(null)} className="p-1 -ml-1 rounded-lg hover:bg-slate-100 text-slate-400 lg:hidden"><ArrowLeft className="w-4 h-4" /></button>
              <Users className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-800 truncate">
                {convDisplayName(convs.find(c => c.id === activeConvId) || { participants: [], title: null, id: '', lastMessage: null })}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-slate-50/30 px-5 py-4 space-y-3">
              {msgLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-400"><Loader className="w-4 h-4 animate-spin mr-2" />Loading...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs mt-1">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.userId === currentUserId;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isMine
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-md shadow-sm'
                      }`}>
                        {!isMine && (
                          <p className="text-[10px] font-semibold text-indigo-500 mb-1 uppercase tracking-wider">{msg.userName || 'Unknown'}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-slate-200/80 p-4">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Type a message..."
                  className="flex-1 border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-shadow"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || !connected}
                  className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={() => setShowNewChat(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80">
              <h2 className="text-sm font-bold text-slate-800">New Conversation</h2>
              <button onClick={() => setShowNewChat(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
              {orgUsers
                .filter(u => u.id !== user?.id)
                .map(u => {
                  const isSelected = selectedUsers.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUsers(prev => isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="font-medium">{u.fullName || u.id.slice(0, 8)}</span>
                    </button>
                  );
                })}
              {orgUsers.filter(u => u.id !== user?.id).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No other users in this organisation</p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200/80">
              <button
                onClick={createConversation}
                disabled={selectedUsers.length === 0 || creating}
                className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {creating ? <Loader className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                Start Chat{selectedUsers.length > 1 ? ` (${selectedUsers.length} people)` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
