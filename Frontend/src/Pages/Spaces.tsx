import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Agent, Space, SpaceMessage } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Plus, Search, Send, Paperclip, Smile, MoreVertical, Sun, Moon,
  Info, Phone, ChevronLeft, LayoutGrid, Users, Zap, X, Loader2, CheckCircle2,
  ChevronUp, ChevronDown, Trash2, Edit, Sparkles, MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { listSpaces, createSpace, updateSpace, deleteSpace, listSpaceMessages } from '../services/spacesService';
import { ChatSocketClient } from '../services/chatSocket';
import { SPACE_THEME_PRESETS } from '../constants';

interface SpacesProps {
  onNavigateToChat: (id: string, spaceId?: string) => void;
  agents: Agent[];
  activeSpaceId?: string | null;
  onBack?: () => void;
  theme: 'light' | 'dark';
}

interface SpaceListItemProps {
  space: Space;
  isActive: boolean;
  onSelect: () => void;
  unreadCount?: number;
  isTyping?: boolean;
  typingText?: string;
  agents: Agent[];
  theme: 'light' | 'dark';
}

const SpaceListItem: React.FC<SpaceListItemProps> = ({ 
  space, 
  isActive, 
  onSelect, 
  unreadCount = 0, 
  isTyping = false, 
  typingText = '',
  agents,
  theme
}) => {
  const displayTime = space.lastMessageAt 
    ? new Date(space.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 text-left relative group cursor-pointer border border-transparent",
        isActive 
          ? (theme === 'dark' 
              ? "bg-[#2a3942] shadow-[0_4px_12px_rgba(0,0,0,0.2)] ring-1 ring-white/10" 
              : "bg-white shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] ring-1 ring-[#F0E7FF]")
          : (theme === 'dark' 
              ? "hover:bg-[#202c33]/80 text-[#e9edf0]" 
              : "hover:bg-[#f7f7f8]/80 text-[#111111]")
      )}
    >
      <div className="relative shrink-0">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md transform transition-transform duration-300 group-hover:scale-105" 
          style={{ background: space.theme.gradient || 'linear-gradient(135deg, #FF2E93 0%, #D41B72 100%)' }}
        >
          {space.name[0]}
        </div>
        <div className="absolute -bottom-1 -right-1">
          <motion.div 
            animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className={cn(
              "w-3.5 h-3.5 rounded-full border-2 bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.4)]",
              theme === 'dark' ? "border-[#111b21]" : "border-white"
            )}
          />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className={cn(
            "text-[14px] font-black truncate transition-colors font-sans tracking-tight",
            theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]"
          )}>
            {space.name}
          </h3>
          {displayTime && (
            <span className={cn(
              "text-[10px] font-bold font-sans uppercase tracking-wider",
              theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]/50"
            )}>
              {displayTime}
            </span>
          )}
        </div>
        
        {isTyping ? (
          <p className="text-[12px] font-black text-primary truncate font-sans animate-pulse">
            {typingText}
          </p>
        ) : (
          <p className={cn(
            "text-[12px] font-medium truncate font-sans italic opacity-85 leading-tight pr-4",
            theme === 'dark' ? "text-[#8696a0]/85" : "text-[#6b7280]"
          )}>
            {space.lastMessagePreview || space.description}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0 ml-1">
        {unreadCount > 0 && (
          <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(255,46,147,0.4)]">
            {unreadCount}
          </span>
        )}
        {isActive && (
          <motion.div 
            layoutId="active-indicator"
            className="w-2 h-2 rounded-full bg-[#FF2E93] shadow-[0_0_8px_rgba(255,46,147,0.4)]" 
          />
        )}
      </div>
    </motion.div>
  );
};

