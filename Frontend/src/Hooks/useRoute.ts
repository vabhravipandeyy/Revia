import { useCallback, useEffect, useState } from 'react';
import {
  AppRoute,
  getPathForRoute,
  getRouteFromLocation,
  pushRoute,
  replaceRoute,
} from '@/src/routes';

export function useRoute() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());

  useEffect(() => {
    const normalizedRoute = getRouteFromLocation();
    const normalizedPath = getPathForRoute(normalizedRoute);
    const currentPath = `${window.location.pathname}${window.location.search}`;

    if (normalizedPath !== currentPath) {
      replaceRoute(normalizedRoute);
      setRoute(normalizedRoute);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = getRouteFromLocation();
      const normalizedPath = getPathForRoute(nextRoute);
      const currentPath = `${window.location.pathname}${window.location.search}`;

      if (normalizedPath !== currentPath) {
        replaceRoute(nextRoute);
      }

      setRoute(nextRoute);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute, options?: { replace?: boolean }) => {
    if (options?.replace) {
      replaceRoute(nextRoute);
    } else {
      pushRoute(nextRoute);
    }

    setRoute(getRouteFromLocation());
  }, []);

  return {
    route,
    navigate,
  };
}
