import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Agent, ChatSimulationSettings, Message, Space } from '../types';
import { SPACES } from '../constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Paperclip, Search, Phone, ChevronLeft, Info, Smile, X, ChevronUp, ChevronDown, Palette, Pin, Archive, MoreVertical, PinOff, Trash2, Sun, Moon, Reply, Clock, Check } from 'lucide-react';
import { getChatHistory, sendChatMessage } from '@/src/services/chatService';
import { ChatSocketClient, isWebSocketConfigured } from '@/src/services/chatSocket';
import { UNAUTHORIZED_EVENT } from '@/src/utils/apiFetch';

interface ChatTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  gradient: string;
}

const APP_THEMES: ChatTheme[] = [
  { id: 'blush', name: 'Blush Calm', primary: '#FFB6C1', secondary: '#FFD1DC', gradient: 'linear-gradient(135deg, #FFF5F7 0%, #FFE4E8 100%)' },
  { id: 'sunset', name: 'Sunset Mood', primary: '#FF7E5F', secondary: '#FEB47B', gradient: 'linear-gradient(135deg, #FFF1EB 0%, #ACE0F9 100%)' },
  { id: 'ocean', name: 'Ocean Air', primary: '#4facfe', secondary: '#00f2fe', gradient: 'linear-gradient(135deg, #E0F7FA 0%, #B2EBF2 100%)' },
  { id: 'night', name: 'Night Pulse', primary: '#667eea', secondary: '#764ba2', gradient: 'linear-gradient(135deg, #E8EAF6 0%, #C5CAE9 100%)' },
  { id: 'mint', name: 'Fresh Mint', primary: '#00b09b', secondary: '#96c93d', gradient: 'linear-gradient(135deg, #F1F8E9 0%, #DCEDC8 100%)' },
  { id: 'cloud', name: 'Cloud Soft', primary: '#e6e9f0', secondary: '#eef1f5', gradient: 'linear-gradient(135deg, #F5F7FA 0%, #C3CFE2 100%)' },
  { id: 'violet', name: 'Violet Dream', primary: '#6a11cb', secondary: '#2575fc', gradient: 'linear-gradient(135deg, #F3E5F5 0%, #EDE7F6 100%)' },
  { id: 'peach', name: 'Peach Glow', primary: '#ff9a9e', secondary: '#fad0c4', gradient: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)' },
  { id: 'neon', name: 'Neon Pop', primary: '#00f2fe', secondary: '#4facfe', gradient: 'linear-gradient(135deg, #E0F2F1 0%, #B2DFDB 100%)' },
  { id: 'golden', name: 'Golden Hour', primary: '#f6d365', secondary: '#fda085', gradient: 'linear-gradient(135deg, #FFFDE7 0%, #FFF9C4 100%)' },
  { id: 'ice', name: 'Ice Blue', primary: '#a1c4fd', secondary: '#c2e9fb', gradient: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)' },
  { id: 'dual', name: 'Dual Tone', primary: '#cfd9df', secondary: '#e2ebf0', gradient: 'linear-gradient(135deg, #E1E1E1 0%, #F5F5F5 100%)' },
];
import { cn } from '@/lib/utils';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

interface ChatProps {
  agents: Agent[];
  activeAgentId: string | null;
  chatSettings: ChatSimulationSettings;
  onAgentSelect: (agentId: string) => void;
  activeSpaceId?: string | null;
  onDeleteAgent: (agentId: string) => void;
  onTogglePin: (agentId: string) => void;
  onToggleArchive: (agentId: string) => void;
  onAgentActivity: (agentId: string, text: string, timestamp: Date | string) => void;
  onBack?: () => void;
  theme: 'light' | 'dark';
}

interface ChatListItemProps {
  agent: Agent;
  isActive: boolean;
  onSelect: () => void;
  onPin: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onPreview: () => void;
  theme: 'light' | 'dark';
}

interface PendingQueuedMessage {
  id: string;
  text: string;
  replyToMessageId?: string;
  replyPreview?: string;
}

