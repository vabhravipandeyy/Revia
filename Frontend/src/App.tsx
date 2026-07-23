/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Agent, User, Message, ChatSimulationSettings } from './types';
import { useAuthBootstrap } from './hooks/useAuth';
import { useRoute } from './hooks/useRoute';
import { AppRoute, isProtectedPage, Page } from './routes';
import { getMe, login, logout, signup } from './services/authService';
import { deletePersona, listPersonas, mapPersonaToAgent, updatePersona } from './services/personaService';
import { UNAUTHORIZED_EVENT } from './utils/apiFetch';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import CreateAgent from './pages/CreateAgent';
import Spaces from './pages/Spaces';
import Shell from './components/layout/Shell';

const CHAT_SETTINGS_STORAGE_KEY = 'revia-chat-settings';
const DEFAULT_CHAT_SETTINGS: ChatSimulationSettings = {
  realisticMode: true,
  minResponseDelaySeconds: 10,
  maxResponseDelaySeconds: 20,
  autoScrollToLatest: true,
  spontaneousEnabled: true,
  spontaneousFrequency: 'medium',
  lateNightMessagesEnabled: false,
};

function loadInitialChatSettings(): ChatSimulationSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_CHAT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(CHAT_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CHAT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<ChatSimulationSettings>;
    const min = Number(parsed.minResponseDelaySeconds);
    const max = Number(parsed.maxResponseDelaySeconds);

    // Migration: reset stale timing windows outside the new realtime range.
    if ((Number.isFinite(min) && (min < 5 || min > 30)) || (Number.isFinite(max) && (max < 5 || max > 30))) {
      window.localStorage.removeItem(CHAT_SETTINGS_STORAGE_KEY);
      return DEFAULT_CHAT_SETTINGS;
    }

    return {
      realisticMode: parsed.realisticMode ?? DEFAULT_CHAT_SETTINGS.realisticMode,
      minResponseDelaySeconds: Number.isFinite(min) ? min : DEFAULT_CHAT_SETTINGS.minResponseDelaySeconds,
      maxResponseDelaySeconds: Number.isFinite(max) ? max : DEFAULT_CHAT_SETTINGS.maxResponseDelaySeconds,
      autoScrollToLatest: parsed.autoScrollToLatest ?? DEFAULT_CHAT_SETTINGS.autoScrollToLatest,
      spontaneousEnabled: (parsed as any).spontaneousEnabled ?? DEFAULT_CHAT_SETTINGS.spontaneousEnabled,
      spontaneousFrequency: (parsed as any).spontaneousFrequency ?? DEFAULT_CHAT_SETTINGS.spontaneousFrequency,
      lateNightMessagesEnabled: (parsed as any).lateNightMessagesEnabled ?? DEFAULT_CHAT_SETTINGS.lateNightMessagesEnabled,
    };
  } catch (_error) {
    return DEFAULT_CHAT_SETTINGS;
  }
}

