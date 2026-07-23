import { useEffect, useState } from 'react';
import { getMe, getToken, logout } from '@/src/services/authService';

export function useAuthBootstrap() {
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [authUser, setAuthUser] = useState<null | {
    userId: string;
    email: string;
    name: string;
    username: string;
    gender: string;
    age: number;
    bio: string;
    avatar: string;
    createdAt: string | null;
  }>(null);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const token = getToken();

      if (!token) {
        if (mounted) {
          setIsRestoringSession(false);
        }
        return;
      }

      try {
        const response = await getMe();
        if (mounted) {
          setAuthUser(response.user);
        }
      } catch (error) {
        logout();
      } finally {
        if (mounted) {
          setIsRestoringSession(false);
        }
      }
    }

    restore();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    isRestoringSession,
    authUser,
    setAuthUser,
  };
}
