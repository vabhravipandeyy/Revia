import { ReactNode } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Activity, 
  User, 
  Settings, 
  PlusCircle, 
  History as HistoryIcon,
  LogOut,
  Coins,
  ChevronRight,
  LayoutGrid,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { User as UserType } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'motion/react';

interface ShellProps {
  children: ReactNode;
  currentPage: string;
  currentUser: UserType | null;
  onNavigate: (page: any) => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Shell({ children, currentPage, currentUser, onNavigate, onLogout, theme, onToggleTheme }: ShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'DASHBOARD' },
    { id: 'chat', icon: MessageSquare, label: 'CHATS' },
    { id: 'spaces', icon: LayoutGrid, label: 'SPACES' },
    { id: 'create-agent', icon: PlusCircle, label: 'REKINDLE' },
  ];

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setIsMenuOpen(false);
  };

  return (
    <div className={cn("flex flex-col h-screen font-sans text-foreground overflow-hidden transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a]" : "bg-[#FAFAFE]")}>
      {/* Top Navigation */}
      <header className={cn("sticky top-0 z-50 backdrop-blur-xl px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between shrink-0 transition-colors duration-300", theme === 'dark' ? "bg-[#111b21]/80 border-b border-[#222e35]" : "bg-white/80 border-b border-[#F0E7FF]")}>
        <div className="flex items-center gap-12">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => onNavigate('dashboard')}
          >
            <h1 className={cn("text-2xl sm:text-3xl font-serif font-black tracking-tighter italic group-hover:text-accent transition-all duration-300 group-hover:scale-110", theme === 'dark' ? "text-white" : "text-black")}>
              Revia.
            </h1>
          </div>

          <nav className="hidden lg:flex items-center gap-8">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "text-[10px] font-black tracking-[0.2em] transition-all duration-500 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-accent hover:to-cyan-400 relative py-2 scale-100 hover:scale-110 active:scale-95 cursor-pointer",
                  currentPage === item.id ? "text-primary" : (theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")
                )}
                onClick={() => handleNavigate(item.id)}
              >
                {item.label}
                {currentPage === item.id && (
                  <motion.div 
                    layoutId="nav-underline" 
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {currentUser && (
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleTheme}
                className={cn(
                  "lg:hidden w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 active:scale-90 border",
                  theme === 'dark' 
                    ? "bg-[#202c33] border-white/5 text-[#e9edf0] hover:bg-[#2a3942]" 
                    : "bg-[#F7F7F8] border-[#EEEEEE] text-primary hover:bg-white hover:shadow-lg"
                )}
              >
                {theme === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
              </button>

              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={cn(
                  "lg:hidden w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 hover:shadow-lg active:scale-90 border",
                  theme === 'dark' 
                    ? "bg-[#202c33] border-white/5 text-[#e9edf0] hover:bg-[#2a3942]" 
                    : "bg-[#F7F7F8] border-[#EEEEEE] text-primary hover:bg-white"
                )}
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onToggleTheme} 
                  className={cn(
                    "hidden lg:flex h-10 w-10 items-center justify-center rounded-xl transition-all shadow-sm shrink-0 border border-transparent",
                    theme === 'dark' 
                      ? "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942] hover:text-white" 
                      : "bg-[#f7f7f8] text-[#6b7280] border-[#e9edef] hover:bg-primary hover:text-white"
                  )}
                >
                  {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </Button>

                <div 
                  className="hidden sm:flex flex-col items-end leading-none cursor-pointer group/user"
                  onClick={() => handleNavigate('profile')}
                >
                  <span className={cn("text-xs font-black italic group-hover/user:text-accent transition-colors", theme === 'dark' ? "text-white" : "text-primary")}>{currentUser.name}</span>
                  <span className={cn("text-[9px] font-bold uppercase tracking-widest", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}>@{currentUser.username}</span>
                </div>
                <div 
                  className={cn("w-10 h-10 rounded-xl overflow-hidden shadow-sm hover:scale-105 hover:ring-2 hover:ring-accent transition-all cursor-pointer border", theme === 'dark' ? "border-white/10" : "border-[#F0E7FF]")}
                  onClick={() => handleNavigate('profile')}
                >
                  <img src={currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.name}&background=EC4899&color=fff`} className="w-full h-full object-cover" />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("hidden sm:flex hover:text-red-500 rounded-xl", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}
                  onClick={onLogout}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={cn("absolute top-[72px] left-4 right-4 lg:hidden backdrop-blur-3xl rounded-[28px] shadow-2xl overflow-hidden z-[100] border", theme === 'dark' ? "bg-[#111b21]/95 border-[#222e35] shadow-black/40" : "bg-white/95 border-[#F0E7FF] shadow-black/10")}
            >
              <div className="p-4 space-y-1.5">
                {menuItems.map((item, idx) => (
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 + 0.1, duration: 0.5 }}
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-300 group",
                      currentPage === item.id 
                        ? (theme === 'dark' ? "bg-white text-black shadow-lg" : "bg-black text-white shadow-lg shadow-black/10") 
                        : (theme === 'dark' ? "hover:bg-[#202c33] text-[#8696a0] hover:text-white" : "hover:bg-[#F7F7F8] text-[#666666] hover:text-black")
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-[14px] flex items-center justify-center transition-all duration-300",
                        currentPage === item.id ? "bg-white/10" : (theme === 'dark' ? "bg-[#202c33] border border-white/5" : "bg-[#FAFAFA] shadow-sm border border-[#EEEEEE] group-hover:scale-110")
                      )}>
                        <item.icon className={cn("w-4.5 h-4.5", currentPage === item.id ? "text-white" : "text-primary")} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em]">{item.label}</span>
                    </div>
                    <ChevronRight className={cn(
                      "w-3.5 h-3.5 transition-transform duration-300",
                      currentPage === item.id ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                    )} />
                  </motion.button>
                ))}
                
                <Separator className={cn("my-3", theme === 'dark' ? "bg-[#222e35]" : "bg-[#F0E7FF]/50")} />
                
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  onClick={onLogout}
                  className={cn("w-full flex items-center gap-3 p-3 rounded-2xl text-red-500 transition-all duration-300", theme === 'dark' ? "hover:bg-red-950/20" : "hover:bg-red-50")}
                >
                  <div className={cn("w-9 h-9 rounded-[14px] flex items-center justify-center border", theme === 'dark' ? "bg-[#202c33] border-red-950/30" : "bg-white shadow-sm border border-red-50")}>
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em]">LOGOUT SESSION</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content Area */}
      <main className={cn("flex-1 overflow-hidden relative transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a]" : "bg-[#FAFAFE]")}>
        {children}
      </main>
    </div>
  );
}
