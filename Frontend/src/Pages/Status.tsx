import { Agent, User } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'motion/react';
import { Activity, Clock, Smile, Brain, Heart, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusProps {
  agents: Agent[];
  user: User;
}

export default function Status({ agents, user }: StatusProps) {
  const moodMetrics = [
    { label: 'INTELLIGENCE', value: 94, icon: Brain, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'EMPATHY', value: 88, icon: Heart, color: 'text-[#EC4899]', bg: 'bg-[#EC4899]/10' },
    { label: 'ENERGY', value: 76, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="p-12 space-y-16 max-w-7xl mx-auto h-full overflow-auto pb-32">
      <header className="flex items-center gap-6">
        <div className="w-16 h-16 rounded-[2rem] bg-accent text-white flex items-center justify-center shadow-2xl shadow-accent/20">
          <Activity className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-5xl font-serif font-black tracking-tighter text-primary italic leading-none">Status.</h2>
          <p className="text-muted-foreground font-medium tracking-tight mt-2 italic">Monitoring the emotional frequency of your syndicate.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* User Stats Card */}
        <Card className="bg-white border border-[#F0E7FF] col-span-1 lg:col-span-2 overflow-hidden rounded-[3rem] shadow-2xl shadow-black/[0.02]">
          <CardHeader className="border-b border-[#F0E7FF] p-10 bg-[#F5F3FF]/30">
            <CardTitle className="flex items-center gap-3 text-2xl font-black italic text-primary">
              <Smile className="w-6 h-6 text-accent" />
              Psychometric Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {moodMetrics.map((metric) => (
                <div key={metric.label} className="flex flex-col items-center gap-6">
                  <div className={cn("p-6 rounded-[2rem] transition-all duration-500 group relative", metric.bg)}>
                    <metric.icon className={cn("w-10 h-10 transition-transform group-hover:scale-110", metric.color)} />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-2">{metric.label}</p>
                    <p className="text-4xl font-serif font-black italic text-primary">{metric.value}%</p>
                  </div>
                  <div className="w-full h-1.5 bg-[#F5F3FF] rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${metric.value}%` }}
                      transition={{ duration: 1.5, ease: "circOut" }}
                      className={cn("h-full", metric.color.replace('text-', 'bg-'))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 p-8 rounded-[2.5rem] bg-accent/5 border border-accent/10 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xl font-black text-primary italic">Neural State: OPTIMIZED</p>
                <p className="text-sm text-muted-foreground font-medium">Your ephemeral companions are maintaining synchronization.</p>
              </div>
              <Badge className="bg-accent text-white px-6 py-2 rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl shadow-accent/20 border-none">CRYSTAL CLEAR</Badge>
            </div>
          </CardContent>
        </Card>

        {/* AI Cores Status */}
        <Card className="bg-white border border-[#F0E7FF] flex flex-col rounded-[3rem] shadow-2xl shadow-black/[0.02]">
          <CardHeader className="border-b border-[#F0E7FF] p-10 bg-[#F5F3FF]/30">
            <CardTitle className="flex items-center gap-3 text-2xl font-black italic text-primary">
              <Zap className="w-6 h-6 text-accent" />
              Cores Active
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-8 space-y-4">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-5 p-4 rounded-[1.5rem] hover:bg-[#F5F3FF] transition-all duration-300 border border-transparent hover:border-accent/10 group cursor-default">
                <div className="relative shrink-0">
                  <img src={agent.avatar} alt={agent.name} className="w-12 h-12 rounded-[1rem] shadow-md border-2 border-white group-hover:scale-110 transition-transform" />
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white",
                    agent.status === 'online' ? "bg-green-500" : agent.status === 'busy' ? "bg-amber-500" : "bg-gray-300"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-primary italic">{agent.name}</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{agent.status}</p>
                </div>
                <div className="px-3 py-1 rounded-full bg-[#F5F3FF] border border-accent/10 text-[8px] font-black uppercase tracking-widest text-accent">
                   STABLE
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
