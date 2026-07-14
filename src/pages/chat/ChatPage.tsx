import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Send, MessageCircle, Loader } from 'lucide-react';

interface ChatMessage {
  id: string;
  message: string;
  userId: string;
  createdAt: string;
  userName: string | null;
}

export default function ChatPage() {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/chat/messages?limit=100')
      .then(res => setMessages(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    };
    socket.on('chat:message', handler);
    return () => { socket.off('chat:message', handler); };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text || !socket) return;
    socket.emit('chat:send', { message: text });
    setInput('');
  }

  const currentUserId = user?.id || '';

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200/80 bg-white rounded-t-2xl">
        <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-300'}`} />
        <MessageCircle className="w-5 h-5 text-slate-500" />
        <h1 className="text-lg font-bold text-slate-900">Team Chat</h1>
        <span className="text-xs text-slate-400 ml-auto">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/50 px-6 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
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
                    <p className="text-[10px] font-semibold text-indigo-500 mb-1 uppercase tracking-wider">
                      {msg.userName || 'Unknown'}
                    </p>
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

      <div className="bg-white border-t border-slate-200/80 p-4 rounded-b-2xl">
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
    </div>
  );
}
