import React from 'react';
import { Agent } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Trash2, MessageSquare, Clock, Filter, History as HistoryIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface HistoryProps {
  agents: Agent[];
  onStartChat: (agentId: string) => void;
}

export default function History({ agents, onStartChat }: HistoryProps) {
  return (
    <div className="p-12 space-y-16 max-w-5xl mx-auto h-full overflow-auto pb-32">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
        <div>
          <h2 className="text-5xl font-serif font-black tracking-tighter text-primary italic leading-none">History.</h2>
          <p className="text-muted-foreground font-medium tracking-tight mt-2 italic">Revisit the digital echoes of past transmissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-[#F0E7FF] text-primary gap-2 h-12 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#F5F3FF]">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button variant="outline" className="border-red-100 text-red-500 hover:bg-red-50 gap-2 h-12 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest">
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </header>

      <div className="relative mb-12">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30" />
        <Input 
          placeholder="Search transmissions..." 
          className="pl-14 bg-[#F5F3FF] border-2 border-transparent h-16 rounded-[1.5rem] text-lg font-bold focus:bg-white focus:border-accent transition-all shadow-inner" 
        />
      </div>

      <div className="space-y-6">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-white border border-[#F0E7FF] hover:border-accent/20 hover:shadow-2xl hover:shadow-accent/5 transition-all duration-500 cursor-pointer group rounded-[2.5rem]" onClick={() => onStartChat(agent.id)}>
              <CardContent className="p-0">
                <div className="p-8 flex items-center gap-8">
                  <div className="relative shrink-0">
                    <img src={agent.avatar} alt={agent.name} className="w-20 h-20 rounded-[1.5rem] border-2 border-white shadow-xl group-hover:scale-105 transition-transform" />
                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-accent flex items-center justify-center text-[10px] font-black text-white shadow-lg border-2 border-white">
                      {(index + 1) * 3}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-2xl font-black italic text-primary group-hover:text-accent transition-colors">{agent.name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                        <Clock className="w-3 h-3" />
                        Today, 14:22
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium truncate italic opacity-80 mb-4">
                      "{agent.lastMessage || agent.tagline}"
                    </p>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-1.5 text-[9px] uppercase font-black tracking-[0.2em] text-accent">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {15 + index * 4} Transmissions
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground/40">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                        Sync: 88%
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl text-muted-foreground hover:text-primary hover:bg-[#F5F3FF]">
                      <Search className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl text-muted-foreground hover:text-red-500 hover:bg-red-50">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="py-24 border-t border-[#F0E7FF] flex flex-col items-center justify-center text-center gap-6 opacity-30 mt-20">
        <div className="w-16 h-16 rounded-full border-2 border-[#F0E7FF] flex items-center justify-center">
          <HistoryIcon className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-black uppercase tracking-[0.5em] text-primary">END OF ARCHIVE</p>
          <p className="text-xs font-bold italic">All echoes synchronized.</p>
        </div>
      </div>
    </div>
  );
}