function mapApiUserToUser(user: {
  userId: string;
  email: string;
  name?: string;
  username?: string;
  gender?: string;
  age?: number;
  bio?: string;
  avatar?: string;
  createdAt: string | null;
}): User {
  const email = user.email || 'user@example.com';
  const localPart = email.split('@')[0] || 'user';
  const cleanedLocalPart = localPart.replace(/\d+$/g, '');
  const normalizedName = cleanedLocalPart
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  const fallbackName = normalizedName || 'User';
  const fallbackUsername = cleanedLocalPart || localPart || 'user';

  return {
    userId: user.userId,
    name: user.name?.trim() || fallbackName,
    username: user.username?.trim() || fallbackUsername,
    email,
    gender: (user.gender || 'male') as User['gender'],
    age: Number(user.age) || 19,
    avatar:
      user.avatar ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fallbackName)}`,
    bio: user.bio || 'Digital explorer passionate about technology and meaningful conversations.',
    createdAt: user.createdAt,
  };
}

function getAgentActivityTimestamp(agent: Agent) {
  return new Date(agent.lastMessageAt || agent.lastSeen || 0).getTime();
}

function sortAgentsByPriority(input: Agent[]) {
  return [...input].sort((left, right) => {
    if (left.isArchived !== right.isArchived) {
      return left.isArchived ? 1 : -1;
    }

    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    const rightActivity = getAgentActivityTimestamp(right);
    const leftActivity = getAgentActivityTimestamp(left);

    if (rightActivity !== leftActivity) {
      return rightActivity - leftActivity;
    }

    return left.name.localeCompare(right.name);
  });
}

export default function App() {
  const { route, navigate } = useRoute();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSettings, setChatSettings] = useState<ChatSimulationSettings>(loadInitialChatSettings);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (window.localStorage.getItem('revia-global-theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });
  const { isRestoringSession, authUser, setAuthUser } = useAuthBootstrap();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('revia-global-theme', theme);
    }
  }, [theme]);
  const currentPage = route.page;
  const selectedAgentId = route.agentId || null;
  const selectedSpaceId = route.spaceId || null;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(CHAT_SETTINGS_STORAGE_KEY, JSON.stringify(chatSettings));
  }, [chatSettings]);

  useEffect(() => {
    let mounted = true;

    async function hydratePersonas() {
      if (!authUser) {
        if (mounted) {
          setAgents([]);
        }
        return;
      }

      try {
        const response = await listPersonas();
        if (mounted) {
          setAgents(sortAgentsByPriority(response.personas.map(mapPersonaToAgent)));
        }
      } catch (error) {
        if (mounted) {
          setAgents([]);
        }
      }
    }

    void hydratePersonas();

    return () => {
      mounted = false;
    };
  }, [authUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthUser(null);
      setCurrentUser(null);
      setAgents([]);
      navigate({ page: 'login' }, { replace: true });
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [navigate, setAuthUser]);

  useEffect(() => {
    if (authUser) {
      setCurrentUser(mapApiUserToUser(authUser));
      if (route.page === 'login' || route.page === 'register') {
        navigate({ page: 'dashboard' }, { replace: true });
      }
      return;
    }

    if (!isRestoringSession) {
      setCurrentUser(null);
      if (isProtectedPage(route.page)) {
        navigate({ page: 'login' }, { replace: true });
      }
    }
  }, [authUser, isRestoringSession, route.page, navigate]);

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    const meResponse = await getMe();
    setAuthUser(meResponse.user);
    setCurrentUser(mapApiUserToUser(meResponse.user));
    navigate({ page: 'dashboard' }, { replace: true });
  };

  const handleRegister = async (
    email: string,
    password: string,
    profile: {
      name: string;
      username: string;
      gender: string;
      age: number;
      bio?: string;
    }
  ) => {
    await signup(email, password, profile);
  };

  const handleLogout = () => {
    logout();
    setAuthUser(null);
    setCurrentUser(null);
    navigate({ page: 'login' }, { replace: true });
  };

  const navigateToPage = (page: Page, options?: { agentId?: string | null; spaceId?: string | null; replace?: boolean }) => {
    if (!currentUser && isProtectedPage(page)) {
      navigate({ page: 'login' }, { replace: true });
      return;
    }

    const nextRoute: AppRoute = {
      page,
      agentId: options?.agentId ?? null,
      spaceId: options?.spaceId ?? null,
    };

    navigate(nextRoute, { replace: options?.replace });
  };

  const handleUpdateProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  const startChat = (agentId: string, spaceId?: string) => {
    navigateToPage('chat', {
      agentId,
      spaceId: spaceId || null,
    });
  };

  const addAgent = (newAgent: Agent) => {
    setAgents(prev => sortAgentsByPriority([newAgent, ...prev]));
  };

  const updateAgent = (updatedAgent: Agent) => {
    setAgents(prev => sortAgentsByPriority(prev.map(a => a.id === updatedAgent.id ? updatedAgent : a)));
  };

  const deleteAgent = async (agentId: string) => {
    const existingAgent = agents.find(agent => agent.id === agentId);
    setAgents(prev => prev.filter(a => a.id !== agentId));

    try {
      await deletePersona(agentId);
    } catch (error) {
      if (existingAgent) {
        setAgents(prev => sortAgentsByPriority([existingAgent, ...prev]));
      }
    }
  };

  const togglePin = async (agentId: string) => {
    const existingAgent = agents.find((agent) => agent.id === agentId);
    if (!existingAgent) {
      return;
    }

    const nextPinned = !existingAgent.isPinned;
    setAgents(prev => sortAgentsByPriority(prev.map(a => a.id === agentId ? { ...a, isPinned: nextPinned } : a)));

    try {
      await updatePersona(agentId, {
        personaConfig: {
          isPinned: nextPinned,
          isArchived: Boolean(existingAgent.isArchived),
        },
      });
    } catch (_error) {
      setAgents(prev => sortAgentsByPriority(prev.map(a => a.id === agentId ? { ...a, isPinned: existingAgent.isPinned } : a)));
    }
  };

  const toggleArchive = async (agentId: string) => {
    const existingAgent = agents.find((agent) => agent.id === agentId);
    if (!existingAgent) {
      return;
    }

    const nextArchived = !existingAgent.isArchived;
    setAgents(prev => sortAgentsByPriority(prev.map(a => a.id === agentId ? { ...a, isArchived: nextArchived } : a)));

    try {
      await updatePersona(agentId, {
        personaConfig: {
          isPinned: Boolean(existingAgent.isPinned),
          isArchived: nextArchived,
        },
      });
    } catch (_error) {
      setAgents(prev => sortAgentsByPriority(prev.map(a => a.id === agentId ? { ...a, isArchived: existingAgent.isArchived } : a)));
    }
  };

  const recordAgentActivity = (agentId: string, text: string, timestamp: Date | string) => {
    const nextTimestamp = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
    const nextText = text.trim();

    setAgents(prev =>
      sortAgentsByPriority(
        prev.map((agent) =>
          agent.id === agentId
            ? {
              ...agent,
              lastMessage: nextText || agent.lastMessage,
              lastMessageAt: nextTimestamp,
            }
            : agent
        )
      )
    );
  };

  if (isRestoringSession) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }

  if (currentPage === 'login') {
    return <Login onLogin={handleLogin} onNavigateToRegister={() => navigateToPage('register')} />;
  }

  if (currentPage === 'register') {
    return <Register onRegister={handleRegister} onNavigateToLogin={() => navigateToPage('login')} />;
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} onNavigateToRegister={() => navigateToPage('register')} />;
  }

  return (
    <Shell 
      currentPage={currentPage} 
      currentUser={currentUser} 
      onNavigate={(page: Page) => navigateToPage(page)} 
      onLogout={handleLogout}
      theme={theme}
      onToggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
    >
      {currentPage === 'dashboard' && (
        <Dashboard 
          user={currentUser!} 
          agents={agents}
          onStartChat={startChat} 
          onNavigateToCreate={() => navigateToPage('create-agent')}
          onNavigateToSpaces={(spaceId) => navigateToPage('spaces', { spaceId })}
          theme={theme}
        />
      )}
      {currentPage === 'chat' && (
        <Chat 
          activeAgentId={selectedAgentId} 
          activeSpaceId={selectedSpaceId}
          agents={agents} 
          chatSettings={chatSettings}
          onAgentSelect={(id) => {
            navigateToPage('chat', { agentId: id });
          }}
          onDeleteAgent={deleteAgent}
          onTogglePin={togglePin}
          onToggleArchive={toggleArchive}
          onAgentActivity={recordAgentActivity}
          onBack={() => {
            if (selectedAgentId) {
              navigateToPage('chat');
            } else {
              navigateToPage('dashboard');
            }
          }}
          theme={theme}
        />
      )}
      {currentPage === 'profile' && (
        <Profile user={currentUser!} onUpdate={handleUpdateProfile} onLogout={handleLogout} theme={theme} />
      )}
      {currentPage === 'settings' && (
        <Settings settings={chatSettings} onUpdate={setChatSettings} theme={theme} />
      )}
      {currentPage === 'create-agent' && (
        <CreateAgent 
          agents={agents}
          onAddAgent={addAgent} 
          onUpdateAgent={updateAgent}
          onDeleteAgent={deleteAgent}
          onTogglePin={togglePin}
          onToggleArchive={toggleArchive}
          onLaunchAgentChat={(agentId) => navigateToPage('chat', { agentId })}
          theme={theme}
        />
      )}
      {currentPage === 'spaces' && (
        <Spaces 
          agents={agents}
          activeSpaceId={selectedSpaceId}
          onNavigateToChat={(agentId, spaceId) => startChat(agentId, spaceId)} 
          onBack={() => navigateToPage('dashboard')}
          theme={theme}
        />
      )}
    </Shell>
  );
}
