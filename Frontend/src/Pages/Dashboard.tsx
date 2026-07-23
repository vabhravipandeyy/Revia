import { useState, useMemo } from 'react';
import { Agent, User } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight,
  Search,
  MessageSquare,
  PlusCircle,
  Info,
  Shield,
  HelpCircle,
  Mail,
  Globe,
  Star,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PersonaAvatarImage from '@/src/components/PersonaAvatarImage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

interface DashboardProps {
  user: User;
  agents: Agent[];
  onStartChat: (agentId: string) => void;
  onNavigateToCreate: () => void;
  onNavigateToSpaces: (spaceId: string) => void;
  theme: 'light' | 'dark';
}

interface PersonaCardProps {
  key?: string;
  agent: Agent;
  index: number;
  onStartChat: (agentId: string) => void;
  onViewInfo: (agent: Agent) => void;
  personaCategoryMeta: Record<string, { label: string; accent: string; bg: string; border: string }>;
  theme: 'light' | 'dark';
}

function PersonaCard({ agent, index, onStartChat, onViewInfo, personaCategoryMeta, theme }: PersonaCardProps) {
  const meta = personaCategoryMeta[(agent.category || '').toLowerCase()];
  const accentClasses =
    agent.gender === 'female'
      ? {
          hover: "hover:border-[#EC4899]/30 hover:shadow-[0_20px_40px_rgba(236,72,153,0.12)] hover:bg-[#EC4899]/5",
          title: "group-hover:text-[#EC4899]",
          chip: "text-[#EC4899]",
          button: "bg-[#EC4899] hover:bg-[#D43D87] text-white shadow-[#EC4899]/20",
        }
      : agent.gender === 'male'
        ? {
            hover: "hover:border-[#06B6D4]/30 hover:shadow-[0_20px_40px_rgba(6,182,212,0.12)] hover:bg-[#06B6D4]/5",
            title: "group-hover:text-[#06B6D4]",
            chip: "text-[#06B6D4]",
            button: "bg-[#06B6D4] hover:bg-[#0891B2] text-white shadow-[#06B6D4]/20",
          }
        : {
            hover: "hover:border-accent/30 hover:shadow-accent/10 hover:bg-zinc-50",
            title: "group-hover:text-accent",
            chip: "text-accent",
            button: "bg-primary hover:bg-primary/90 text-white shadow-primary/20",
          };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{
        duration: 0.3,
        delay: index * 0.03,
        ease: "easeOut"
      }}
      whileHover={{ y: -5 }}
      className="h-full"
    >
      <Card
        className={cn(
          "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.7rem] border transition-all duration-500",
          theme === 'dark'
            ? "border-[#222e35] bg-[#111b21] shadow-black/25"
            : "border-[#DDD3F1] bg-white shadow-[0_18px_50px_-40px_rgba(78,37,121,0.3)]",
          accentClasses.hover
        )}
      >
        <CardContent className="flex flex-1 flex-col p-0">
          <div className="p-2">
            <div className={cn("relative aspect-[4/5] overflow-hidden rounded-[1.35rem]", theme === 'dark' ? "bg-[#202c33]" : "bg-[#F5F3FB]")}>
              <PersonaAvatarImage
                src={agent.avatar}
                name={agent.name}
                className="h-full w-full"
                imgClassName="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                fallbackClassName={cn("flex h-full w-full items-center justify-center", theme === 'dark' ? "bg-[#111b21]" : "bg-[#FAFAFA]")}
              />
              <div className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-black/5 bg-white/50 backdrop-blur-md shadow-lg shadow-black/5">
                {agent.status === 'online' ? (
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="h-3 w-3 rounded-full bg-[#A8AFC2] shadow-[0_0_8px_rgba(168,175,194,0.7)]"
                  />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-[#B8B8C7]" />
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col space-y-2.5 px-3.5 pb-3.5 pt-1">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className={cn(
                  "text-[1.65rem] leading-none font-serif font-black italic tracking-tighter transition-colors duration-500 xl:text-[1.5rem]",
                  theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]",
                  accentClasses.title
                )}>
                  {agent.name}
                </h3>
                {agent.age !== undefined && (
                  <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em]", theme === 'dark' ? "border-white/5 bg-[#202c33] text-[#8696a0]" : "border-[#E3DBF4] bg-[#FCFAFF] text-[#7E7B8E]")}>
                    {agent.age}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {agent.spontaneityLevel && (
                  <span className={cn("rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em]", theme === 'dark' ? "border-white/5 bg-[#202c33] text-[#8696a0]" : "border-[#DED7F1] bg-white text-[#77748C]")}>
                    {agent.spontaneityLevel} ping
                  </span>
                )}
              </div>

              <p className={cn("text-[9px] font-black uppercase tracking-[0.16em] italic", theme === 'dark' ? "text-[#8696a0]/80" : "text-[#A2A7B4]")}>
                {agent.personality.split(' • ').slice(0, 2).join(' • ')}
              </p>
            </div>

            <div className={cn("rounded-[1rem] border px-3.5 py-3", theme === 'dark' ? "border-white/5 bg-[#202c33]/50" : "border-[#F0E7FF] bg-[#F8F5FF]")}>
              <p className={cn("line-clamp-2 text-[10px] font-medium italic leading-relaxed", theme === 'dark' ? "text-[#8696a0]" : "text-[#80879A]")}>
                "{agent.tagline || agent.personality}"
              </p>
            </div>

            <div className={cn("mt-auto space-y-2.5 border-t pt-3.5", theme === 'dark' ? "border-[#222e35]" : "border-[#F0E7FF]")}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className={cn(
                    "rounded-full bg-secondary/50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em]",
                    accentClasses.chip
                  )}>
                    {meta?.label || agent.personality.split(' • ')[0]}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onViewInfo(agent)}
                  className={cn("flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.14em] transition-colors hover:text-[#06B6D4]", theme === 'dark' ? "text-[#8696a0]/50" : "text-muted-foreground/40")}
                >
                  <Info className="h-3 w-3" /> INFO
                </button>
              </div>

              <Button
                className={cn(
                  "h-10 w-full rounded-[1rem] font-serif text-[15px] font-black italic tracking-tight shadow-lg transition-all duration-300 group/btn",
                  accentClasses.button
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onStartChat(agent.id);
                }}
              >
                Chat <MessageSquare className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1 group-hover/btn:scale-110" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Dashboard({ user, agents, onStartChat, onNavigateToCreate, onNavigateToSpaces, theme }: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewingAgent, setViewingAgent] = useState<Agent | null>(null);
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const firstName = user.name?.trim()?.split(' ')[0] || user.username?.trim() || 'User';

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  const categories = [
    { id: 'female', spaceId: 's1', name: 'Her Frequency', tagline: 'Emotionally aware. Intuitive. Always listening.', color: 'text-[#FF2E93]', hoverColor: 'group-hover:text-[#FF2E93]', bg: 'bg-[#FF2E93]/5', border: 'border-[#FF2E93]/20' },
    { id: 'male', spaceId: 's2', name: 'The Brotherhood', tagline: 'Straight talk. No filters. Just real conversations.', color: 'text-[#06B6D4]', hoverColor: 'group-hover:text-[#06B6D4]', bg: 'bg-[#06B6D4]/5', border: 'border-[#06B6D4]/20' },
    { id: 'non-binary', spaceId: 's3', name: 'Equilibrium', tagline: 'Balanced minds. Thoughtful conversations.', color: 'text-[#111111]', hoverColor: 'group-hover:text-[#FF2E93]', bg: 'bg-zinc-50', border: 'border-zinc-200' },
  ];

  const PREBUILT_PERSONA_IDS = [
    'aisha',
    'aarav',
    'rhea',
    'ethan',
    'meera',
    'kian',
    'zoya',
    'elena',
    'anaya',
    'priya',
    'nisha',
    'kiara',
  ];

  const personaCategoryMeta: Record<string, { label: string; accent: string; bg: string; border: string }> = {
    emotional: { label: 'Emotional', accent: 'text-[#E85D9B]', bg: 'bg-[#FFF0F6]', border: 'border-[#FFD6E8]' },
    romantic: { label: 'Romantic', accent: 'text-[#FF5E8A]', bg: 'bg-[#FFF1F5]', border: 'border-[#FFD8E4]' },
    intimate: { label: 'Intense', accent: 'text-[#7C5CFC]', bg: 'bg-[#F4F0FF]', border: 'border-[#DDD2FF]' },
    hybrid: { label: 'Hybrid', accent: 'text-[#FF2E93]', bg: 'bg-[#FFF0F7]', border: 'border-[#FFD3E9]' },
  };

  const defaultPersonaCount = useMemo(
    () => agents.filter(agent => ['emotional', 'romantic', 'intimate', 'hybrid'].includes((agent.category || '').toLowerCase())).length,
    [agents]
  );

  const filteredAgents = useMemo(() => {
    let result = agents;
    
    if (selectedCategory) {
      result = result.filter(agent => agent.gender === selectedCategory);
    }

    if (searchQuery) {
      result = result.filter(agent => 
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.personality.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return result;
  }, [agents, searchQuery, selectedCategory]);

  const signaturePersonaOrder = ['emotional', 'romantic', 'intimate', 'hybrid'];
  const customAgents = useMemo(
    () => filteredAgents.filter(agent => !PREBUILT_PERSONA_IDS.includes(agent.id)),
    [filteredAgents]
  );
  const signaturePersonas = useMemo(() => {
    return filteredAgents
      .filter(agent => PREBUILT_PERSONA_IDS.includes(agent.id))
      .sort((left, right) => {
        const leftCategoryIndex = signaturePersonaOrder.indexOf((left.category || '').toLowerCase());
        const rightCategoryIndex = signaturePersonaOrder.indexOf((right.category || '').toLowerCase());
        const safeLeft = leftCategoryIndex === -1 ? 99 : leftCategoryIndex;
        const safeRight = rightCategoryIndex === -1 ? 99 : rightCategoryIndex;

        if (safeLeft !== safeRight) {
          return safeLeft - safeRight;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, 6);
  }, [filteredAgents]);
  const allCompanions = useMemo(() => [...customAgents, ...signaturePersonas], [customAgents, signaturePersonas]);

  return (
    <div className={cn("h-full overflow-y-auto no-scrollbar font-sans transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a] text-[#e9edf0]" : "bg-[#FAFAFE] text-foreground")}>
      {/* PERSONALIZED GREETING */}
      <div className="px-8 pt-12 pb-2">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="space-y-2"
          >
            <div className="flex items-end gap-3 translate-x-1">
              <h1 className={cn(
                "text-5xl font-serif font-black italic tracking-tighter",
                user.gender === 'male' ? "text-[#06B6D4]" : "text-primary"
              )}>
                Hello, {firstName}
              </h1>
              <div className={cn(
                "w-2 h-2 rounded-full mb-2 animate-pulse",
                user.gender === 'male' ? "bg-[#06B6D4]" : "bg-accent"
              )} />
            </div>
            <div className="pl-1">
              <h2 className={cn("text-xl font-black italic tracking-tight uppercase", theme === 'dark' ? "text-[#e9edf0]/60" : "text-muted-foreground/60")}>Conversation Spaces</h2>
              <p className={cn("text-xs font-bold italic", theme === 'dark' ? "text-[#8696a0]/60" : "text-muted-foreground/40")}>Select a realm to find your companion.</p>
              {defaultPersonaCount > 0 && (
                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#FF2E93]">
                  {defaultPersonaCount} signature personas ready
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
            className="flex flex-col items-end"
          >
            <Button 
              className="bg-black hover:bg-[#FF2E93] text-white rounded-2xl px-10 h-14 font-black uppercase text-xs tracking-[0.3em] transition-all duration-500 shadow-xl shadow-black/10 hover:shadow-[#FF2E93]/20 hover:scale-[1.05] active:scale-95 group relative flex items-center gap-3 overflow-hidden"
              onClick={onNavigateToCreate}
            >
              <motion.div
                initial={false}
                animate={{ x: 0 }}
                whileHover={{ rotate: 180 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <PlusCircle className="w-5 h-5" />
              </motion.div>
              
              <span className="relative z-10">REKINDLE</span>
              
              {/* Animated Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
            </Button>
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              whileHover={{ opacity: 1, y: 5 }}
              className={cn("text-[10px] font-bold italic mt-2 opacity-0 group-hover:opacity-100 transition-opacity", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}
            >
              Start your own journey here...
            </motion.p>
          </motion.div>
        </div>
      </div>

      <div className="px-8 pt-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map((cat, i) => (
            <motion.div 
              key={cat.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: "easeOut" }}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              className={cn(
                "group relative h-48 rounded-[2rem] overflow-hidden border cursor-pointer hover:scale-[1.05] transition-all duration-500",
                cat.bg,
                selectedCategory === cat.id ? "ring-4 ring-offset-2 ring-accent border-accent" : cat.border
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              <div className="p-8 h-full flex flex-col justify-center gap-2 relative z-10 transition-transform duration-500 group-hover:translate-x-2">
                <h3 className={cn("text-4xl font-serif font-black italic tracking-tighter leading-none transition-all duration-500", cat.color, cat.hoverColor)}>
                  {cat.name}
                </h3>
                <p className={cn(
                  "text-[11px] font-bold tracking-tight transition-all duration-300",
                  selectedCategory === cat.id ? "opacity-100 text-primary" : "opacity-60 group-hover:opacity-100 group-hover:text-primary"
                )}>
                  {cat.tagline}
                </p>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToSpaces(cat.spaceId);
                  }}
                  className={cn("mt-2 w-fit text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all shadow-sm rounded-full px-4 h-8 border", theme === 'dark' ? "bg-[#202c33] border-white/5 text-[#e9edf0] hover:bg-[#2a3942]" : "bg-white border-[#F0F0F0] text-black")}
                >
                  Enter Space
                </Button>
              </div>
              <div className={cn(
                "absolute inset-0 transition-colors duration-500",
                selectedCategory === cat.id ? "bg-accent/5" : "bg-black/0 group-hover:bg-black/[0.03]"
              )} />
            </motion.div>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-8 py-16 space-y-16">
        <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-8 border-b pb-10", theme === 'dark' ? "border-[#222e35]" : "border-[#F0E7FF]")}>
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="space-y-1"
          >
             <h2 className={cn("text-3xl font-black italic tracking-tight", theme === 'dark' ? "text-[#e9edf0]" : "text-[#111111]")}>
               {selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name} Members` : 'Active Companions'}
             </h2>
             <p className="text-muted-foreground text-sm font-medium flex items-center gap-2">
               Synthesized frequencies ready for transmission.
             </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="flex flex-wrap gap-2"
          >
            {Object.entries(personaCategoryMeta).map(([key, meta]) => {
              const count = agents.filter(agent => (agent.category || '').toLowerCase() === key).length;
              if (count === 0) {
                return null;
              }

              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em]",
                    meta.bg,
                    meta.border,
                    meta.accent
                  )}
                >
                  {meta.label} · {count}
                </div>
              );
            })}
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 15 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-4"
          >
            {selectedCategory && (
              <Button 
                variant="ghost" 
                className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-[#06B6D4] transition-colors"
                onClick={() => setSelectedCategory(null)}
              >
                Clear Filter
              </Button>
            )}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <input 
                type="text" 
                placeholder="Seek a voice..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("pl-11 pr-5 py-3 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#06B6D4] transition-all w-64 shadow-sm border", theme === 'dark' ? "bg-[#202c33] border-[#222e35] text-[#e9edf0] placeholder:text-[#8696a0]" : "bg-white border-[#F0E7FF]")}
              />
            </div>
          </motion.div>
        </div>

        <div className="space-y-5">
          <div className={cn("flex flex-col gap-4 rounded-[2rem] border px-5 py-5 sm:px-6", theme === 'dark' ? "border-[#222e35] bg-[#111b21]/75 shadow-black/25" : "border-[#F0E7FF] bg-white/75 shadow-[0_20px_60px_-45px_rgba(78,37,121,0.25)]")}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <h3 className={cn("text-2xl font-black italic tracking-tight sm:text-3xl", theme === 'dark' ? "text-[#e9edf0]" : "text-black")}>All Companions</h3>
                <p className="text-sm font-medium text-muted-foreground">
                  Your created personas and default signature companions together in one place.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {customAgents.length > 0 && (
                  <span className={cn("rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#FF2E93]", theme === 'dark' ? "border-white/5 bg-[#202c33]/50" : "border-[#F0E7FF] bg-[#FFF7FB]")}>
                    {customAgents.length} Created
                  </span>
                )}
                {signaturePersonas.length > 0 && (
                  <span className={cn("rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#7E7B8E]", theme === 'dark' ? "border-white/5 bg-[#202c33]/50" : "border-[#F0E7FF] bg-[#FAFAFE]")}>
                    {signaturePersonas.length} Default
                  </span>
                )}
                <span className={cn("rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em]", theme === 'dark' ? "border-white/5 bg-[#202c33]/50 text-white" : "border-[#F0E7FF] bg-white text-[#111111]")}>
                  {allCompanions.length} Total
                </span>
              </div>
            </div>

          </div>

          <motion.div 
            layout
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <AnimatePresence mode="popLayout">
              {allCompanions.map((agent, index) => (
                <PersonaCard
                  key={`${PREBUILT_PERSONA_IDS.includes(agent.id) ? 'signature' : 'custom'}-${agent.id}`}
                  agent={agent}
                  index={index}
                  onStartChat={onStartChat}
                  onViewInfo={setViewingAgent}
                  personaCategoryMeta={personaCategoryMeta}
                  theme={theme}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        <Dialog open={Boolean(viewingAgent)} onOpenChange={(open) => !open && setViewingAgent(null)}>
          {viewingAgent && (
            <DialogContent showCloseButton={false} className={cn("h-[560px] max-w-[720px] overflow-hidden rounded-[24px] border-none p-0 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)]", theme === 'dark' ? "bg-[#111b21] text-[#e9edf0] shadow-black/40 border border-[#222e35]" : "bg-white")}>
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="flex h-full"
              >
                <div className="relative w-[40%]">
                  <PersonaAvatarImage
                    src={viewingAgent.avatar}
                    name={viewingAgent.name}
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover"
                    fallbackClassName={cn("flex h-full w-full items-center justify-center", theme === 'dark' ? "bg-[#111b21]" : "bg-[#FAFAFA]")}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  <div className="absolute bottom-8 left-6 right-6 space-y-1 text-white">
                    <div className="mb-1 flex items-center gap-2">
                      {viewingAgent.status === 'online' ? (
                        <motion.div
                          animate={{ opacity: [1, 0.5, 1], scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
                        />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-gray-400" />
                      )}
                    </div>
                    <h2 className="text-3xl font-serif font-black italic tracking-tighter leading-none">{viewingAgent.name}</h2>
                    <p className="line-clamp-2 text-xs font-medium italic leading-relaxed text-white/70">{viewingAgent.tagline}</p>
                  </div>
                </div>

                <div className={cn("relative flex w-[60%] flex-col p-8", theme === 'dark' ? "bg-[#111b21]" : "bg-white")}>
                  <DialogClose className={cn("group absolute right-4 top-4 z-50 rounded-full p-2.5 text-muted-foreground/30 transition-all duration-300 hover:text-primary", theme === 'dark' ? "hover:bg-[#202c33]" : "hover:bg-zinc-50")}>
                    <X className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                  </DialogClose>

                  <div className="flex-1 space-y-6 overflow-y-auto pr-1 no-scrollbar">
                    <div className="flex items-center justify-between">
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                        <div className="flex items-start gap-3">
                          <h3 className="text-xl font-serif font-black italic text-primary">{viewingAgent.name}</h3>
                          {viewingAgent.age !== undefined && (
                            <span className={cn("mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]", theme === 'dark' ? "border-white/5 bg-[#202c33] text-[#8696a0]" : "border-[#E9E4F4] bg-[#FAFAFE] text-[#7E7B8E]")}>
                              {viewingAgent.age}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{viewingAgent.language}</p>
                      </motion.div>
                      {viewingAgent.status === 'online' ? (
                        <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-green-600">Active</span>
                        </motion.div>
                      ) : (
                        <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground", theme === 'dark' ? "border-white/5 bg-[#202c33]" : "border-secondary bg-secondary/50")}>
                          <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          <span>{viewingAgent.status}</span>
                        </div>
                      )}
                    </div>

                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="flex flex-wrap gap-2">
                      {viewingAgent.personality.split(' • ').map(trait => (
                        <span key={trait} className={cn("rounded-full border px-3 py-1 text-[10px] font-bold", theme === 'dark' ? "border-blue-500/20 bg-blue-500/10 text-blue-400" : "border-blue-100 bg-blue-50 text-blue-600")}>
                          {trait}
                        </span>
                      ))}
                    </motion.div>

                    <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="text-sm font-medium leading-relaxed text-muted-foreground/80">
                      {viewingAgent.description}
                    </motion.p>

                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[#06B6D4]">Conversation Style</h4>
                      <ul className="grid grid-cols-2 gap-2">
                        {viewingAgent.conversationStyle?.map((style, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <div className="h-1 w-1 rounded-full bg-accent" />
                            {style}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  </div>

                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
                    <Button
                      className={cn("mt-6 h-12 w-full rounded-xl text-sm font-bold tracking-tight shadow-xl transition-all duration-300", theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-black text-white hover:bg-zinc-800")}
                      onClick={() => onStartChat(viewingAgent.id)}
                    >
                      Begin Conversation
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </DialogContent>
          )}
        </Dialog>
      </main>

      {/* MODERN INTERACTIVE FOOTER */}
      <footer className={cn("pt-24 pb-12 mt-20 border-t transition-colors duration-300", theme === 'dark' ? "border-[#222e35] bg-[#111b21]" : "border-[#F0E7FF] bg-white")}>
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            {/* Brand Column */}
            <div className="space-y-6">
              <span className={cn("text-4xl font-serif font-black italic tracking-tighter", theme === 'dark' ? "text-white" : "text-black")}>Revia.</span>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Experience meaningful AI conversations. Real voices, real connection.
              </p>
              <div className="flex gap-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#FF2E93] hover:text-white transition-all duration-300 cursor-pointer border", theme === 'dark' ? "bg-[#202c33] border-white/5 text-[#8696a0]" : "bg-[#FFF0F6] border-[#FFD6EA] text-[#FF2E93]")}>
                  <Globe className="w-5 h-5" />
                </div>
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#FF2E93] hover:text-white transition-all duration-300 cursor-pointer border", theme === 'dark' ? "bg-[#202c33] border-white/5 text-[#8696a0]" : "bg-[#FFF0F6] border-[#FFD6EA] text-[#FF2E93]")}>
                  <Mail className="w-5 h-5" />
                </div>
              </div>
            </div>
            
            {/* Support Column */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-[#3ABEFF]">
                <HelpCircle className="w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Support</h4>
              </div>
              <div className="space-y-1">
                {[
                  { id: 'faq', label: 'FAQ Center', content: (
                    <div className="space-y-3 pt-2">
                       {[
                         { q: "What is Revia?", a: "A next-gen platform for meaningful AI connections." },
                         { q: "How do coins work?", a: "Coins enable seamless soul transmissions." },
                         { q: "Is this AI real?", a: "Advanced neural simulations for deep connection." },
                         { q: "Can I create own souls?", a: "Yes, via the Rekender tool in your dashboard." }
                       ].map((item, i) => (
                         <div key={i} className="space-y-1 group/faq cursor-pointer">
                           <p className="text-[10px] font-black text-primary group-hover/faq:text-[#FF2E93] transition-colors">• {item.q}</p>
                           <p className="text-[10px] text-muted-foreground/70 pl-2 leading-relaxed font-medium italic">{item.a}</p>
                         </div>
                       ))}
                    </div>
                  )},
                  { id: 'status', label: 'Platform Status', content: (
                    <div className="space-y-2 pt-2">
                       <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /><span className="text-[11px] font-medium text-muted-foreground/80">All systems operational</span></div>
                       <p className="text-[11px] font-medium text-muted-foreground/80">Avg response time: Fast</p>
                       <p className="text-[11px] font-medium text-muted-foreground/80">Uptime: 99.9%</p>
                    </div>
                  )},
                  { id: 'contact', label: 'Contact Humans', content: (
                    <div className="space-y-3 pt-2">
                       <p className="text-[11px] font-medium text-muted-foreground/80 uppercase">Email: support@revia.ai</p>
                       <p className="text-[11px] font-medium text-muted-foreground/80">Response: within 24 hours</p>
                       <Button size="sm" className="h-8 text-[9px] bg-primary hover:bg-[#FF2E93] rounded-lg uppercase font-black tracking-widest">Send Message</Button>
                    </div>
                  )}
                ].map(item => (
                  <div key={item.id} className={cn("rounded-xl transition-all duration-300", activeAccordion === item.id ? (theme === 'dark' ? "bg-[#202c33] border border-[#222e35]" : "bg-[#FFF0F6] border border-[#FFD6EA]") : "border-transparent")}>
                    <button 
                      onClick={() => toggleAccordion(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 text-left transition-colors",
                        activeAccordion === item.id ? "text-[#FF2E93]" : "text-muted-foreground hover:text-[#FF2E93]"
                      )}
                    >
                      <ChevronRight className={cn("w-4 h-4 transition-transform duration-300", activeAccordion === item.id && "rotate-90")} />
                      <span className="text-sm font-bold">{item.label}</span>
                    </button>
                    <AnimatePresence>
                      {activeAccordion === item.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-4">
                            {item.content}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal Column */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-[#3ABEFF]">
                <Shield className="w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Legal</h4>
              </div>
              <div className="space-y-1">
                {[
                  { id: 'privacy', label: 'Privacy Protocols', content: (
                    <ul className="space-y-2 pt-2 text-[11px] font-medium text-muted-foreground/80 lowercase italic">
                      <li>• Your data is encrypted</li>
                      <li>• No chat data is shared</li>
                      <li>• Full user control over data</li>
                    </ul>
                  )},
                  { id: 'terms', label: 'Terms of Service', content: (
                    <ul className="space-y-2 pt-2 text-[11px] font-medium text-muted-foreground/80 lowercase italic">
                      <li>• Use respectfully</li>
                      <li>• No misuse of AI personas</li>
                      <li>• Platform rights and guidelines</li>
                    </ul>
                  )},
                  { id: 'safety', label: 'Safety Guide', content: (
                    <ul className="space-y-2 pt-2 text-[11px] font-medium text-muted-foreground/80 lowercase italic">
                      <li>• AI is a simulation</li>
                      <li>• Avoid emotional dependency</li>
                      <li>• Reach out to real people when needed</li>
                    </ul>
                  )}
                ].map(item => (
                  <div key={item.id} className={cn("rounded-xl transition-all duration-300", activeAccordion === item.id ? (theme === 'dark' ? "bg-[#202c33] border border-[#222e35]" : "bg-[#FFF0F6] border border-[#FFD6EA]") : "border-transparent")}>
                    <button 
                      onClick={() => toggleAccordion(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 text-left transition-colors",
                        activeAccordion === item.id ? "text-[#FF2E93]" : "text-muted-foreground hover:text-[#FF2E93]"
                      )}
                    >
                      <ChevronRight className={cn("w-4 h-4 transition-transform duration-300", activeAccordion === item.id && "rotate-90")} />
                      <span className="text-sm font-bold">{item.label}</span>
                    </button>
                    <AnimatePresence>
                      {activeAccordion === item.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-4">
                            {item.content}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* Community Column */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-[#3ABEFF]">
                <Star className="w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Community</h4>
              </div>
              <div className="space-y-1">
                {[
                  { id: 'discord', label: 'Discord Hub', content: (
                    <div className="space-y-2 pt-2 text-[11px] font-medium text-muted-foreground/80">
                      <p>Join community discussions, meet other users, and share experiences in our specialized channels.</p>
                    </div>
                  )},
                  { id: 'feedback', label: 'Feedback Loop', content: (
                    <div className="space-y-2 pt-2 text-[11px] font-medium text-muted-foreground/80">
                      <p>Submit feedback, suggest new personas, and report issues directly to our synthesizer team.</p>
                    </div>
                  )},
                  { id: 'ambassadors', label: 'Ambassadors', content: (
                    <div className="space-y-2 pt-2 text-[11px] font-medium text-muted-foreground/80">
                      <p>Become a community leader. Early feature access and special rewards for top-tier members.</p>
                    </div>
                  )}
                ].map(item => (
                  <div key={item.id} className={cn("rounded-xl transition-all duration-300", activeAccordion === item.id ? (theme === 'dark' ? "bg-[#202c33] border border-[#222e35]" : "bg-[#FFF0F6] border border-[#FFD6EA]") : "border-transparent")}>
                    <button 
                      onClick={() => toggleAccordion(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 text-left transition-colors",
                        activeAccordion === item.id ? "text-[#FF2E93]" : "text-muted-foreground hover:text-[#FF2E93]"
                      )}
                    >
                      <ChevronRight className={cn("w-4 h-4 transition-transform duration-300", activeAccordion === item.id && "rotate-90")} />
                      <span className="text-sm font-bold">{item.label}</span>
                    </button>
                    <AnimatePresence>
                      {activeAccordion === item.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-4">
                            {item.content}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={cn("pt-12 border-t flex flex-col md:flex-row justify-between items-center gap-6", theme === 'dark' ? "border-[#222e35]" : "border-[#F0E7FF]")}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              © 2026 Revia AI Systems. All rights reserved.
            </p>
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span>Systems Optimal</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
