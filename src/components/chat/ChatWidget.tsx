import { useState, useEffect, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../hooks/useAuth';
import { MessageCircle, Minus, X, Send, ChevronDown, ChevronUp } from 'lucide-react';

export default function ChatWidget() {
  const {
    connected, onlineUserIds, orgUsers, conversations,
    activeConvId, messages, unreadTotal,
    chatOpen, chatMinimized,
    setActiveConvId, sendMessage, toggleChat, setChatMinimized, startConversation,
  } = useChat();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [view, setView] = useState<'users' | 'chat'>('users');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeConvId) setView('chat');
  }, [activeConvId]);

  function handleSend() {
    sendMessage(input);
    setInput('');
  }

  function findConvWithUser(targetUserId: string) {
    const existing = conversations.find(c => {
      const ids = c.participants.map((p: any) => p.userId);
      return ids.length === 2 && ids.includes(targetUserId) && ids.includes(user?.id || '');
    });
    if (existing) {
      setActiveConvId(existing.id);
    } else {
      startConversation(targetUserId);
    }
  }

  function getUnreadForUser(targetUserId: string): number {
    return conversations
      .filter(c => c.participants.some((p: any) => p.userId === targetUserId))
      .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }

  function getUserName(userId: string): string {
    const u = orgUsers.find(o => o.id === userId);
    return u?.fullName || userId.slice(0, 8);
  }

  const currentConv = conversations.find(c => c.id === activeConvId);
  const otherParticipant = currentConv?.participants.find((p: any) => p.userId !== user?.id);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all cursor-pointer"
        title="Team Chat"
      >
        <MessageCircle className="w-5 h-5" />
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-white">
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        )}
      </button>

      {/* Popup */}
      {chatOpen && (
        <div
          className={`fixed bottom-20 right-5 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col transition-all duration-200 ${
            chatMinimized ? 'h-12 w-72' : 'h-[520px] w-80'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/80 bg-slate-50 rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {view === 'chat' && (
                <button
                  onClick={() => { setView('users'); setActiveConvId(null); }}
                  className="p-0.5 hover:bg-slate-200 rounded text-slate-400 shrink-0 mr-1 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
              <MessageCircle className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 truncate">
                {view === 'chat' && otherParticipant
                  ? (otherParticipant.userName || getUserName(otherParticipant.userId))
                  : 'Team Chat'}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-300'}`} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChatMinimized(!chatMinimized)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 cursor-pointer"
              >
                {chatMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              </button>
              <button onClick={toggleChat} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!chatMinimized && (
            <>
              {view === 'users' ? (
                <div className="flex-1 overflow-y-auto">
                  {orgUsers.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <p className="text-xs text-slate-400">Loading users...</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {orgUsers.map(u => {
                        const isOnline = onlineUserIds.has(u.id);
                        const unread = getUnreadForUser(u.id);
                        return (
                          <button
                            key={u.id}
                            onClick={() => findConvWithUser(u.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                          >
                            <div className="relative shrink-0">
                              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                                {u.fullName?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                isOnline ? 'bg-green-500' : 'bg-red-400'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-semibold text-slate-800 block truncate">{u.fullName}</span>
                              <span className="text-[10px] text-slate-400">{isOnline ? 'Online' : 'Offline'}</span>
                            </div>
                            {unread > 0 && (
                              <span className="bg-indigo-600 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-slate-50/30">
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">No messages yet</div>
                    ) : (
                      messages.map((msg: any) => {
                        const isMine = msg.userId === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                              isMine
                                ? 'bg-indigo-600 text-white rounded-br-md'
                                : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-md'
                            }`}>
                              {!isMine && (
                                <p className="text-[9px] font-semibold text-indigo-500 mb-0.5">{msg.userName || 'Unknown'}</p>
                              )}
                              <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                              <p className={`text-[9px] mt-0.5 ${isMine ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>
                  <div className="border-t border-slate-200/80 p-2.5 bg-white rounded-b-2xl">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                        placeholder="Type a message..."
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || !connected}
                        className="bg-indigo-600 text-white rounded-xl px-3 py-2 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