function buildClientMessageId(prefix: string, index?: number) {
  return `${prefix}-${Date.now()}${typeof index === 'number' ? `-${index}` : ''}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRemoteMessageId(
  message: { messageId?: string; timestamp: string; role: string; personaId?: string; text: string },
  index: number
) {
  return (
    message.messageId?.trim() ||
    `${message.personaId || 'persona'}-${message.role}-${message.timestamp}-${index}`.replace(/\s+/g, '-')
  );
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function dedupeMessages(input: Message[]) {
  const unique = new Map<string, Message>();
  for (const message of input) {
    const timestampIso =
      message.timestamp instanceof Date ? message.timestamp.toISOString() : new Date(message.timestamp).toISOString();
    const key = `${message.id}|${message.sender}|${message.agentId || ''}|${message.spaceId || ''}|${timestampIso}`;
    unique.set(key, message);
  }
  return Array.from(unique.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function getFormattedChunkText(currentMessage: Message, nextMessage?: Message) {
  const currentText = String(currentMessage.text || '');
  const currentGroup = currentMessage.metadata?.chunkGroupId;
  const nextGroup = nextMessage?.metadata?.chunkGroupId;
  const isSameBurst =
    Boolean(currentGroup) &&
    Boolean(nextGroup) &&
    currentGroup === nextGroup &&
    currentMessage.sender === nextMessage?.sender;

  if (!isSameBurst) {
    return currentText;
  }

  return currentText.replace(/[,\u2014;:]\s*$/u, '').trimEnd();
}

function formatConversationTimestamp(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const ChatListItem: React.FC<ChatListItemProps> = ({ agent, isActive, onSelect, onPin, onArchive, onDelete, onPreview, theme }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left relative group cursor-pointer border border-transparent",
        isActive 
          ? (theme === 'dark' 
              ? "bg-[#2a3942] shadow-[0_4px_12px_rgba(0,0,0,0.2)] ring-1 ring-white/10" 
              : "bg-white shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] ring-1 ring-[#F0E7FF]")
          : (theme === 'dark' 
              ? "hover:bg-[#202c33]/80 text-[#e9edf0]" 
              : "hover:bg-[#F7F7F8] text-[#111111]")
      )}
    >
      <div className="relative shrink-0">
        <Avatar 
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className={cn(
            "w-12 h-12 border shadow-sm transition-transform duration-500 group-hover:scale-110 cursor-zoom-in",
            theme === 'dark' ? "border-[#222e35]" : "border-white"
          )}
        >
          <AvatarImage src={agent.avatar} className="object-cover" />
          <AvatarFallback className={cn("font-bold text-white", theme === 'dark' ? "bg-[#2a3942]" : "bg-muted")}>{agent.name[0]}</AvatarFallback>
        </Avatar>
        <div className="absolute bottom-0 right-0">
          {agent.status === 'online' ? (
            <motion.div 
              animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }} 
              transition={{ duration: 1.5, repeat: Infinity }}
              className={cn(
                "w-3.5 h-3.5 rounded-full border-2 bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                theme === 'dark' ? "border-[#111b21]" : "border-white"
              )} 
            />
          ) : (
            <div className={cn(
              "w-3.5 h-3.5 rounded-full border-2 shadow-sm",
              theme === 'dark' ? "border-[#111b21]" : "border-white",
              agent.status === 'busy' ? "bg-amber-500" : "bg-[#9CA3AF]"
            )} />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-2 truncate">
            <h3 className={cn("text-[15px] font-black truncate transition-colors font-sans tracking-tight", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>{agent.name}</h3>
            {agent.isPinned && <Pin className="w-3 h-3 text-[#FF2E93] shrink-0 fill-[#FF2E93]" />}
          </div>
          <span className={cn("text-[10px] font-bold font-sans", theme === 'dark' ? "text-[#8696a0]" : "text-[#6B7280]/40")}>
            {formatConversationTimestamp(agent.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className={cn("text-[12px] font-medium truncate leading-snug font-sans italic opacity-85 max-w-[85%]", theme === 'dark' ? "text-[#8696a0]/85" : "text-[#6B7280]")}>
            {agent.lastMessage || agent.tagline || (agent.status === 'online' ? 'Ready to reply' : agent.status)}
          </p>
          {agent.status === 'online' && !isActive && (
            <div className="w-2 h-2 rounded-full bg-[#FF2E93] shadow-[0_0_8px_rgba(255,46,147,0.4)]" />
          )}
        </div>
      </div>

      {/* Hover Options Menu */}
      <div className={cn(
        "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 p-1 rounded-full shadow-sm border",
        theme === 'dark' 
          ? "bg-[#202c33]/90 backdrop-blur-sm border-[#303f47]" 
          : "bg-white/80 backdrop-blur-sm border-[#F0F0F0]"
      )}>
        <Button variant="ghost" size="icon" title={agent.isPinned ? "Unpin" : "Pin"} className={cn("w-7 h-7 rounded-full text-[#6B7280] transition-colors", theme === 'dark' ? "hover:text-[#FF2E93] hover:bg-[#2a3942]" : "hover:text-[#FF2E93]")} onClick={onPin}>
          {agent.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" title={agent.isArchived ? "Unarchive" : "Archive"} className={cn("w-7 h-7 rounded-full text-[#6B7280] transition-colors", theme === 'dark' ? "hover:text-[#FF2E93] hover:bg-[#2a3942]" : "hover:text-[#FF2E93]")} onClick={onArchive}>
          <Archive className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" title="Delete" className={cn("w-7 h-7 rounded-full text-[#6B7280] transition-colors", theme === 'dark' ? "hover:text-red-500 hover:bg-[#2a3942]" : "hover:text-red-500")} onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      
      {isActive && (
        <motion.div 
          layoutId="active-indicator"
          className="absolute left-0 w-1.5 h-1/2 rounded-r-full"
          style={{ backgroundColor: agent.theme.primary }}
        />
      )}
    </motion.div>
  );
};

export default function Chat({ 
  agents, 
  activeAgentId, 
  chatSettings,
  onAgentSelect, 
  activeSpaceId: activeSpaceIdProp,
  onDeleteAgent,
  onTogglePin,
  onToggleArchive,
  onAgentActivity,
  onBack,
  theme
}: ChatProps) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyTarget, setReplyTarget] = useState<{ messageId: string; text: string; senderName: string } | null>(null);
  const [typingAgents, setTypingAgents] = useState<string[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHeaderSearch, setShowHeaderSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [msgSearchResults, setMsgSearchResults] = useState<number[]>([]);
  const [currentMsgResultIndex, setCurrentMsgResultIndex] = useState(-1);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [customThemes, setCustomThemes] = useState<Record<string, ChatTheme>>({});
  const [sidebarWidth, setSidebarWidth] = useState(330);
  const [isResizing, setIsResizing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string } | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(activeSpaceIdProp || null);

  useEffect(() => {
    setActiveSpaceId(activeSpaceIdProp || null);
  }, [activeSpaceIdProp]);
  
  const activeSpace = SPACES.find(s => s.id === activeSpaceId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadRequestRef = useRef(0);
  const shouldStickToBottomRef = useRef(true);
  const isSendingRef = useRef(false);
  const typingAgentsRef = useRef<string[]>([]);
  const pendingAssistantIdRef = useRef<string | null>(null);
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const messageQueueRef = useRef<PendingQueuedMessage[]>([]);
  const socketClientRef = useRef<ChatSocketClient | null>(null);
  const socketConnectedRef = useRef(false);
  const spontaneousTimerRef = useRef<number | null>(null);
  const lastUserActivityRef = useRef<number>(Date.now());
  const webSocketTimeoutsRef = useRef<number[]>([]);
  const onEventRef = useRef<((payload: any) => void) | null>(null);

  const addWebSocketTimeout = useCallback((fn: () => void, delay: number) => {
    const timer = window.setTimeout(fn, delay);
    webSocketTimeoutsRef.current.push(timer);
    return timer;
  }, []);

  const clearWebSocketTimeouts = useCallback(() => {
    webSocketTimeoutsRef.current.forEach(timer => window.clearTimeout(timer));
    webSocketTimeoutsRef.current = [];
  }, []);

  const activeAgent = agents.find(a => a.id === activeAgentId) || agents[0] || null;

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  const showChatListOnMobile = isMobile && !activeAgentId && !activeSpaceId;
  const showChatViewOnMobile = isMobile && (activeAgentId || activeSpaceId);

  const handlePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(id);
  };

  const handleArchive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleArchive(id);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this persona?')) {
      onDeleteAgent(id);
    }
  };

  const currentTheme = activeAgent ? customThemes[activeAgent.id] || {
    id: 'default',
    name: 'Agent Default',
    primary: activeAgent.theme.primary,
    secondary: activeAgent.theme.secondary,
    gradient: activeAgent.theme.gradient
  } : {
    id: 'default',
    name: 'Default',
    primary: '#111111',
    secondary: '#DDDDDD',
    gradient: 'linear-gradient(135deg, #FAFAFA 0%, #F2F4F7 100%)',
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 200 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  // Handle textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);
  
  const sortedAgents = useMemo(() => {
    return [...agents].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      const rightActivity = new Date(right.lastMessageAt || right.lastSeen || 0).getTime();
      const leftActivity = new Date(left.lastMessageAt || left.lastSeen || 0).getTime();

      if (rightActivity !== leftActivity) {
        return rightActivity - leftActivity;
      }

      return left.name.localeCompare(right.name);
    });
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return sortedAgents.filter(a => 
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (a.tagline || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, sortedAgents]);

  const scrollToBottom = (force = false) => {
    if (messagesContainerRef.current) {
      if (!force && (!chatSettings.autoScrollToLatest || !shouldStickToBottomRef.current)) {
        return;
      }
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingAgents, chatSettings.autoScrollToLatest]);

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom < 120;
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeAgent?.id, activeSpace?.id]);

  useEffect(() => {
    shouldStickToBottomRef.current = true;
    window.setTimeout(() => {
      scrollToBottom(true);
    }, 0);
  }, [activeAgent?.id, activeSpace?.id]);

  useEffect(() => {
    if (activeSpace && !messages.some(m => m.spaceId === activeSpace.id && m.sender === 'system')) {
      const systemMessage: Message = {
        id: `sys-${activeSpace.id}`,
        spaceId: activeSpace.id,
        sender: 'system',
        text: `Welcome to ${activeSpace.name}! ${activeSpace.description}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, systemMessage]);
    }
  }, [activeSpace, activeSpaceId]);

  // Keep refs in sync so the polling effect doesn't need these as dependencies
  useEffect(() => { isSendingRef.current = isSending; }, [isSending]);
  useEffect(() => { typingAgentsRef.current = typingAgents; }, [typingAgents]);
  useEffect(() => { socketConnectedRef.current = isSocketReady; }, [isSocketReady]);

  useEffect(() => {
    let mounted = true;
    let pollingTimer: number | null = null;

    async function loadConversation(showLoading = false) {
      if (!activeAgent || activeSpace) {
        return;
      }

      // Skip poll ticks while sending / typing (checked via refs to avoid dep churn)
      if (!showLoading && (isSendingRef.current || typingAgentsRef.current.length > 0)) {
        return;
      }

      const requestId = ++loadRequestRef.current;
      if (showLoading) {
        setIsHistoryLoading(true);
      }
      setChatError(null);

      try {
        const response = await getChatHistory(activeAgent.id);
        if (!mounted || requestId !== loadRequestRef.current) {
          return;
        }

        setMessages(previous => {
          const nonDirectMessages = previous.filter(message => message.spaceId);
          const optimisticDirectMessages = previous.filter(
            (message) =>
              !message.spaceId &&
              message.agentId === activeAgent.id &&
              message.sender === 'user' &&
              message.id.startsWith('user-')
          );
          const conversationMessages = response.messages
            .map((message, index) => ({
              id: normalizeRemoteMessageId(message, index),
              agentId: message.personaId,
              text: message.text,
              sender: message.role === 'assistant' ? 'agent' : 'user',
              timestamp: new Date(message.timestamp),
              metadata: message.metadata,
            }))
            .filter(m => !deletedIdsRef.current.has(m.id)) as Message[];

          return dedupeMessages([...nonDirectMessages, ...conversationMessages, ...optimisticDirectMessages]);
        });

        const latestMessage = response.messages[response.messages.length - 1];
        if (latestMessage?.text) {
          onAgentActivity(activeAgent.id, latestMessage.text, latestMessage.timestamp);
        }
      } catch (error) {
        if (mounted) {
          setChatError(error instanceof Error ? error.message : 'Failed to load chat history');
        }
      } finally {
        if (mounted && showLoading) {
          setIsHistoryLoading(false);
        }
      }
    }

    void loadConversation(true);
    if (activeAgent && !activeSpace && !isSocketReady) {
      pollingTimer = window.setInterval(() => {
        void loadConversation(false);
      }, 3000);
    }
    return () => {
      mounted = false;
      if (pollingTimer) {
        window.clearInterval(pollingTimer);
      }
    };
  }, [activeAgent?.id, activeSpace, isSocketReady]);

  const computePersonaDelay = (agent: Agent | null, backendDelay = 1500) => {
    if (!chatSettings.realisticMode || !agent) {
      return Math.max(500, Math.min(5000, backendDelay));
    }

    // Ensure seconds are sane — clamp min to [1,30] and max to [min,30]
    const clampedMin = Math.max(1, Math.min(30, chatSettings.minResponseDelaySeconds));
    const clampedMax = Math.max(clampedMin, Math.min(30, chatSettings.maxResponseDelaySeconds));
    const minMs = clampedMin * 1000;
    const maxMs = clampedMax * 1000;
    const speed = (agent.responseSpeed || '').toLowerCase();

    let normalized = 0.55;
    if (speed.includes('instant')) normalized = 0.1;
    else if (speed.includes('fast')) normalized = 0.25;
    else if (speed.includes('normal')) normalized = 0.45;
    else if (speed.includes('slow')) normalized = 0.8;
    else if (speed.includes('random')) normalized = Math.random();

    const windowDelay = minMs + normalized * (maxMs - minMs);
    const jitter = Math.random() * Math.min(3000, (maxMs - minMs) * 0.15);
    // Never wait longer than 180s total regardless of settings
    return Math.round(Math.min(180000, Math.max(windowDelay + jitter, backendDelay)));
  };

  const deliverAssistantResponse = useCallback(async (
    response: any,
    targetAgent: Agent
  ) => {
    if (response.status === 'scheduled') {
      const readDelay = response.readDelay || 3000;
      const thinkingDelay = response.thinkingDelay || 15000;

      // 1. Update the user message to delivered immediately
      if (response.userMessage) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === response.userMessage.messageId
              ? { ...msg, status: 'delivered' }
              : msg
          )
        );
      }

      // 2. Schedule seen status
      await new Promise((resolve) => setTimeout(resolve, readDelay));
      if (response.userMessage) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === response.userMessage.messageId
              ? { ...msg, status: 'seen' }
              : msg
          )
        );
        // Persist seen in DB via REST API
        void sendChatMessage({
          personaId: targetAgent.id,
          conversationId: targetAgent.id,
          message: '',
          actionType: 'seen',
          messageId: response.userMessage.messageId,
          timestamp: response.userMessage.timestamp,
        }).catch(() => {});
      }

      // 3. Wait for the thinking delay
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, thinkingDelay - readDelay)));

      // 4. Start typing animation
      setTypingAgents([targetAgent.name]);

      // 5. Call backend generate
      try {
        const genResponse = await sendChatMessage({
          personaId: targetAgent.id,
          conversationId: targetAgent.id,
          message: '',
          actionType: 'generate',
        });
        
        // Deliver the generated chunks
        await deliverAssistantResponse(genResponse, targetAgent);
      } catch (err) {
        console.error('Failed to generate assistant response:', err);
      } finally {
        setTypingAgents([]);
      }
      return;
    }

    const assistantMessages =
      response.assistantMessages?.length
        ? response.assistantMessages
        : response.assistantMessage
          ? [response.assistantMessage]
          : [];
    const chunks =
      assistantMessages.length > 0
        ? assistantMessages.map((message: any) => message.text)
        : response.chunks?.length
          ? response.chunks
          : [];
    const chunkDelays =
      response.chunkDelays?.length
        ? response.chunkDelays
        : assistantMessages.map((message: any, index: number) => message.metadata?.delay ?? (index === 0 ? response.typingDelay || 0 : 1200));
    
    const thinkingDelay =
      response.thinkingDelay ||
      assistantMessages[0]?.metadata?.thinkingDelay ||
      0;
    const initialTypingDelay =
      response.typingDelay ||
      assistantMessages[0]?.metadata?.typingDelay ||
      computePersonaDelay(targetAgent, response.responseDelay ?? 1500);

    if (chunks.length === 0) {
      return;
    }

    // Step 1: Thinking / Idle delay (NO typing animation)
    if (thinkingDelay > 0) {
      setTypingAgents([]);
      await wait(thinkingDelay);
    }

    // Step 2: Typing delay (typing animation IS shown)
    setTypingAgents([targetAgent.name]);
    await wait(Math.max(500, initialTypingDelay));
    setTypingAgents([]);

    for (let index = 0; index < chunks.length; index += 1) {
      const savedMessage = assistantMessages[index];
      const messageId = savedMessage?.messageId || buildClientMessageId('assistant-chunk', index);
      const messageTimestamp = savedMessage?.timestamp
        ? new Date(savedMessage.timestamp)
        : new Date(Date.now() + chunkDelays.slice(0, index + 1).reduce((sum: number, delay: number) => sum + delay, 0));
      onAgentActivity(targetAgent.id, chunks[index], messageTimestamp);

      setMessages(prev => {
        const assistantMessage: Message = {
          id: messageId,
          agentId: targetAgent.id,
          sender: 'agent',
          text: chunks[index],
          timestamp: messageTimestamp,
          replyToMessageId: savedMessage?.replyToMessageId || undefined,
          replyPreview: savedMessage?.replyPreview || undefined,
          status: 'sent',
          metadata: savedMessage?.metadata,
        };

        return dedupeMessages([...prev, assistantMessage].filter(m => !deletedIdsRef.current.has(m.id)));
      });

      // Mark companion message seen
      if (socketClientRef.current?.isReady() && savedMessage?.messageId) {
        socketClientRef.current.send({
          action: 'sendmessage',
          actionType: 'seen',
          messageId: savedMessage.messageId,
          timestamp: savedMessage.timestamp,
        });
      } else if (savedMessage?.messageId) {
        void sendChatMessage({
          personaId: targetAgent.id,
          conversationId: targetAgent.id,
          message: '',
          actionType: 'seen',
          messageId: savedMessage.messageId,
          timestamp: savedMessage.timestamp,
        }).catch(() => {});
      }

      if (index < chunks.length - 1) {
        setTypingAgents([targetAgent.name]);
        await wait(Math.max(600, chunkDelays[index + 1] ?? 1200));
        setTypingAgents([]);
      }
    }
  }, [computePersonaDelay]);

  // Assign event handler to ref on every render to avoid subscription re-registrations
  onEventRef.current = (payload) => {
    if (payload?.type === 'socket_open') {
      setIsSocketReady(true);
      if (activeAgent) {
        socketClientRef.current?.joinConversation(activeAgent.id, activeAgent.id);
      }
      return;
    }

    if (payload?.type === 'socket_close') {
      setIsSocketReady(false);
      return;
    }

    if (payload?.type === 'socket_disabled' || payload?.type === 'socket_error') {
      setIsSocketReady(false);
      if (typeof payload.reason === 'string' && payload.reason.trim()) {
        setChatError(payload.reason);
      }
      return;
    }

    if (!activeAgent || (payload?.conversationId && payload.conversationId !== activeAgent.id)) {
      return;
    }

    if (payload?.type === 'message_ack' && payload.message) {
      onAgentActivity(activeAgent.id, payload.message.text, payload.message.timestamp);
      const savedUser: Message = {
        id: payload.message.messageId || buildClientMessageId('user'),
        agentId: activeAgent.id,
        sender: 'user',
        text: payload.message.text,
        timestamp: new Date(payload.message.timestamp),
        replyToMessageId: payload.message.replyToMessageId || undefined,
        replyPreview: payload.message.replyPreview || undefined,
        status: payload.message.status || 'sent',
        metadata: payload.message.metadata,
      };

      setMessages((prev) => {
        const withoutTemp = payload.tempId ? prev.filter((message) => message.id !== payload.tempId) : prev;
        return dedupeMessages([...withoutTemp, savedUser].filter((message) => !deletedIdsRef.current.has(message.id)));
      });
      return;
    }

    if (payload?.type === 'reply_scheduled') {
      const readDelay = payload.readDelay || 3000;
      const thinkingDelay = payload.thinkingDelay || 15000;

      if (payload.userMessage) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === payload.userMessage.messageId
              ? { ...msg, status: 'delivered' }
              : msg
          )
        );

        // Schedule seen status
        addWebSocketTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.userMessage.messageId
                ? { ...msg, status: 'seen' }
                : msg
            )
          );
          if (socketClientRef.current?.isReady()) {
            socketClientRef.current.send({
              action: 'sendmessage',
              actionType: 'seen',
              messageId: payload.userMessage.messageId,
              timestamp: payload.userMessage.timestamp,
            });
          }
        }, readDelay);
      }

      // Schedule typing animation start after thinking delay starts
      addWebSocketTimeout(() => {
        setTypingAgents([activeAgent.name]);
      }, thinkingDelay);

      // Schedule request for actual generation
      addWebSocketTimeout(() => {
        if (socketClientRef.current?.isReady()) {
          socketClientRef.current.send({
            action: 'sendmessage',
            actionType: 'generate',
            personaId: activeAgent.id,
            conversationId: activeAgent.id,
          });
        }
      }, thinkingDelay + 200);

      return;
    }

    if (payload?.type === 'message_status') {
      const { messageId, status } = payload;
      if (messageId && status) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, status: status }
              : msg
          )
        );
      }
      return;
    }

    if (payload?.type === 'ai_response') {
      setTypingAgents([]);
      if (payload.userMessage) {
        setMessages((prev) => {
          const withoutTemp = payload.tempId ? prev.filter((message) => message.id !== payload.tempId) : prev;
          const savedUser: Message = {
            id: payload.userMessage.messageId || buildClientMessageId('user'),
            agentId: activeAgent.id,
            sender: 'user',
            text: payload.userMessage.text,
            timestamp: new Date(payload.userMessage.timestamp),
            replyToMessageId: payload.userMessage.replyToMessageId || undefined,
            replyPreview: payload.userMessage.replyPreview || undefined,
            status: payload.userMessage.status || 'sent',
            metadata: payload.userMessage.metadata,
          };
          return dedupeMessages([...withoutTemp, savedUser].filter((message) => !deletedIdsRef.current.has(message.id)));
        });
      }
      deliverAssistantResponse(payload, activeAgent);
      return;
    }

    if (
      payload?.type === 'ai_typing' ||
      payload?.type === 'ai_typing_start' ||
      payload?.type === 'ai_typing_resume' ||
      payload?.type === 'ai_pause'
    ) {
      setTypingAgents([activeAgent.name]);
      return;
    }

    if (payload?.type === 'ai_typing_pause') {
      setTypingAgents([]);
      return;
    }

    if (payload?.type === 'ai_chunk' && payload.message) {
      setTypingAgents([]);
      onAgentActivity(activeAgent.id, payload.message.text, payload.message.timestamp);
      setMessages((prev) => {
        const nextMessage: Message = {
          id: payload.message.messageId || buildClientMessageId('assistant-socket'),
          agentId: activeAgent.id,
          sender: 'agent',
          text: payload.message.text,
          timestamp: new Date(payload.message.timestamp),
          replyToMessageId: payload.message.replyToMessageId || undefined,
          replyPreview: payload.message.replyPreview || undefined,
          status: 'sent',
          metadata: payload.message.metadata,
        };

        return dedupeMessages([...prev, nextMessage].filter((message) => !deletedIdsRef.current.has(message.id)));
      });
      return;
    }

    if (payload?.type === 'ai_done') {
      setTypingAgents([]);
      lastUserActivityRef.current = Date.now();
    }
  };

  useEffect(() => {
    if (!activeAgent || activeSpace || !isWebSocketConfigured()) {
      setIsSocketReady(false);
      socketClientRef.current?.leaveConversation();
      return;
    }

    const client = socketClientRef.current || new ChatSocketClient();
    socketClientRef.current = client;

    const unsubscribe = client.onEvent((payload) => {
      onEventRef.current?.(payload);
    });

    client.connect();
    client.joinConversation(activeAgent.id, activeAgent.id);

    return () => {
      unsubscribe();
      client.leaveConversation();
      clearWebSocketTimeouts();
    };
  }, [activeAgent?.id, activeSpace]);



  // Process the message queue: combines nearby user messages, sends them once, then streams the AI bursts back in.
  const processMessageQueue = useCallback(async () => {
    if (!activeAgent || activeSpace) return;
    const queue = [...messageQueueRef.current];
    messageQueueRef.current = [];
    if (queue.length === 0) return;

    const combinedMessage = queue.map((entry) => entry.text).join('\n');
    const queuedPendingIds = new Set(queue.map((entry) => entry.id));

    isSendingRef.current = true;
    setIsSending(true);
    setChatError(null);

    const firstEntry = queue[0];
    const replyToMessageId = firstEntry.replyToMessageId;
    const replyPreview = firstEntry.replyPreview;

    try {
      const response = await sendChatMessage({
        personaId: activeAgent.id,
        conversationId: activeAgent.id,
        message: combinedMessage,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        replyToMessageId,
        replyPreview,
        messageId: firstEntry.id,
      });
      pendingAssistantIdRef.current =
        response.assistantMessages?.[response.assistantMessages.length - 1]?.messageId ||
        response.assistantMessage?.messageId ||
        null;

      setMessages(prev => {
        // Remove only the optimistic messages that were actually sent in this batch.
        const cleaned = prev.filter(message => !queuedPendingIds.has(message.id));

        // Add server-saved user message (from last msg in queue — DB has all of them via individual saves)
        const savedUser: Message | null = response.userMessage ? {
          id: response.userMessage.messageId || buildClientMessageId('user'),
          agentId: activeAgent.id,
          sender: 'user',
          text: response.userMessage.text,
          timestamp: new Date(response.userMessage.timestamp),
          replyToMessageId: response.userMessage.replyToMessageId || replyToMessageId,
          replyPreview: response.userMessage.replyPreview || replyPreview,
          status: response.userMessage.status || 'sent',
          metadata: response.userMessage.metadata,
        } : null;
        if (response.userMessage?.text) {
          onAgentActivity(activeAgent.id, response.userMessage.text, response.userMessage.timestamp);
        }
        return dedupeMessages((savedUser ? [...cleaned, savedUser] : cleaned).filter(m => !deletedIdsRef.current.has(m.id)));
      });

      await deliverAssistantResponse(response, activeAgent);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      pendingAssistantIdRef.current = null;
      setTypingAgents([]);
      isSendingRef.current = false;
      setIsSending(false);
      lastUserActivityRef.current = Date.now();

      if (messageQueueRef.current.length > 0) {
        void processMessageQueue();
      }
    }
  }, [activeAgent, activeSpace, deliverAssistantResponse]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (!activeSpace && !activeAgent) {
      return;
    }

    const messageText = inputText.trim();
    const pendingMessageId = buildClientMessageId('user');
    const quoteId = replyTarget?.messageId;
    const quoteText = replyTarget?.text;

    const newMessage: Message = {
      id: pendingMessageId,
      agentId: activeSpace ? undefined : activeAgent?.id,
      spaceId: activeSpace?.id,
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
      replyToMessageId: quoteId,
      replyPreview: quoteText,
      status: 'sending',
    };

    setMessages(prev => [...prev, newMessage]);
    if (!activeSpace && activeAgent) {
      onAgentActivity(activeAgent.id, messageText, newMessage.timestamp);
    }
    setInputText('');
    shouldStickToBottomRef.current = true;
    lastUserActivityRef.current = Date.now();
    
    if (activeSpace) {
      const spaceAgents = agents.filter(a => activeSpace.agents.includes(a.id));
      const chosenAgents = [...spaceAgents]
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 2) + 2);

      chosenAgents.forEach((agent, index) => {
        const delay = 1500 * (index + 1) + Math.random() * 2000;
        
        setTimeout(() => {
          setTypingAgents(prev => [...new Set([...prev, agent.name])]);
        }, delay - 1000);

        setTimeout(() => {
          setTypingAgents(prev => prev.filter(name => name !== agent.name));
          const botResponse: Message = {
            id: `bot-${Date.now()}-${index}`,
            agentId: agent.id,
            spaceId: activeSpace.id,
            sender: 'agent',
            text: index === 0 
              ? `That's an interesting point about "${messageText}". I think we should explore it more.`
              : index === 1 
                ? `I agree with ${chosenAgents[0].name}. Also, from my perspective, this adds a whole new dimension.`
                : `Wait, let me jump in! Have we considered how this fits into the bigger picture?`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, botResponse]);
        }, delay);
      });
    } else {
      const socketClient = socketClientRef.current;
      const socketDelayWindow = {
        minSeconds: Math.max(1, Math.min(30, chatSettings.minResponseDelaySeconds)),
        maxSeconds: Math.max(
          Math.max(1, Math.min(30, chatSettings.minResponseDelaySeconds)),
          Math.min(30, chatSettings.maxResponseDelaySeconds)
        ),
      };

      if (socketClient?.isReady()) {
        const sent = socketClient.send({
          action: 'sendmessage',
          tempId: pendingMessageId,
          personaId: activeAgent?.id,
          conversationId: activeAgent?.id,
          message: messageText,
          delayWindow: socketDelayWindow,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          replyToMessageId: quoteId,
          replyPreview: quoteText,
        });

        if (!sent) {
          setChatError('Realtime channel unavailable. Trying fallback send...');
        } else {
          setChatError(null);
          setReplyTarget(null);
          return;
        }
      }

      messageQueueRef.current.push({
        id: pendingMessageId,
        text: messageText,
        replyToMessageId: quoteId,
        replyPreview: quoteText,
      });
      if (!isSendingRef.current) {
        void processMessageQueue();
      }
    }
    setReplyTarget(null);
  };

  const currentChatMessages = activeSpace 
    ? messages.filter(m => m.spaceId === activeSpace.id)
    : activeAgent
      ? messages.filter(m => m.agentId === activeAgent.id && !m.spaceId && !deletedIdsRef.current.has(m.id))
      : [];

  const handleMsgSearch = (query: string) => {
    setMsgSearchQuery(query);
    if (!query.trim()) {
      setMsgSearchResults([]);
      setCurrentMsgResultIndex(-1);
      return;
    }

    const results: number[] = [];
    currentChatMessages.forEach((msg, idx) => {
      if (msg.text.toLowerCase().includes(query.toLowerCase())) {
        results.push(idx);
      }
    });

    setMsgSearchResults(results);
    setCurrentMsgResultIndex(results.length > 0 ? results.length - 1 : -1);
  };

  const navigateSearch = (direction: 'up' | 'down') => {
    if (msgSearchResults.length === 0) return;
    
    let newIndex = currentMsgResultIndex;
    if (direction === 'up') {
      newIndex = currentMsgResultIndex > 0 ? currentMsgResultIndex - 1 : msgSearchResults.length - 1;
    } else {
      newIndex = currentMsgResultIndex < msgSearchResults.length - 1 ? currentMsgResultIndex + 1 : 0;
    }
    
    setCurrentMsgResultIndex(newIndex);
    
    // Scroll to the message
    const msgIndex = msgSearchResults[newIndex];
    const msgElement = document.getElementById(`msg-${currentChatMessages[msgIndex].id}`);
    if (msgElement) {
      msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // "Delete for me" — remove from local state AND add to blacklist so polling doesn't restore it
  const handleDeleteForMe = useCallback((msgId: string) => {
    deletedIdsRef.current.add(msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setContextMenu(null);
  }, []);

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // Spontaneous message timer — persona randomly reaches out
  useEffect(() => {
    if (!activeAgent || activeSpace) return;

    function scheduleSpontaneous() {
      const clampedMin = Math.max(20, Math.min(300, chatSettings.minResponseDelaySeconds * 15));
      const clampedMax = Math.max(clampedMin + 30, Math.min(480, chatSettings.maxResponseDelaySeconds * 22));
      const delay = clampedMin * 1000 + Math.random() * ((clampedMax - clampedMin) * 1000);
      spontaneousTimerRef.current = window.setTimeout(async () => {
        // Only fire if user hasn't been active recently and we're not already sending
        const idleTime = Date.now() - lastUserActivityRef.current;
        if (
          idleTime < clampedMin * 1000 ||
          isSendingRef.current ||
          typingAgentsRef.current.length > 0 ||
          currentChatMessages.length < 4
        ) {
          scheduleSpontaneous(); // reschedule
          return;
        }

        try {
          const socketClient = socketClientRef.current;
          if (socketClient?.isReady()) {
            socketClient.send({
              action: 'sendmessage',
              personaId: activeAgent.id,
              conversationId: activeAgent.id,
              message: '',
              spontaneous: true,
              delayWindow: {
                minSeconds: Math.max(1, Math.min(30, chatSettings.minResponseDelaySeconds)),
                maxSeconds: Math.max(1, Math.min(30, chatSettings.maxResponseDelaySeconds)),
              },
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
          } else {
            const response = await sendChatMessage({
              personaId: activeAgent.id,
              conversationId: activeAgent.id,
              message: '',
              spontaneous: true,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
            pendingAssistantIdRef.current =
              response.assistantMessages?.[response.assistantMessages.length - 1]?.messageId ||
              response.assistantMessage?.messageId ||
              null;
            await deliverAssistantResponse(response, activeAgent);
          }
        } catch (_err) {
          // Silently fail — spontaneous messages are optional
        } finally {
          pendingAssistantIdRef.current = null;
          setTypingAgents([]);
          lastUserActivityRef.current = Date.now();
          scheduleSpontaneous(); // schedule next one
        }
      }, delay);
    }

    scheduleSpontaneous();

    return () => {
      if (spontaneousTimerRef.current) {
        window.clearTimeout(spontaneousTimerRef.current);
      }
    };
  }, [activeAgent?.id, activeSpace, chatSettings.maxResponseDelaySeconds, chatSettings.minResponseDelaySeconds, currentChatMessages.length, deliverAssistantResponse]);

  if (!activeSpace && !activeAgent) {
    return (
      <div className={cn("flex h-full items-center justify-center px-8 transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a]" : "bg-[#FAFAFE]")}>
        <div className={cn("max-w-md rounded-[32px] border px-8 py-10 text-center shadow-[0_30px_80px_-50px_rgba(24,39,75,0.45)] transition-colors duration-300", theme === 'dark' ? "border-[#222e35] bg-[#111b21]" : "border-[#ECECF2] bg-white")}>
          <h2 className={cn("text-[28px] font-serif font-black tracking-tight", theme === 'dark' ? "text-[#e9edf0]" : "text-black")}>No persona selected</h2>
          <p className={cn("mt-3 text-[14px] leading-7", theme === 'dark' ? "text-[#8696a0]" : "text-[#667085]")}>
            Create a persona or choose one from the dashboard to start a persistent conversation with memory-aware replies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full w-full overflow-hidden font-sans transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a] text-[#e9edf0]" : "bg-[#f0f2f5] text-[#111111]")}>
      {/* Sidebar - Resizable (and Mobile List) */}
      <aside 
        style={{ width: isMobile ? '100%' : sidebarWidth }}
        className={cn(
          "flex-shrink-0 flex flex-col h-full relative z-20 overflow-hidden transition-all duration-300",
          theme === 'dark' ? "border-r border-[#222e35] bg-[#111b21]" : "border-r border-[#eeeeee] bg-white",
          isMobile ? (showChatListOnMobile ? "flex" : "hidden") : "flex"
        )}
      >
        <div className={cn("p-6 pb-2 shrink-0 transition-colors duration-300", theme === 'dark' ? "bg-[#111b21]" : "bg-white")}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[26px] font-black italic tracking-tighter text-primary">
              Chats.
            </h2>
            <div className="flex items-center gap-2">
              {isMobile && onBack && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onBack} 
                  className={cn(
                    "rounded-xl w-10 h-10 shrink-0", 
                     theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] hover:bg-[#2a3942]" : "bg-[#e9edef] text-[#111111] hover:bg-[#d9dbde]"
                  )}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
          <div className="relative group mb-2">
            <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors", theme === 'dark' ? "text-[#8696a0] group-focus-within:text-primary" : "text-[#6b7280]/30 group-focus-within:text-primary")} />
            <input 
              placeholder="Search conversations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("w-full pl-11 pr-5 py-3 border border-transparent rounded-xl text-[13px] font-medium transition-all font-sans", theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] placeholder:text-[#8696a0] focus:outline-none focus:bg-[#2a3942] focus:border-primary/20" : "bg-[#f7f7f8] text-[#111111] placeholder:text-[#6b7280]/40 focus:outline-none focus:bg-white focus:border-primary/20")}
            />
          </div>
        </div>
        
        <div className={cn("flex-1 overflow-y-auto no-scrollbar px-3 py-2 transition-colors duration-300", theme === 'dark' ? "bg-[#111b21]" : "bg-white")}>
          <div className="space-y-6">
            {/* Pinned Section */}
            {agents.some(a => a.isPinned && !a.isArchived) && (
              <div className="space-y-2">
                <div className={cn("px-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] mb-2", theme === 'dark' ? "text-[#8696a0]/60" : "text-[#6b7280]/40")}>
                  <span>Pinned</span>
                  <Pin className="w-3 h-3" />
                </div>
                <AnimatePresence mode="popLayout">
                  {filteredAgents.filter(a => a.isPinned && !a.isArchived).map((agent) => (
                    <ChatListItem 
                      key={agent.id} 
                      agent={agent} 
                      isActive={agent.id === activeAgentId}
                      onSelect={() => onAgentSelect(agent.id)}
                      onPin={(e) => handlePin(agent.id, e)}
                      onArchive={(e) => handleArchive(agent.id, e)}
                      onDelete={(e) => handleDelete(agent.id, e)}
                      onPreview={() => setPreviewImage(agent.avatar)}
                      theme={theme}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Active Section */}
            <div className="space-y-2">
              <div className={cn("px-4 text-[10px] font-black uppercase tracking-[0.2em] mb-2", theme === 'dark' ? "text-[#8696a0]/60" : "text-[#6b7280]/40")}>
                Active Chats
              </div>
              <AnimatePresence mode="popLayout">
                {filteredAgents.filter(a => !a.isPinned && !a.isArchived).map((agent) => (
                  <ChatListItem 
                    key={agent.id} 
                    agent={agent} 
                    isActive={agent.id === activeAgentId}
                    onSelect={() => onAgentSelect(agent.id)}
                    onPin={(e) => handlePin(agent.id, e)}
                    onArchive={(e) => handleArchive(agent.id, e)}
                    onDelete={(e) => handleDelete(agent.id, e)}
                    onPreview={() => setPreviewImage(agent.avatar)}
                    theme={theme}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Archived Section Toggle */}
            <div className={cn("space-y-2 pt-2 border-t", theme === 'dark' ? "border-[#222e35]" : "border-[#F0F0F0]")}>
              <button 
                onClick={() => setShowArchived(!showArchived)}
                className={cn("w-full px-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] transition-colors", theme === 'dark' ? "text-[#8696a0]/60 hover:text-primary" : "text-[#6b7280]/40 hover:text-primary")}
              >
                <span>Archived ({agents.filter(a => a.isArchived).length})</span>
                {showArchived ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              
              <AnimatePresence mode="popLayout">
                {showArchived && agents.some(a => a.isArchived) && (
                  <div className="space-y-1">
                    {filteredAgents.filter(a => a.isArchived).map((agent) => (
                      <ChatListItem 
                        key={agent.id} 
                        agent={agent} 
                        isActive={agent.id === activeAgentId}
                        onSelect={() => onAgentSelect(agent.id)}
                        onPin={(e) => handlePin(agent.id, e)}
                        onArchive={(e) => handleArchive(agent.id, e)}
                        onDelete={(e) => handleDelete(agent.id, e)}
                        onPreview={() => setPreviewImage(agent.avatar)}
                        theme={theme}
                      />
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </aside>

      {/* Resize Handle - Desktop Only */}
      {!isMobile && (
        <div 
          onMouseDown={startResizing}
          className={cn(
            "w-1 hover:w-1.5 transition-all cursor-col-resize z-50",
            theme === 'dark' ? "bg-[#222e35] hover:bg-primary/30" : "bg-[#eeeeee] hover:bg-primary/30",
            isResizing && "w-1.5 bg-primary/50"
          )}
        />
      )}

      {/* Main Chat Area */}
      <main className={cn(
        "flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-500",
        theme === 'dark' ? "bg-[#0b141a]" : "bg-[#efeae2]",
        isMobile && showChatListOnMobile ? "hidden" : "flex"
      )}>
        {/* Dynamic Background */}
        <div 
          className={cn("absolute inset-0 z-0 transition-all duration-1000", theme === 'dark' ? "opacity-5" : "opacity-25")}
          style={{ background: currentTheme.gradient }}
        />
        
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              x: [0, 50, 0],
              y: [0, -30, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className={cn("absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[100px]", theme === 'dark' ? "opacity-15" : "opacity-20")}
            style={{ backgroundColor: currentTheme.primary }}
          />
          <motion.div 
            animate={{ 
              scale: [1.2, 1, 1.2],
              x: [0, -50, 0],
              y: [0, 30, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className={cn("absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]", theme === 'dark' ? "opacity-15" : "opacity-20")}
            style={{ backgroundColor: currentTheme.secondary }}
          />
        </div>

        {/* Chat Header - Fixed */}
        <header className={cn(
          "h-[70px] sm:h-[80px] px-4 sm:px-6 border-b flex items-center justify-between shrink-0 backdrop-blur-xl transition-all sticky top-0 transition-colors duration-300",
          theme === 'dark' ? "bg-[#111b21]/95 border-[#222e35] text-[#e9edf0]" : "bg-[#f0f2f5]/95 border-[#e9edef] text-[#111111]",
          showThemePanel ? "z-50" : "z-10"
        )}>
          <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack}
              className={cn("lg:hidden rounded-xl shrink-0", theme === 'dark' ? "bg-[#202c33] hover:bg-[#2a3942] text-[#e9edf0]" : "bg-[#e9edef] hover:bg-[#d9dbde] text-[#111111]")}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <div className="relative group cursor-pointer shrink-0" onClick={() => setShowInfo(true)}>
              {activeSpace ? (
                <div className="flex -space-x-3">
                  {agents.filter(a => activeSpace.agents.includes(a.id)).slice(0, 3).map((a, i) => (
                    <Avatar 
                      key={a.id}
                      className={cn("w-10 h-10 sm:w-11 sm:h-11 border-[2.5px] shadow-md ring-1 ring-black/[0.03] shrink-0", theme === 'dark' ? "border-[#111b21]" : "border-white")}
                      style={{ zIndex: 3 - i }}
                    >
                      <AvatarImage src={a.avatar} className="object-cover" />
                      <AvatarFallback className="bg-muted text-[10px]">{a.name[0]}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Avatar 
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(activeAgent.avatar);
                      }}
                      className={cn("w-10 h-10 sm:w-11 sm:h-11 border-[2.5px] shadow-md transition-transform hover:scale-105 cursor-zoom-in ring-1 ring-black/[0.03]", theme === 'dark' ? "border-[#111b21]" : "border-white")}
                    >
                      <AvatarImage src={activeAgent.avatar} className="object-cover" />
                      <AvatarFallback className={cn("font-black text-white", theme === 'dark' ? "bg-[#2a3942]" : "bg-[#6B7280]")}>{activeAgent.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5">
                      {activeAgent.status === 'online' ? (
                        <motion.div 
                          animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }} 
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className={cn(
                            "w-3.5 h-3.5 rounded-full border-[2.5px] bg-[#10B981] shadow-lg",
                            theme === 'dark' ? "border-[#111b21]" : "border-white"
                          )} 
                        />
                      ) : (
                        <div className={cn(
                          "w-3.5 h-3.5 rounded-full border-[2.5px] shadow-sm",
                          theme === 'dark' ? "border-[#111b21]" : "border-white",
                          activeAgent.status === 'busy' ? "bg-amber-500" :
                          activeAgent.status === 'sleeping' ? "bg-blue-400" :
                          "bg-gray-500"
                        )} />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col min-w-0 cursor-pointer" onClick={() => setShowInfo(true)}>
              <div className="flex items-center gap-2">
                <h2 className={cn("text-[15px] sm:text-[17px] font-black truncate font-sans tracking-tight", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>
                  {activeSpace ? activeSpace.name : activeAgent.name}
                </h2>
                {activeSpace && <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />}
              </div>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <p className={cn("text-[10px] sm:text-[11px] font-bold -mt-0.5 font-sans truncate tracking-wide", theme === 'dark' ? "text-[#8696a0]" : "text-[#6B7280]/60")}>
                  {activeSpace ? `${activeSpace.memberCount} members` : (
                    <span className="flex items-center gap-1.5">
                      {activeAgent.status === 'online' ? 'Always listening' : activeAgent.status}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowHeaderSearch(!showHeaderSearch)}
              className={cn(
                "w-10 h-10 rounded-xl transition-all",
                theme === 'dark' 
                  ? (showHeaderSearch ? "bg-[#202c33] text-primary" : "text-[#8696a0] hover:bg-[#202c33]") 
                  : (showHeaderSearch ? "bg-[#e9edef] text-primary" : "text-[#54656f] hover:bg-[#e9edef]")
              )}
            >
              <Search className="w-5 h-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowThemePanel(!showThemePanel)}
              className={cn(
                "w-10 h-10 rounded-xl transition-all",
                theme === 'dark' 
                  ? (showThemePanel ? "bg-[#202c33] text-primary" : "text-[#8696a0] hover:bg-[#202c33]") 
                  : (showThemePanel ? "bg-[#e9edef] text-primary" : "text-[#54656f] hover:bg-[#e9edef]")
              )}
            >
              <Palette className="w-5 h-5" />
            </Button>

            <AnimatePresence>
              {showThemePanel && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[60] bg-black/5 backdrop-blur-[2px]" 
                    onClick={() => setShowThemePanel(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className={cn(
                      "absolute right-4 sm:right-6 top-20 w-[calc(100vw-32px)] sm:w-80 rounded-[28px] sm:rounded-[32px] shadow-2xl border p-4 sm:p-6 z-[70] flex flex-col transition-colors duration-300",
                      theme === 'dark' ? "bg-[#111b21] border-[#222e35] text-[#e9edf0]" : "bg-white border-[#F0E7FF]/50 text-[#111111]"
                    )}
                    style={{ maxHeight: 'calc(100vh - 120px)' }}
                  >
                    <div className="flex items-center justify-between mb-4 sm:mb-5 shrink-0">
                      <h4 className={cn("text-[11px] sm:text-[13px] font-black uppercase tracking-[0.2em] font-sans", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>Chat Themes</h4>
                      <button onClick={() => setShowThemePanel(false)} className={cn("p-1 transition-colors", theme === 'dark' ? "text-[#8696a0] hover:text-white" : "text-[#6B7280] hover:text-[#FF2E93]")}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 overflow-y-auto no-scrollbar pr-1 py-1">
                      {APP_THEMES.map((themePreset) => (
                        <motion.button
                          key={themePreset.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomThemes(prev => ({ ...prev, [activeAgent.id]: themePreset }));
                            setShowThemePanel(false);
                          }}
                          className="group flex flex-col text-left transition-all"
                        >
                          <div 
                            className={cn(
                              "w-full h-10 sm:h-16 rounded-xl sm:rounded-2xl mb-1 sm:mb-2.5 shadow-sm overflow-hidden border-2 transition-all duration-300",
                              currentTheme.id === themePreset.id 
                                ? "border-primary scale-105" 
                                : (theme === 'dark' ? "border-[#202c33] group-hover:border-[#222e35]" : "border-white group-hover:border-[#F0E7FF]")
                            )}
                            style={{ background: themePreset.gradient }}
                          />
                          <p className={cn("text-[9px] sm:text-[11px] font-black font-sans px-1 truncate", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>{themePreset.name}</p>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <Button variant="ghost" size="icon" className={cn("hidden sm:flex w-10 h-10 rounded-xl", theme === 'dark' ? "text-[#8696a0] hover:bg-[#202c33]" : "text-[#54656f] hover:bg-[#e9edef]")}>
              <Phone className="w-5 h-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowInfo(!showInfo)}
              className={cn(
                "w-10 h-10 rounded-xl transition-all",
                showInfo 
                  ? "bg-primary text-white shadow-lg" 
                  : (theme === 'dark' ? "text-[#8696a0] hover:bg-[#202c33]" : "text-[#54656f] hover:bg-[#e9edef]")
              )}
            >
              <Info className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Inline Header Search - Slide down */}
        <AnimatePresence>
          {showHeaderSearch && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={cn("border-b px-6 py-3.5 overflow-hidden shadow-sm z-20 transition-colors duration-300", theme === 'dark' ? "bg-[#111b21] border-[#222e35]" : "bg-[#f0f2f5] border-[#e9edef]")}
            >
              <div className="relative max-w-2xl mx-auto flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]")} />
                  <input 
                    autoFocus
                    placeholder="Search messages..." 
                    value={msgSearchQuery}
                    onChange={(e) => handleMsgSearch(e.target.value)}
                    className={cn("w-full pl-10 pr-10 py-2.5 border-none rounded-xl text-sm outline-none transition-all font-sans", theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] placeholder:text-[#8696a0] focus:ring-1 focus:ring-primary/20" : "bg-white text-[#111111] placeholder:text-[#6b7280]/60 focus:ring-1 focus:ring-primary/20")}
                  />
                  {msgSearchQuery && (
                    <button 
                      onClick={() => handleMsgSearch('')}
                      className={cn("absolute right-3 top-1/2 -translate-y-1/2 hover:text-[#FF2E93]", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {msgSearchResults.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-[11px] font-bold font-sans", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]")}>
                      {currentMsgResultIndex + 1} of {msgSearchResults.length}
                    </span>
                    <div className={cn("flex rounded-lg overflow-hidden border border-transparent", theme === 'dark' ? "bg-[#202c33]" : "bg-[#F7F7F8] border-[#EEEEEE]")}>
                      <Button variant="ghost" size="icon" className={cn("h-8 w-8", theme === 'dark' ? "hover:bg-[#2a3942]" : "bg-white hover:bg-[#f0f2f5] border-r border-[#eeeeee]")} onClick={() => navigateSearch('up')}>
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className={cn("h-8 w-8", theme === 'dark' ? "hover:bg-[#2a3942]" : "bg-white hover:bg-[#f0f2f5]")} onClick={() => navigateSearch('down')}>
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div 
          ref={messagesContainerRef}
          className={cn("relative z-10 flex-1 overflow-y-auto px-4 custom-scrollbar transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a]" : "bg-[#efeae2]")}
        >
          <div className="mx-auto flex max-w-4xl flex-col px-2 py-7 pb-8 sm:pb-10">
            {chatError && (
              <div className={cn("rounded-2xl border px-4 py-3 text-[12px]", theme === 'dark' ? "border-red-900 bg-red-950/20 text-red-400" : "border-[#F3D7DA] bg-[#FFF7F7] text-[#8E4047]")}>
                {chatError}
              </div>
            )}

            {isHistoryLoading && (
              <div className={cn("rounded-2xl border px-4 py-3 text-[12px] shadow-sm", theme === 'dark' ? "border-[#222e35] bg-[#111b21] text-[#8696a0]" : "border-[#ECECF2] bg-white/80 text-[#667085]")}>
                Restoring conversation history...
              </div>
            )}

            <AnimatePresence initial={false}>
              {currentChatMessages.length > 0 && (
                <React.Fragment key="chat-message-list">
                  {currentChatMessages.reduce((acc: any[], msg, idx) => {
                    const dateObj = new Date(msg.timestamp);
                    const msgDate = dateObj.toLocaleDateString();
                    const prevMsgDate = idx > 0 ? new Date(currentChatMessages[idx - 1].timestamp).toLocaleDateString() : null;
                    const safeMessageKey =
                      msg.id?.trim() ||
                      `${msg.sender}-${msg.agentId || msg.spaceId || 'chat'}-${dateObj.toISOString()}-${idx}`;
                    const renderKey = `${safeMessageKey}-${idx}`;
                    
                    if (msgDate !== prevMsgDate) {
                      const today = new Date();
                      const yesterday = new Date();
                      yesterday.setDate(today.getDate() - 1);
                      
                      let dateLabel = dateObj.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
                      if (msgDate === today.toLocaleDateString()) dateLabel = "Today";
                      else if (msgDate === yesterday.toLocaleDateString()) dateLabel = "Yesterday";

                      acc.push(
                        <div key={`date-${renderKey}`} className="flex justify-center my-4 sticky top-4 z-10">
                          <span className={cn("px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border font-sans", theme === 'dark' ? "bg-[#1f2c34]/90 border-[#222e35] text-[#8696a0]" : "bg-white/90 border-[#e9edef] text-[#54656f]")}>
                            {dateLabel}
                          </span>
                        </div>
                      );
                    }

                    if (msg.sender === 'system') {
                      acc.push(
                        <div key={renderKey} className="flex justify-center my-3">
                          <span className={cn("px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] text-center border shadow-sm", theme === 'dark' ? "bg-[#182229]/60 border-white/5 text-[#8696a0]/80" : "bg-[#e1f5fe]/80 border-[#b3e5fc]/30 text-[#0288d1]")}>
                            {msg.text}
                          </span>
                        </div>
                      );
                      return acc;
                    }

                    const messageAgent = msg.agentId ? agents.find(a => a.id === msg.agentId) : null;
                    const showAgentInfo = activeSpace && msg.sender === 'agent';
                    const prevMessage = idx > 0 ? currentChatMessages[idx - 1] : null;
                    const nextMessage = idx < currentChatMessages.length - 1 ? currentChatMessages[idx + 1] : null;
                    const isLastFromSender = idx === currentChatMessages.length - 1 || currentChatMessages[idx + 1].sender !== msg.sender;
                    const isConsecutive = idx > 0 && 
                      currentChatMessages[idx - 1].sender === msg.sender &&
                      (new Date(msg.timestamp).getTime() - new Date(currentChatMessages[idx - 1].timestamp).getTime() < 120000); // 2 min threshold
                    const showAgentAvatar = msg.sender === 'agent' && (showAgentInfo || (!activeSpace && isLastFromSender));
                    const renderedText = getFormattedChunkText(msg, nextMessage || undefined);

                    const handleTouchStart = (e: React.TouchEvent) => {
                      const touch = e.touches[0];
                      (e.currentTarget as any)._startX = touch.clientX;
                      (e.currentTarget as any)._startY = touch.clientY;
                    };

                    const handleTouchMove = (e: React.TouchEvent) => {
                      const currentTarget = e.currentTarget as any;
                      if (currentTarget._startX === undefined) return;
                      
                      const touch = e.touches[0];
                      const diffX = touch.clientX - currentTarget._startX;
                      const diffY = touch.clientY - currentTarget._startY;

                      if (diffX > 0 && Math.abs(diffX) > Math.abs(diffY)) {
                        const bubble = currentTarget.querySelector('.swipe-bubble-container');
                        if (bubble) {
                          const translateX = Math.min(60, diffX);
                          bubble.style.transform = `translateX(${translateX}px)`;
                        }
                      }
                    };

                    const handleTouchEnd = (e: React.TouchEvent) => {
                      const currentTarget = e.currentTarget as any;
                      if (currentTarget._startX === undefined) return;

                      const touch = e.changedTouches[0];
                      const diffX = touch.clientX - currentTarget._startX;
                      const diffY = touch.clientY - currentTarget._startY;

                      const bubble = currentTarget.querySelector('.swipe-bubble-container');
                      if (bubble) {
                        bubble.style.transition = 'transform 0.2s ease-out';
                        bubble.style.transform = '';
                        setTimeout(() => {
                          bubble.style.transition = '';
                        }, 200);
                      }

                      if (diffX > 50 && Math.abs(diffX) > Math.abs(diffY)) {
                        setReplyTarget({
                          messageId: msg.id,
                          text: msg.text,
                          senderName: msg.sender === 'user' ? 'You' : (messageAgent?.name || activeAgent?.name || 'Companion')
                        });
                        textareaRef.current?.focus();
                      }

                      delete currentTarget._startX;
                      delete currentTarget._startY;
                    };

                    acc.push(
                      <motion.div
                        key={renderKey}
                        id={`msg-${safeMessageKey}`}
                        initial={{ opacity: 0, y: 15, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className={cn(
                          "flex flex-col group/msg gap-0.5 relative",
                          isConsecutive ? "mt-0.5" : "mt-3",
                          msg.sender === 'user' ? "items-end" : "items-start"
                        )}
                      >
                        <div className={cn(
                          "flex max-w-[88%] items-end gap-2 sm:max-w-[78%] swipe-bubble-container transition-transform duration-100 ease-out",
                          msg.sender === 'user' ? "flex-row-reverse" : "flex-row"
                        )}>
                          {showAgentAvatar && (
                            <Avatar 
                              className={cn("w-8 h-8 sm:w-9 sm:h-9 shrink-0 border shadow-md mb-1 cursor-zoom-in group-hover/msg:scale-105 transition-transform", theme === 'dark' ? "border-[#222e35]" : "border-white")}
                              onClick={() => setPreviewImage(messageAgent?.avatar || null)}
                            >
                              <AvatarImage src={messageAgent?.avatar} className="object-cover" />
                              <AvatarFallback className="text-[10px] font-bold">{messageAgent?.name[0]}</AvatarFallback>
                            </Avatar>
                          )}
                          {!showAgentAvatar && msg.sender === 'agent' && <div className="w-8 sm:w-9 shrink-0" />}
                          <div className={cn("flex flex-col relative", msg.sender === 'user' ? "items-end" : "items-start")}>
                            {showAgentInfo && (
                              <span className="text-[9px] font-black text-[#111111]/30 uppercase tracking-[0.15em] mb-1 ml-1 font-sans">
                                {messageAgent?.name}
                              </span>
                            )}
                            <div
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.id });
                              }}
                              className={cn(
                                "bubble-glow-target cursor-default select-text rounded-[14px] px-3 py-1.5 sm:px-4 sm:py-2 text-[14px] leading-normal font-sans shadow-md relative transition-all duration-300",
                                msg.sender === 'user' 
                                  ? (theme === 'dark' ? "bg-[#005c4b] text-[#e9edf0] rounded-tr-none border-none" : "bg-[#d9fdd3] text-[#111b21] rounded-tr-none border-none")
                                  : (theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] rounded-tl-none border-none" : "bg-white text-[#111b21] rounded-tl-none border border-[#e9edef]/40"),
                                msgSearchQuery && msg.text.toLowerCase().includes(msgSearchQuery.toLowerCase()) && 
                                currentMsgResultIndex !== -1 && currentChatMessages[msgSearchResults[currentMsgResultIndex]].id === msg.id
                                  ? "ring-2 ring-primary/40 scale-[1.02]" 
                                  : ""
                              )}
                            >
                              <div className="flex flex-col min-w-[70px]">
                                {msg.replyToMessageId && (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const targetEl = document.getElementById(`msg-${msg.replyToMessageId}`);
                                      if (targetEl) {
                                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        targetEl.classList.add('animate-highlight-flash');
                                        setTimeout(() => {
                                          targetEl.classList.remove('animate-highlight-flash');
                                        }, 2000);
                                      }
                                    }}
                                    className={cn(
                                      "mb-1.5 rounded-lg p-2 text-[11px] cursor-pointer border-l-4 transition-colors text-left flex flex-col select-none",
                                      msg.sender === 'user'
                                        ? (theme === 'dark' ? "bg-black/20 border-primary text-[#8696a0]" : "bg-black/5 border-primary text-[#667781]")
                                        : (theme === 'dark' ? "bg-white/5 border-primary text-[#8696a0]" : "bg-black/5 border-primary text-[#667781]")
                                    )}
                                  >
                                    <span className="font-bold text-[10px] mb-0.5 text-primary">
                                      {(() => {
                                        const quotedMsg = messages.find(m => m.id === msg.replyToMessageId);
                                        if (quotedMsg) {
                                          return quotedMsg.sender === 'user' ? 'You' : (messageAgent?.name || activeAgent?.name || 'Companion');
                                        }
                                        return 'Message';
                                      })()}
                                    </span>
                                    <span className="truncate max-w-[200px] sm:max-w-[280px]">
                                      {msg.replyPreview || 'Quoted message'}
                                    </span>
                                  </div>
                                )}
                                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-0.5">
                                  <span className="text-[14px] leading-relaxed break-words whitespace-pre-wrap flex-1 select-text">
                                    {msgSearchQuery ? (
                                      renderedText.split(new RegExp(`(${msgSearchQuery})`, 'gi')).map((part, i) => 
                                        part.toLowerCase() === msgSearchQuery.toLowerCase() ? (
                                          <span 
                                            key={i} 
                                            className={cn(
                                              "rounded-sm px-0.5 font-black",
                                              theme === 'dark' ? "bg-yellow-500/30 text-white" : "bg-yellow-200 text-[#111111]"
                                            )}
                                          >
                                            {part}
                                          </span>
                                        ) : part
                                      )
                                    ) : renderedText}
                                  </span>
                                  <span className={cn("text-[9px] font-medium font-sans mt-1.5 self-end shrink-0 leading-none select-none flex items-center gap-1", theme === 'dark' ? "text-[#8696a0]/70" : "text-[#667781]")}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {msg.sender === 'user' && (
                                      <span className="inline-flex shrink-0">
                                        {msg.status === 'sending' && (
                                          <Clock className="w-3 h-3 animate-spin text-[#9CA3AF]" />
                                        )}
                                        {msg.status === 'sent' && (
                                          <Check className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                        )}
                                        {msg.status === 'delivered' && (
                                          <div className="flex -space-x-1.5">
                                            <Check className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                            <Check className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                          </div>
                                        )}
                                        {msg.status === 'seen' && (
                                          <div className="flex -space-x-1.5">
                                            <Check className="w-3.5 h-3.5 text-primary" />
                                            <Check className="w-3.5 h-3.5 text-primary" />
                                          </div>
                                        )}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Delete-for-me hover button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.id });
                              }}
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200 w-7 h-7 rounded-full backdrop-blur-sm shadow-md border flex items-center justify-center text-[#9CA3AF] z-10",
                                theme === 'dark' 
                                  ? "bg-[#202c33]/90 border-[#303f47] hover:bg-[#2a3942] hover:text-white" 
                                  : "bg-white/90 border-[#EEEEEE] hover:bg-[#F7F7F8] hover:text-[#111111]",
                                msg.sender === 'user' ? "-left-9" : "-right-9"
                              )}
                              title="Options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Reply hover button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplyTarget({
                                  messageId: msg.id,
                                  text: msg.text,
                                  senderName: msg.sender === 'user' ? 'You' : (messageAgent?.name || activeAgent?.name || 'Companion')
                                });
                                textareaRef.current?.focus();
                              }}
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200 w-7 h-7 rounded-full backdrop-blur-sm shadow-md border flex items-center justify-center text-[#9CA3AF] z-10",
                                theme === 'dark' 
                                  ? "bg-[#202c33]/90 border-[#303f47] hover:bg-[#2a3942] hover:text-white" 
                                  : "bg-white/90 border-[#EEEEEE] hover:bg-[#F7F7F8] hover:text-[#111111]",
                                msg.sender === 'user' ? "-left-18" : "-right-18"
                              )}
                              title="Reply"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                    return acc;
                  }, [])}
                </React.Fragment>
              )}

              {!isHistoryLoading && currentChatMessages.length === 0 && !typingAgents.length && (
                <motion.div
                  key="chat-empty-state"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("mx-auto max-w-xl rounded-[28px] border px-8 py-10 text-center shadow-[0_25px_60px_-44px_rgba(24,39,75,0.45)] transition-colors duration-300", theme === 'dark' ? "border-[#222e35] bg-[#111b21]" : "border-[#ECECF2] bg-white/80")}
                >
                  <h3 className={cn("text-[20px] font-serif font-black tracking-tight", theme === 'dark' ? "text-[#e9edf0]" : "text-black")}>
                    Start the first real conversation
                  </h3>
                  <p className={cn("mt-3 text-[13px] leading-7", theme === 'dark' ? "text-[#8696a0]" : "text-[#667085]")}>
                    Revia will load persona traits, recent chat context, and lightweight memories before generating each reply.
                  </p>
                </motion.div>
              )}
              
              {typingAgents.length > 0 && (
                <motion.div
                  key="chat-typing-state"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex items-start gap-3 mt-3 ml-10"
                >
                  {activeAgent && (
                    <Avatar className={cn("w-8 h-8 shrink-0 border shadow-md", theme === 'dark' ? "border-[#222e35]" : "border-white")}>
                      <AvatarImage src={activeAgent.avatar} className="object-cover" />
                      <AvatarFallback className="text-[10px] font-bold">{activeAgent.name[0]}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={cn("px-4 py-2 rounded-[14px] rounded-tl-none shadow-md flex items-center gap-3", theme === 'dark' ? "bg-[#202c33]" : "bg-white border border-[#e9edef]")}>
                    <span className={cn("text-[13px] font-medium font-sans", theme === 'dark' ? "text-[#8696a0]" : "text-[#54656f]")}>
                      {activeAgent?.name} is typing
                    </span>
                    <div className="flex gap-1 pt-0.5">
                      {[0, 1, 2].map(i => (
                        <motion.div 
                          key={i}
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} 
                          transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }} 
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: currentTheme.primary }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} className="h-4 sm:h-6" />
          </div>
        </div>

        {/* Flat Bottom Input Bar - Matches Spaces.tsx */}
        <footer className={cn(
          "px-4 sm:px-8 py-3 sm:py-4 shrink-0 z-20 relative border-t transition-colors duration-300",
          theme === 'dark' ? "bg-[#0b141a] border-[#222e35]" : "bg-[#f0f2f5] border-[#e9edef]"
        )}>
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={cn("absolute bottom-full left-4 z-50 mb-4 overflow-hidden rounded-[28px] border shadow-2xl sm:left-8 sm:rounded-3xl", theme === 'dark' ? "border-[#222e35] bg-[#111b21]" : "border-[#F0E7FF]/50 bg-white")}
              >
                <EmojiPicker 
                  onEmojiClick={onEmojiClick} 
                  theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                  width={window.innerWidth < 640 ? window.innerWidth - 32 : 320}
                  height={window.innerWidth < 640 ? 250 : 380}
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                  searchDisabled={true}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {replyTarget && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: 5 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: 5 }}
                className={cn(
                  "w-full max-w-5xl mx-auto mb-2 rounded-2xl p-3 flex items-center justify-between border-l-4 shadow-sm z-10 relative overflow-hidden transition-colors duration-300",
                  theme === 'dark' ? "bg-[#202c33] border-primary text-[#e9edf0]" : "bg-white border-primary text-[#111111]"
                )}
              >
                <div className="flex flex-col text-left flex-1 min-w-0 pr-4">
                  <span className="text-[11px] font-black uppercase tracking-wider text-primary mb-0.5">
                    Replying to {replyTarget.senderName}
                  </span>
                  <span className="text-[12px] truncate opacity-80">
                    {replyTarget.text}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setReplyTarget(null)}
                  className={cn(
                    "w-7 h-7 rounded-full shrink-0",
                    theme === 'dark' ? "hover:bg-[#2a3942] text-[#8696a0]" : "hover:bg-[#F7F7F8] text-[#6B7280]"
                  )}
                >
                  <X className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <form 
            onSubmit={handleSendMessage}
            className="w-full max-w-5xl mx-auto flex gap-2 sm:gap-3 items-center"
          >
            <div 
              className={cn(
                "flex-1 border rounded-full flex items-center px-3 sm:px-4 min-h-[40px] sm:min-h-[46px] transition-all duration-300 shadow-md group relative",
                theme === 'dark' ? "bg-[#202c33] border-transparent" : "bg-white border-[#e9edef]"
              )}
            >
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={cn(
                  "relative z-10 h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-full transition-all",
                  theme === 'dark' ? "text-[#8696a0] hover:text-[#e9edf0]" : "text-[#54656f] hover:text-[#111111]"
                )}
              >
                <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              
              <textarea 
                ref={textareaRef}
                placeholder="Write your response..." 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any);
                  }
                }}
                rows={1}
                className={cn(
                  "flex-1 border-none bg-transparent focus:outline-none text-[13.5px] font-medium px-2 sm:px-3 font-sans py-2.5 resize-none min-h-[36px] overflow-hidden leading-relaxed relative z-10 scrollbar-none",
                  theme === 'dark' ? "text-[#e9edf0] placeholder:text-[#8696a0]/50" : "text-[#111111] placeholder:text-[#6b7280]/60"
                )}
              />
              
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "relative z-10 h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-full transition-all",
                  theme === 'dark' ? "text-[#8696a0] hover:text-[#e9edf0]" : "text-[#54656f] hover:text-[#111111]"
                )}
              >
                <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>

            <Button 
              type="submit" 
              disabled={!inputText.trim()}
              className="text-white w-[40px] h-[40px] sm:w-[46px] sm:h-[46px] rounded-full flex items-center justify-center p-0 transition-all active:scale-95 disabled:opacity-30 shrink-0 shadow-md relative overflow-hidden group/send"
              style={{ 
                backgroundColor: currentTheme.primary, 
                boxShadow: `0 4px 12px -2px ${currentTheme.primary}40` 
              }}
            >
              <div className="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-500 group-hover/send:translate-y-0" />
              <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5 relative z-10 transition-transform group-hover/send:-rotate-12" />
            </Button>
          </form>
        </footer>

        {/* Info Panel Overlay */}
        <AnimatePresence>
          {showInfo && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowInfo(false)}
                className="absolute inset-0 bg-black/10 backdrop-blur-[2px] z-30 pointer-events-auto"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={cn(
                  "absolute top-0 right-0 h-full w-full sm:w-[380px] z-40 shadow-2xl flex flex-col transition-colors duration-300",
                  theme === 'dark' ? "bg-[#111b21] border-l border-[#222e35] text-[#e9edf0]" : "bg-white border-l border-[#EEEEEE] text-[#111111]"
                )}
              >
                <div className="p-8 pb-4 flex justify-between items-center shrink-0">
                  <h4 className={cn("text-[18px] font-serif font-bold tracking-tight", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>Contact Info</h4>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowInfo(false)} 
                    className={cn("rounded-full", theme === 'dark' ? "hover:bg-[#202c33]" : "hover:bg-secondary")}
                  >
                    <X className="w-5 h-5 font-bold" />
                  </Button>
                </div>

                <div className="flex flex-col items-center text-center p-8 space-y-6 overflow-y-auto no-scrollbar flex-1">
                  <div className="relative mb-2 shrink-0">
                    <Avatar 
                      onClick={() => setPreviewImage(activeAgent.avatar)}
                      className={cn("w-44 h-44 shadow-xl cursor-zoom-in group border-4", theme === 'dark' ? "border-[#202c33]" : "border-[#F7F7F8]")}
                    >
                      <AvatarImage src={activeAgent.avatar} className="object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                        <Search className="text-white opacity-0 group-hover:opacity-100 w-8 h-8 transition-opacity" />
                      </div>
                    </Avatar>
                    <div className={cn(
                      "absolute -bottom-2 left-1/2 -translate-x-1/2 text-white px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg border-2 font-sans",
                      theme === 'dark' ? "border-[#111b21]" : "border-white",
                      activeAgent.status === 'online' ? "bg-green-500" :
                      activeAgent.status === 'busy' ? "bg-amber-500" :
                      activeAgent.status === 'sleeping' ? "bg-blue-400" :
                      "bg-gray-400"
                    )}>
                      {activeAgent.status}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h2 className={cn("text-2xl font-serif font-bold", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>{activeAgent.name}</h2>
                    <p className={cn("text-[13px] font-medium italic font-sans px-4", theme === 'dark' ? "text-[#8696a0]" : "text-[#6B7280]")}>"{activeAgent.tagline}"</p>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-3 pt-4 font-sans shrink-0">
                    <div className={cn("p-4 rounded-2xl text-left border", theme === 'dark' ? "bg-[#202c33] border-[#222e35]" : "bg-[#F7F7F8] border-[#EEEEEE]")}>
                       <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", theme === 'dark' ? "text-[#8696a0]" : "text-[#6B7280]/60")}>Trait</p>
                       <p className={cn("text-[13px] font-black", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>Empathetic</p>
                    </div>
                    <div className={cn("p-4 rounded-2xl text-left border", theme === 'dark' ? "bg-[#202c33] border-[#222e35]" : "bg-[#F7F7F8] border-[#EEEEEE]")}>
                       <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", theme === 'dark' ? "text-[#8696a0]" : "text-[#6B7280]/60")}>Gender</p>
                       <p className={cn("text-[13px] font-black capitalize", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>{activeAgent.gender}</p>
                    </div>
                  </div>

                  <div className={cn("w-full text-left p-5 rounded-3xl border", theme === 'dark' ? "bg-[#202c33]/5 border-white/5" : "bg-[#FF2E93]/5 border-[#FF2E93]/10")}>
                     <p className="text-[13px] font-medium text-primary leading-relaxed italic font-sans">
                       {activeAgent.personality}
                     </p>
                  </div>

                  <div className="w-full pt-4 space-y-3 shrink-0">
                     <Button className={cn("w-full h-14 rounded-2xl text-[13px] font-bold transition-all shadow-lg font-sans", theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] hover:bg-primary hover:text-white" : "bg-[#111111] text-white hover:bg-[#FF2E93]")}>Archive Connection</Button>
                     <Button variant="ghost" className="w-full h-14 rounded-2xl text-[13px] font-bold text-[#ef4444] hover:bg-red-50 font-sans">Report Companion</Button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Image Preview Modal */}
        <AnimatePresence>
          {previewImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-10"
              onClick={() => setPreviewImage(null)}
            >
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-6 right-6 text-white hover:bg-white/10 rounded-full z-[110]"
                onClick={() => setPreviewImage(null)}
              >
                <X className="w-8 h-8" />
              </Button>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25 }}
                className="relative max-w-full max-h-full"
                onClick={(e) => e.stopPropagation()}
              >
                <img 
                  src={previewImage} 
                  alt="Preview" 
                  className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Floating Context Menu for Delete-for-me */}
        <AnimatePresence>
          {contextMenu && (
            <>
              <div className="fixed inset-0 z-[190]" onClick={() => setContextMenu(null)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "fixed z-[200] min-w-[180px] rounded-2xl shadow-2xl border py-2 overflow-hidden",
                  theme === 'dark' ? "bg-[#202c33] border-[#222e35] text-[#e9edf0]" : "bg-white border-[#EEEEEE] text-[#111111]"
                )}
                style={{ top: contextMenu.y, left: contextMenu.x }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    handleDeleteForMe(contextMenu.msgId);
                    setContextMenu(null);
                  }}
                  className={cn("w-full flex items-center gap-3 px-4 py-3 text-[13px] font-semibold transition-colors font-sans", theme === 'dark' ? "hover:bg-[#2a3942] text-red-400" : "hover:bg-red-50 text-red-500")}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete for me
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