export default function Spaces({ onNavigateToChat, agents, activeSpaceId: activeSpaceIdProp, onBack, theme }: SpacesProps) {
  const [localSpaces, setLocalSpaces] = useState<Space[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(activeSpaceIdProp || null);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<SpaceMessage[]>([]);
  const [typingAgents, setTypingAgents] = useState<string[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showHeaderSearch, setShowHeaderSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [msgSearchResults, setMsgSearchResults] = useState<number[]>([]);
  const [currentMsgResultIndex, setCurrentMsgResultIndex] = useState(-1);
  const [sidebarWidth, setSidebarWidth] = useState(330);
  const [isResizing, setIsResizing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Custom Space Form State
  const [step, setStep] = useState(1);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [newSpaceVibe, setNewSpaceVibe] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [selectedTheme, setSelectedTheme] = useState(SPACE_THEME_PRESETS[0]);

  // Unread counts state (client-side session persistent)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  const showSpaceListOnMobile = isMobile && !activeSpaceId;
  const showSpaceViewOnMobile = isMobile && activeSpaceId;

  const activeSpace = localSpaces.find(s => s.id === activeSpaceId) || null;
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketClientRef = useRef<ChatSocketClient | null>(null);

  // 1. Fetch spaces list on load
  useEffect(() => {
    const fetchSpaces = async () => {
      setLoadingSpaces(true);
      try {
        const spacesData = await listSpaces();
        setLocalSpaces(spacesData);
        if (spacesData.length > 0 && !activeSpaceId) {
          // Default to first space if not provided
          setActiveSpaceId(spacesData[0].id);
        }
      } catch (err) {
        console.error('Failed to list spaces', err);
      } finally {
        setLoadingSpaces(false);
      }
    };
    fetchSpaces();
  }, []);

  // 2. Fetch history and join presence when spaceId changes
  useEffect(() => {
    if (!activeSpaceId) return;

    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const { messages: history } = await listSpaceMessages(activeSpaceId);
        setMessages(history.reverse()); // Chronological ordering
        
        // Reset unread count for current space
        setUnreadCounts(prev => ({ ...prev, [activeSpaceId]: 0 }));
      } catch (err) {
        console.error('Failed to load space messages', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();

    // WebSocket join space
    const client = socketClientRef.current || new ChatSocketClient();
    socketClientRef.current = client;
    client.connect();
    client.joinSpace(activeSpaceId);

    const unsubscribe = client.onEvent((payload) => {
      // If event belongs to another space, update unread count
      if (payload.spaceId && payload.spaceId !== activeSpaceId) {
        if (payload.type === 'space_ai_chunk') {
          setUnreadCounts(prev => ({
            ...prev,
            [payload.spaceId]: (prev[payload.spaceId] || 0) + 1
          }));
        }
        return;
      }

      switch (payload.type) {
        case 'space_message_ack':
          setMessages(prev => {
            const index = prev.findIndex(m => m.id === payload.tempId);
            const msg: SpaceMessage = {
              id: payload.message.messageId,
              spaceId: payload.spaceId,
              senderId: payload.message.senderId,
              senderType: payload.message.senderType,
              senderName: payload.message.senderName,
              text: payload.message.text,
              timestamp: new Date(payload.message.timestamp),
              metadata: payload.message.metadata,
            };
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = msg;
              return updated;
            }
            return [...prev, msg];
          });
          break;

        case 'space_ai_typing':
          setTypingAgents(prev => [...new Set([...prev, payload.personaName])]);
          setActiveSpeaker(payload.personaName);
          break;

        case 'space_ai_chunk':
          setTypingAgents(prev => {
            const persona = agents.find(a => a.id === payload.personaId);
            const name = persona?.name || payload.personaId;
            return prev.filter(n => n !== name);
          });
          setActiveSpeaker(null);
          
          setMessages(prev => {
            // Deduplicate
            if (prev.some(m => m.id === payload.message.messageId)) return prev;

            const msg: SpaceMessage = {
              id: payload.message.messageId,
              spaceId: payload.spaceId,
              senderId: payload.personaId,
              senderType: 'agent',
              senderName: payload.message.senderName,
              text: payload.message.text,
              timestamp: new Date(payload.message.timestamp),
              metadata: payload.message.metadata,
            };
            return [...prev, msg];
          });
          break;

        case 'space_ai_done':
          setTypingAgents(prev => {
            const persona = agents.find(a => a.id === payload.personaId);
            const name = persona?.name || payload.personaId;
            return prev.filter(n => n !== name);
          });
          setActiveSpeaker(null);
          break;

        case 'space_all_done':
          setTypingAgents([]);
          setActiveSpeaker(null);
          break;
      }
    });

    return () => {
      unsubscribe();
      client.leaveSpace();
    };
  }, [activeSpaceId, agents]);

  // Sidebar drag resizer logic
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const stopResizing = () => setIsResizing(false);

  const resize = (e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 250 && newWidth < 500) {
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

  // Auto scroll messages container
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, typingAgents]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeSpaceId) return;

    const tempId = `temp-${Date.now()}`;
    const text = inputText.trim();

    // 1. Optimistic rendering
    const tempMsg: SpaceMessage = {
      id: tempId,
      spaceId: activeSpaceId,
      senderId: 'user',
      senderType: 'user',
      senderName: 'You',
      text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setInputText('');

    // 2. WebSocket send message
    const socket = socketClientRef.current;
    if (socket && socket.isReady()) {
      socket.sendSpaceMessage(activeSpaceId, text, tempId);
    } else {
      console.error('Socket connection is not ready');
    }
  };

  const handleMsgSearch = (query: string) => {
    setMsgSearchQuery(query);
    if (!query.trim() || !activeSpace) {
      setMsgSearchResults([]);
      setCurrentMsgResultIndex(-1);
      return;
    }

    const results: number[] = [];
    messages.forEach((msg, idx) => {
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
    
    const msgIndex = msgSearchResults[newIndex];
    const msgElement = document.getElementById(`msg-${messages[msgIndex].id}`);
    if (msgElement) {
      msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim() || selectedAgentIds.length < 2) return;

    setIsCreating(true);
    try {
      const space = await createSpace({
        name: newSpaceName.trim(),
        description: newSpaceDescription.trim(),
        vibe: newSpaceVibe.trim(),
        agents: selectedAgentIds,
        theme: selectedTheme,
      });

      setLocalSpaces(prev => [space, ...prev]);
      setActiveSpaceId(space.id);
      setCreateSuccess(true);

      setTimeout(() => {
        setIsModalOpen(false);
        setCreateSuccess(false);
        setNewSpaceName('');
        setNewSpaceDescription('');
        setNewSpaceVibe('');
        setSelectedAgentIds([]);
        setSelectedTheme(SPACE_THEME_PRESETS[0]);
        setStep(1);
      }, 1500);
    } catch (err) {
      console.error('Failed to create space', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSpace = async (spaceId: string) => {
    if (!window.confirm('Are you sure you want to delete this custom space?')) return;
    try {
      await deleteSpace(spaceId);
      setLocalSpaces(prev => prev.filter(s => s.id !== spaceId));
      setActiveSpaceId(null);
      setShowInfo(false);
    } catch (err) {
      console.error('Failed to delete space', err);
    }
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId) 
        : [...prev, agentId]
    );
  };

  const filteredSpaces = localSpaces.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn("flex h-full w-full overflow-hidden font-sans transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a] text-[#e9edf0]" : "bg-[#f0f2f5] text-[#111111]")}>
      {/* Sidebar (left panel) */}
      <aside 
        style={{ width: isMobile ? '100%' : sidebarWidth }}
        className={cn(
          "flex-shrink-0 border-r flex flex-col h-full relative z-20 overflow-hidden transition-all duration-300",
          theme === 'dark' ? "border-r border-[#222e35] bg-[#111b21]" : "border-r border-[#eeeeee] bg-white",
          isMobile ? (showSpaceListOnMobile ? "flex" : "hidden") : "flex"
        )}
      >
        <div className={cn("p-6 shrink-0 transition-colors duration-300", theme === 'dark' ? "bg-[#111b21]" : "bg-white")}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[28px] font-black italic tracking-tighter text-primary">
              Spaces.
            </h2>
            <div className="flex items-center gap-2">
              <Dialog open={isModalOpen} onOpenChange={(open) => {
                setIsModalOpen(open);
                if (!open) {
                  setStep(1);
                  setNewSpaceName('');
                  setNewSpaceDescription('');
                  setNewSpaceVibe('');
                  setSelectedAgentIds([]);
                }
              }}>
                <DialogTrigger render={
                  <Button className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-xl text-primary transition-all shadow-sm hover:bg-primary hover:text-white border border-transparent",
                    theme === 'dark' ? "bg-[#202c33]" : "bg-[#f7f7f8] border-[#e9edef]"
                  )}>
                    <Plus className="w-5 h-5" />
                  </Button>
                } />
                <DialogContent className={cn("sm:max-w-[480px] rounded-[32px] border-none shadow-2xl p-8 overflow-hidden max-h-[85vh] flex flex-col transition-colors duration-300", theme === 'dark' ? "bg-[#111b21] text-[#e9edf0]" : "bg-white text-[#111111]")}>
                  <AnimatePresence mode="wait">
                    {!createSuccess ? (
                      <motion.div
                        key="create-steps"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6 flex-1 flex flex-col overflow-hidden"
                      >
                        <DialogHeader>
                          <DialogTitle className={cn("text-2xl font-black tracking-tight flex items-center gap-2", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>
                            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                            Summon Collective (Step {step}/3)
                          </DialogTitle>
                        </DialogHeader>

                        {/* Step 1: Core Details */}
                        {step === 1 && (
                          <div className="space-y-4 py-2">
                            <div className="space-y-2">
                              <label className={cn("text-[11px] font-black uppercase tracking-widest ml-1", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]/60")}>Realm Name</label>
                              <Input 
                                placeholder="e.g. Creative Sanctuary" 
                                value={newSpaceName}
                                onChange={(e) => setNewSpaceName(e.target.value)}
                                className={cn("h-12 rounded-xl border-none focus:ring-2 ring-primary/20", theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] placeholder:text-[#8696a0]" : "bg-[#f7f7f8] text-[#111111] placeholder:text-[#6b7280]/40")}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className={cn("text-[11px] font-black uppercase tracking-widest ml-1", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]/60")}>Description</label>
                              <Input 
                                placeholder="What is this collective focus?" 
                                value={newSpaceDescription}
                                onChange={(e) => setNewSpaceDescription(e.target.value)}
                                className={cn("h-12 rounded-xl border-none focus:ring-2 ring-primary/20", theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] placeholder:text-[#8696a0]" : "bg-[#f7f7f8] text-[#111111] placeholder:text-[#6b7280]/40")}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className={cn("text-[11px] font-black uppercase tracking-widest ml-1", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]/60")}>Group Vibe</label>
                              <Input 
                                placeholder="e.g. playful, philosophical, sarcastic energy" 
                                value={newSpaceVibe}
                                onChange={(e) => setNewSpaceVibe(e.target.value)}
                                className={cn("h-12 rounded-xl border-none focus:ring-2 ring-primary/20", theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] placeholder:text-[#8696a0]" : "bg-[#f7f7f8] text-[#111111] placeholder:text-[#6b7280]/40")}
                              />
                            </div>
                          </div>
                        )}

                        {/* Step 2: Agent Selection Grid */}
                        {step === 2 && (
                          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                            <label className={cn("text-[11px] font-black uppercase tracking-widest ml-1", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]/60")}>Select Agents (min 2, max 8)</label>
                            <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 flex-1 max-h-[300px]">
                              {agents.map((agent) => {
                                const isSelected = selectedAgentIds.includes(agent.id);
                                return (
                                  <div 
                                    key={agent.id}
                                    onClick={() => toggleAgentSelection(agent.id)}
                                    className={cn(
                                      "flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border",
                                      isSelected 
                                        ? "bg-primary/10 border-primary shadow-sm" 
                                        : (theme === 'dark' 
                                            ? "bg-[#202c33] border-transparent hover:bg-[#2a3942]" 
                                            : "bg-white border-gray-100 hover:bg-[#f7f7f8]")
                                    )}
                                  >
                                    <Avatar className="w-8 h-8">
                                      <AvatarImage src={agent.avatar} />
                                      <AvatarFallback className="text-[10px] font-black">{agent.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn("text-[12px] font-black truncate", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>{agent.name}</p>
                                      <p className={cn("text-[9px] truncate uppercase tracking-widest", theme === 'dark' ? "text-[#8696a0]" : "text-gray-400")}>{agent.gender}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Step 3: Preset Gradient Pick & Preview */}
                        {step === 3 && (
                          <div className="space-y-5">
                            <div className="space-y-2">
                              <label className={cn("text-[11px] font-black uppercase tracking-widest ml-1", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]/60")}>Gradient Theme Presets</label>
                              <div className="grid grid-cols-3 gap-2">
                                {SPACE_THEME_PRESETS.map((preset) => {
                                  const isSelected = selectedTheme.name === preset.name;
                                  return (
                                    <button
                                      key={preset.name}
                                      onClick={() => setSelectedTheme(preset)}
                                      className={cn(
                                        "h-10 rounded-xl flex items-center justify-center text-[11px] font-black text-white shadow-sm transition-all border-2",
                                        isSelected ? "border-primary scale-95" : "border-transparent"
                                      )}
                                      style={{ background: preset.gradient }}
                                    >
                                      {preset.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className={cn("border p-4 rounded-3xl space-y-3", theme === 'dark' ? "border-white/5 bg-[#202c33]/50" : "border-gray-100 bg-gray-50/50")}>
                              <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]/60")}>Live Preview</span>
                              <div className={cn("p-4 rounded-2xl border flex items-center gap-4", theme === 'dark' ? "bg-[#202c33] border-white/5" : "bg-white border-gray-100")}>
                                <div 
                                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md"
                                  style={{ background: selectedTheme.gradient }}
                                >
                                  {newSpaceName ? newSpaceName[0] : 'R'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className={cn("text-[14px] font-black truncate", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>
                                    {newSpaceName || 'My New Realm'}
                                  </h4>
                                  <p className={cn("text-[11px] truncate italic", theme === 'dark' ? "text-[#8696a0]" : "text-gray-400")}>
                                    {newSpaceDescription || 'Vibrant multi-agent conversations.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <DialogFooter className="flex flex-row gap-2 justify-end pt-2">
                          {step > 1 && (
                            <Button 
                              variant="ghost" 
                              onClick={() => setStep(prev => prev - 1)}
                              className={cn("rounded-xl border h-12 px-6 font-bold", theme === 'dark' ? "border-white/10 hover:bg-[#202c33] hover:text-[#e9edf0] text-[#e9edf0]" : "border-gray-200 hover:bg-[#f7f7f8] hover:text-[#111111] text-[#6b7280]")}
                            >
                              Back
                            </Button>
                          )}
                          {step < 3 ? (
                            <Button 
                              onClick={() => setStep(prev => prev + 1)}
                              disabled={(step === 1 && !newSpaceName.trim()) || (step === 2 && selectedAgentIds.length < 2)}
                              className="bg-primary hover:bg-primary/90 text-white rounded-xl h-12 px-6 font-bold flex-1"
                            >
                              Continue
                            </Button>
                          ) : (
                            <Button 
                              onClick={handleCreateSpace}
                              disabled={isCreating}
                              className="bg-primary hover:bg-[#D41B72] text-white rounded-xl h-12 px-6 font-bold flex-1"
                            >
                              {isCreating ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  Summoning...
                                </>
                              ) : (
                                'Forging Realm'
                              )}
                            </Button>
                          )}
                        </DialogFooter>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="success-prompt"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-12 text-center"
                      >
                        <div className="w-20 h-20 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-6">
                          <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
                        </div>
                        <h3 className="text-2xl font-black tracking-tight mb-2">Realm Manifested</h3>
                        <p className={theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]"}>Entering the collective resonance...</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </DialogContent>
              </Dialog>

              {isMobile && (
                <Button variant="ghost" size="icon" onClick={onBack} className={cn("w-10 h-10 rounded-xl", theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] hover:bg-[#2a3942]" : "bg-[#f7f7f8] text-[#111111] hover:bg-[#e9edef]")}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>

          <div className="relative group">
            <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors", theme === 'dark' ? "text-[#8696a0] group-focus-within:text-primary" : "text-[#6b7280]/40 group-focus-within:text-primary")} />
            <input 
              placeholder="Search realms..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("w-full pl-11 pr-5 py-3.5 border border-transparent rounded-2xl text-[13.5px] font-medium transition-all font-sans", theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] placeholder:text-[#8696a0] focus:outline-none focus:bg-[#2a3942] focus:border-primary/20" : "bg-[#f7f7f8] text-[#111111] placeholder:text-[#6b7280]/40 focus:outline-none focus:bg-white focus:border-primary/20")}
            />
          </div>
        </div>

        <div className={cn("flex-1 overflow-y-auto no-scrollbar px-3", theme === 'dark' ? "bg-[#111b21]" : "bg-white")}>
          <div className="space-y-3 pb-6">
            <div className={cn("px-5 text-[10px] font-black uppercase tracking-[0.2em] mb-4", theme === 'dark' ? "text-[#8696a0]/60" : "text-[#6b7280]/40")}>
              Manifested Realms
            </div>
            
            {loadingSpaces ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className={cn("text-[12px] font-bold", theme === 'dark' ? "text-[#8696a0]" : "text-gray-400")}>Loading Realms...</span>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredSpaces.map((space) => {
                  const typingInSpace = typingAgents.length > 0 && space.id === activeSpaceId;
                  const typingText = typingAgents.length > 1 
                    ? `${typingAgents.slice(0, 2).join(', ')} typing...`
                    : `${typingAgents[0]} typing...`;

                  return (
                    <SpaceListItem 
                      key={space.id} 
                      space={space} 
                      isActive={space.id === activeSpaceId} 
                      onSelect={() => setActiveSpaceId(space.id)}
                      unreadCount={unreadCounts[space.id] || 0}
                      isTyping={typingInSpace}
                      typingText={typingText}
                      agents={agents}
                      theme={theme}
                    />
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </aside>

      {/* Resize Handle - Desktop Only */}
      {!isMobile && (
        <div 
          onMouseDown={startResizing}
          className={cn(
            "w-1 hover:w-1.5 transition-all cursor-col-resize z-50",
            theme === 'dark' ? "bg-[#222e35] hover:bg-[#FF2E93]/30" : "bg-[#eeeeee] hover:bg-[#FF2E93]/30",
            isResizing && "w-1.5 bg-[#FF2E93]/50"
          )}
        />
      )}

      {/* Main Chat Area */}
      <main className={cn(
        "flex-1 flex h-full overflow-hidden relative transition-all duration-500",
        isMobile && showSpaceListOnMobile ? "hidden" : "flex"
      )}>
        {activeSpace ? (
          <>
            {/* Animated Background Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  x: [0, 50, 0],
                  y: [0, -30, 0]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className={cn("absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[100px]", theme === 'dark' ? "opacity-15" : "opacity-10")}
                style={{ backgroundColor: activeSpace.theme.primary }}
              />
              <motion.div 
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  x: [0, -50, 0],
                  y: [0, 30, 0]
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className={cn("absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]", theme === 'dark' ? "opacity-15" : "opacity-10")}
                style={{ backgroundColor: activeSpace.theme.secondary || '#FF2E93' }}
              />
            </div>

            <div className={cn("flex-1 flex flex-col h-full overflow-hidden relative z-10 transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a]" : "bg-[#efeae2]")}>
              <header className={cn("h-[70px] sm:h-[80px] px-4 sm:px-8 border-b flex items-center justify-between shrink-0 backdrop-blur-xl z-20 sticky top-0 transition-colors duration-300", theme === 'dark' ? "bg-[#111b21]/95 border-[#222e35]" : "bg-[#f0f2f5]/95 border-[#e9edef]")}>
                <div className="flex items-center gap-3 sm:gap-4 truncate">
                  {isMobile && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setActiveSpaceId(null)}
                      className={cn("rounded-xl shrink-0", theme === 'dark' ? "bg-[#202c33] hover:bg-[#2a3942] text-[#e9edf0]" : "bg-[#e9edef] hover:bg-[#d9dbde] text-[#111111]")}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                  )}
                  <div className="flex items-center gap-3 cursor-pointer group truncate" onClick={() => setShowInfo(!showInfo)}>
                    <div className="flex -space-x-3 sm:-space-x-4 shrink-0">
                      {agents.filter(a => activeSpace.agents.includes(a.id)).slice(0, 3).map((a, i) => (
                        <Avatar key={a.id} className={cn("w-8 h-8 sm:w-11 sm:h-11 border-2 shadow-md ring-1 ring-white/10", theme === 'dark' ? "border-[#111b21]" : "border-white")} style={{ zIndex: 3 - i }}>
                          <AvatarImage src={a.avatar} className="object-cover" />
                          <AvatarFallback className="text-[10px] sm:text-[12px] font-black">{a.name[0]}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <div className="flex flex-col truncate">
                      <h2 className={cn("text-[14px] sm:text-[17px] font-black group-hover:text-primary transition-all duration-300 tracking-tight truncate", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>
                        {activeSpace.name}
                      </h2>
                      <div className="flex items-center gap-1.5 -mt-0.5">
                        <motion.div 
                          animate={{ opacity: [1, 0.4, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                        />
                        <p className={cn("text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.1em] font-sans", theme === 'dark' ? "text-[#10B981]" : "text-[#00a884]")}>
                          {activeSpace.agents.length} Agents active
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowHeaderSearch(!showHeaderSearch)}
                    className={cn(
                      "w-10 h-10 rounded-xl transition-all",
                      theme === 'dark' 
                        ? (showHeaderSearch ? "bg-[#202c33] text-primary shadow-inner" : "text-[#8696a0]") 
                        : (showHeaderSearch ? "bg-[#e9edef] text-primary shadow-inner" : "text-[#54656f]")
                    )}
                  >
                    <Search className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                  {!isMobile && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("w-10 h-10 rounded-xl", theme === 'dark' ? "text-[#8696a0] hover:bg-[#202c33]" : "text-[#54656f] hover:bg-[#e9edef]")}
                    >
                      <Phone className="w-5 h-5" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowInfo(!showInfo)}
                    className={cn(
                      "w-10 h-10 rounded-xl transition-all",
                      showInfo 
                        ? "bg-primary text-white shadow-lg" 
                        : (theme === 'dark' ? "text-[#8696a0]" : "text-[#54656f]")
                    )}
                  >
                    <Info className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                </div>
              </header>

              {/* Inline Header Search */}
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
                          placeholder="Search messages in this space..." 
                          value={msgSearchQuery}
                          onChange={(e) => handleMsgSearch(e.target.value)}
                          className={cn("w-full pl-10 pr-10 py-2.5 border-none rounded-xl text-sm outline-none transition-all font-sans", theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] placeholder:text-[#8696a0] focus:ring-1 focus:ring-[#FF2E93]/20" : "bg-white text-[#111111] placeholder:text-[#6b7280]/60 focus:ring-1 focus:ring-[#FF2E93]/20")}
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
                          <div className="flex bg-[#202c33] rounded-lg overflow-hidden border border-transparent">
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

              {/* Chat Messages Panel */}
              <div ref={messagesContainerRef} className={cn("flex-1 overflow-y-auto px-6 py-8 custom-scrollbar transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a]" : "bg-[#efeae2]")}>
                <div className="max-w-3xl mx-auto flex flex-col">
                  {loadingHistory ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <span className="text-sm font-bold text-gray-400">Restoring space resonance...</span>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {messages.reduce((acc: any[], msg, idx, array) => {
                        const dateObj = new Date(msg.timestamp);
                        const msgDate = dateObj.toLocaleDateString();
                        const prevMsgDate = idx > 0 ? new Date(array[idx - 1].timestamp).toLocaleDateString() : null;
                        
                        if (msgDate !== prevMsgDate) {
                          const today = new Date();
                          const yesterday = new Date();
                          yesterday.setDate(today.getDate() - 1);
                          
                          let dateLabel = dateObj.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
                          if (msgDate === today.toLocaleDateString()) dateLabel = "Today";
                          else if (msgDate === yesterday.toLocaleDateString()) dateLabel = "Yesterday";

                          acc.push(
                            <div key={`date-${msg.id}`} className="flex justify-center my-4 sticky top-2 z-10">
                              <span className={cn("px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border font-sans", theme === 'dark' ? "bg-[#1f2c34]/90 border-[#222e35] text-[#8696a0]" : "bg-white/90 border-[#e9edef] text-[#54656f]")}>
                                {dateLabel}
                              </span>
                            </div>
                          );
                        }

                        if (msg.senderType === 'system') {
                          acc.push(
                            <motion.div 
                              key={msg.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex justify-center my-3"
                            >
                              <span className={cn("px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] text-center border shadow-sm", theme === 'dark' ? "bg-[#182229]/60 border-white/5 text-[#8696a0]/80" : "bg-[#e1f5fe]/80 border-[#b3e5fc]/30 text-[#0288d1]")}>
                                {msg.text}
                              </span>
                            </motion.div>
                          );
                          return acc;
                        }

                        const msgAgent = msg.senderType === 'agent' ? agents.find(a => a.id === msg.senderId) : null;
                        const isUser = msg.senderType === 'user';
                        
                        // WhatsApp style stacking: check if previous message was sent by the same user
                        const isConsecutive = idx > 0 && 
                          array[idx - 1].senderId === msg.senderId && 
                          array[idx - 1].senderType === msg.senderType &&
                          (new Date(msg.timestamp).getTime() - new Date(array[idx - 1].timestamp).getTime() < 120000); // 2 min threshold

                        const agentColor = msgAgent?.theme?.primary || '#8B5CF6';

                        acc.push(
                          <motion.div
                            key={msg.id}
                            id={`msg-${msg.id}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 220 }}
                            className={cn("flex flex-col group", isUser ? "items-end" : "items-start", isConsecutive ? "mt-0.5" : "mt-3")}
                          >
                            <div className={cn(
                              "flex gap-2 max-w-[85%] items-end",
                              msgSearchQuery && msg.text.toLowerCase().includes(msgSearchQuery.toLowerCase()) ? "ring-2 ring-primary/40 rounded-[14px] p-0.5" : ""
                            )}>
                              {!isUser && (
                                <div className="w-8 shrink-0">
                                  {!isConsecutive && msgAgent && (
                                    <Avatar 
                                      className={cn("w-8 h-8 border shadow-sm cursor-zoom-in group-hover:scale-105 transition-transform", theme === 'dark' ? "border-[#222e35]" : "border-white")} 
                                      onClick={() => setPreviewImage(msgAgent.avatar)}
                                    >
                                      <AvatarImage src={msgAgent.avatar} />
                                      <AvatarFallback className="text-[10px]">{msgAgent.name[0]}</AvatarFallback>
                                    </Avatar>
                                  )}
                                </div>
                              )}
                              
                              <div 
                                className={cn(
                                  "px-3 py-1.5 sm:px-4 sm:py-2 rounded-[14px] text-[14px] leading-normal font-sans shadow-md relative transition-all duration-300",
                                  isUser 
                                    ? (theme === 'dark' ? "bg-[#005c4b] text-[#e9edf0] rounded-tr-none" : "bg-[#d9fdd3] text-[#111b21] rounded-tr-none")
                                    : (theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] rounded-tl-none" : "bg-white text-[#111b21] rounded-tl-none border border-[#e9edef]/40")
                                )}
                              >
                                <div className="flex flex-col min-w-[70px]">
                                  {!isUser && msgAgent && !isConsecutive && (
                                    <span 
                                      className="text-[11px] font-extrabold mb-1 block select-none font-sans"
                                      style={{ color: agentColor }}
                                    >
                                      {msgAgent.name}
                                    </span>
                                  )}
                                  <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-0.5">
                                    <span className="text-[14px] leading-relaxed break-words whitespace-pre-wrap flex-1 select-text">
                                      {msgSearchQuery ? (
                                        msg.text.split(new RegExp(`(${msgSearchQuery})`, 'gi')).map((part, i) => 
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
                                      ) : msg.text}
                                    </span>
                                    <span className={cn("text-[9px] font-medium font-sans mt-1.5 self-end shrink-0 leading-none select-none", theme === 'dark' ? "text-[#8696a0]/70" : "text-[#667781]")}>
                                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                        return acc;
                      }, [])}

                      {/* Typing Indicators */}
                      {typingAgents.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          className="flex flex-col items-start gap-2 mt-3 ml-10"
                        >
                          <div className={cn("px-4 py-2 rounded-[14px] rounded-tl-none shadow-md flex items-center gap-3", theme === 'dark' ? "bg-[#202c33]" : "bg-white border border-[#e9edef]")}>
                            <span className={cn("text-[13px] font-medium font-sans", theme === 'dark' ? "text-[#8696a0]" : "text-[#54656f]")}>
                              {typingAgents.length > 1 
                                ? `${typingAgents.slice(0, 2).join(', ')}${typingAgents.length > 2 ? ' and others' : ''} are typing`
                                : `${typingAgents[0]} is typing`}
                            </span>
                            <div className="flex gap-1 pt-0.5">
                              {[0, 1, 2].map(i => (
                                <motion.div
                                  key={i}
                                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: activeSpace.theme.primary || '#FF2E93' }}
                                />
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              </div>

              {/* Action Input Bar */}
              <footer className={cn("px-4 sm:px-8 py-3 sm:py-4 shrink-0 z-10 relative border-t transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a] border-[#222e35]" : "bg-[#f0f2f5] border-[#e9edef]")}>
                <form onSubmit={handleSendMessage} className="w-full max-w-5xl mx-auto flex gap-2 sm:gap-3 items-center">
                  <div className={cn("flex-1 border rounded-full flex items-center px-3 sm:px-4 min-h-[40px] sm:min-h-[46px] transition-all duration-300 shadow-md group relative", theme === 'dark' ? "bg-[#202c33] border-transparent" : "bg-white border-[#e9edef]")}>
                    <Button type="button" variant="ghost" size="icon" className={cn("transition-all rounded-full shrink-0 h-8 w-8 sm:h-10 sm:w-10 relative z-10", theme === 'dark' ? "text-[#8696a0] hover:text-[#e9edf0]" : "text-[#54656f] hover:text-[#111111]")}>
                      <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder={`Manifest reply to ${activeSpace.name}...`}
                      className={cn("flex-1 border-none bg-transparent focus:outline-none text-[13.5px] font-medium px-2 sm:px-3 font-sans py-2.5 resize-none min-h-[36px] overflow-hidden leading-relaxed relative z-10 scrollbar-none", theme === 'dark' ? "text-[#e9edf0] placeholder:text-[#8696a0]/50" : "text-[#111111] placeholder:text-[#6b7280]/60")}
                    />
                    <Button type="button" variant="ghost" size="icon" className={cn("transition-all rounded-full shrink-0 h-8 w-8 sm:h-10 sm:w-10 relative z-10", theme === 'dark' ? "text-[#8696a0] hover:text-[#e9edf0]" : "text-[#54656f] hover:text-[#111111]")}>
                      <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={!inputText.trim()}
                    className="text-white w-[40px] h-[40px] sm:w-[46px] sm:h-[46px] rounded-full flex items-center justify-center p-0 transition-all active:scale-95 disabled:opacity-30 shrink-0 shadow-md relative overflow-hidden group/send bg-[#00a884] hover:bg-[#008f72]"
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5 relative z-10 transition-transform group-hover/send:-rotate-12" />
                  </Button>
                </form>
              </footer>
            </div>

            {/* Right details info bar */}
            <AnimatePresence>
              {showInfo && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowInfo(false)}
                    className={cn("absolute inset-0 z-30 transition-all", theme === 'dark' ? "bg-black/40 backdrop-blur-[2px]" : "bg-black/20 backdrop-blur-[1px]")}
                  />
                  <motion.aside
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className={cn("absolute top-0 right-0 w-80 sm:w-[380px] h-full border-l flex flex-col shrink-0 z-40 shadow-2xl transition-colors duration-300", theme === 'dark' ? "bg-[#111b21] border-[#222e35]" : "bg-white border-[#eeeeee]")}
                  >
                    <div className="p-8 pb-4 flex items-center justify-between">
                      <h3 className={cn("text-[18px] font-black tracking-tight font-sans", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>Space Details</h3>
                      <Button variant="ghost" size="icon" onClick={() => setShowInfo(false)} className={cn("w-9 h-9 rounded-full transition-all", theme === 'dark' ? "text-[#8696a0] hover:text-primary hover:bg-[#202c33]" : "text-[#6b7280] hover:text-primary hover:bg-[#f7f7f8]")}>
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10 flex flex-col items-center">
                      <div className="flex flex-col items-center text-center space-y-4 w-full">
                        <div 
                          className={cn("w-32 h-32 rounded-[40px] flex items-center justify-center text-white text-5xl italic font-black shadow-2xl ring-4", theme === 'dark' ? "ring-[#202c33]" : "ring-[#f0f2f5]")} 
                          style={{ background: activeSpace.theme.gradient }}
                        >
                          {activeSpace.name[0]}
                        </div>
                        <div>
                          <h4 className={cn("text-2xl font-black tracking-tight", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>{activeSpace.name}</h4>
                          <p className="text-[11px] font-bold text-[#10B981] uppercase tracking-[0.2em] mt-1 bg-[#10B981]/10 px-4 py-1 rounded-full border border-[#10B981]/20">Collective Resonance</p>
                        </div>
                      </div>

                      {activeSpace.vibe && (
                        <div className={cn("w-full space-y-2 p-5 rounded-[24px] border", theme === 'dark' ? "bg-[#202c33] border-white/5" : "bg-[#fcf8ff] border-[#f0e7ff]")}>
                          <h5 className={cn("text-[11px] font-black uppercase tracking-widest flex items-center gap-2", theme === 'dark' ? "text-[#10B981]" : "text-primary")}>
                             <Sparkles className="w-3.5 h-3.5" />
                             Realm Vibe
                          </h5>
                          <p className={cn("text-[13px] leading-relaxed font-sans font-bold capitalize", theme === 'dark' ? "text-[#e9edf0]/90" : "text-[#1e1b4b]")}>
                            {activeSpace.vibe}
                          </p>
                        </div>
                      )}

                      <div className={cn("w-full space-y-3 p-6 rounded-[24px] border", theme === 'dark' ? "bg-[#202c33]/50 border-white/5" : "bg-[#f8f9fa] border-[#f3f4f6]")}>
                        <h5 className={cn("text-[11px] font-black uppercase tracking-widest flex items-center gap-2", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]/60")}>
                           <LayoutGrid className="w-3 h-3" />
                           About This Space
                        </h5>
                        <p className={cn("text-[13.5px] leading-relaxed font-sans italic", theme === 'dark' ? "text-[#e9edf0]/80" : "text-[#111111]/80")}>"{activeSpace.description}"</p>
                      </div>

                      <div className="w-full space-y-5">
                        <h5 className={cn("text-[11px] font-black uppercase tracking-widest ml-1 flex items-center gap-2", theme === 'dark' ? "text-[#10B981]" : "text-primary")}>
                          <Users className="w-4 h-4 animate-pulse" />
                          Manifested Agents ({activeSpace.agents.length})
                        </h5>
                        <div className="grid grid-cols-1 gap-4 w-full">
                          {agents.filter(a => activeSpace.agents.includes(a.id)).map((agent) => {
                            const isSpeaker = activeSpeaker === agent.name;
                            return (
                              <div 
                                key={agent.id} 
                                className={cn(
                                  "flex items-center gap-4 group cursor-pointer p-3 rounded-2xl border transition-all",
                                  theme === 'dark' 
                                    ? (isSpeaker ? "border-primary bg-primary/[0.05] shadow-[0_0_12px_rgba(255,46,147,0.15)]" : "border-transparent hover:border-[#2a3942] hover:bg-[#2a3942]") 
                                    : (isSpeaker ? "border-primary bg-primary/[0.02] shadow-[0_4px_12px_rgba(255,46,147,0.05)]" : "border-transparent hover:border-[#eeeeee] hover:bg-[#fcfcfc]")
                                )}
                                onClick={() => onNavigateToChat(agent.id)}
                              >
                                <div className="relative">
                                  <Avatar 
                                    className={cn(
                                      "w-12 h-12 border group-hover:scale-105 transition-all duration-300",
                                      isSpeaker && "ring-4 ring-primary/30",
                                      theme === 'dark' ? "border-[#222e35]" : "border-[#f0f2f5]"
                                    )} 
                                    onClick={(e) => { e.stopPropagation(); setPreviewImage(agent.avatar); }}
                                  >
                                    <AvatarImage src={agent.avatar} className="object-cover" />
                                    <AvatarFallback>{agent.name[0]}</AvatarFallback>
                                  </Avatar>
                                  <div className="absolute bottom-0 right-0">
                                    <motion.div 
                                      animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
                                      transition={{ duration: 1.5, repeat: Infinity }}
                                      className={cn("w-3 h-3 rounded-full border-2 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]", theme === 'dark' ? "border-[#111b21]" : "border-white")} 
                                    />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-[14px] font-bold truncate font-sans group-hover:text-primary transition-colors flex items-center gap-1.5", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>
                                    {agent.name}
                                    {isSpeaker && (
                                      <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
                                    )}
                                  </p>
                                  <p className={cn("text-[11px] truncate font-sans italic opacity-85", theme === 'dark' ? "text-[#8696a0]" : "text-[#6b7280]/70")}>{agent.tagline}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Delete Custom Space Option */}
                      {activeSpace && !activeSpace.isDefault && (
                        <div className="w-full pt-4">
                          <Button 
                            onClick={() => handleDeleteSpace(activeSpace.id)}
                            className={cn("w-full border h-14 rounded-2xl text-[13px] font-bold transition-all flex items-center justify-center gap-2", theme === 'dark' ? "bg-red-950/20 border-red-900/40 text-red-400 hover:bg-red-950/40" : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100")}
                          >
                            <Trash2 className="w-4 h-4" />
                            Dissolve Realm
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.aside>
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
                  className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 md:p-10"
                  onClick={() => setPreviewImage(null)}
                >
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-6 right-6 text-white hover:bg-white/10 rounded-full z-[210]"
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
                      className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border-4 border-white/10"
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className={cn("flex-1 flex flex-col items-center justify-center p-8 text-center gap-4", theme === 'dark' ? "bg-[#0b141a]" : "bg-[#f0f2f5]")}>
            <div className={cn("w-16 h-16 rounded-full flex items-center justify-center", theme === 'dark' ? "bg-[#00a884]/10 text-[#00a884]" : "bg-primary/10 text-primary")}>
              <MessageCircle className="w-8 h-8" />
            </div>
            <h3 className={cn("text-xl font-black", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>No Realm Selected</h3>
            <p className={cn("max-w-sm", theme === 'dark' ? "text-[#8696a0]" : "text-gray-400")}>Select a manifested realm from the sidebar or summon a new collective to begin chatting.</p>
          </div>
        )}
      </main>
    </div>
  );
}
