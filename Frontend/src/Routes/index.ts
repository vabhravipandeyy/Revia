export type Page =
  | 'login'
  | 'register'
  | 'dashboard'
  | 'chat'
  | 'profile'
  | 'settings'
  | 'create-agent'
  | 'spaces';

export interface AppRoute {
  page: Page;
  agentId?: string | null;
  spaceId?: string | null;
}

const PAGE_PATHS: Record<Page, string> = {
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  chat: '/chat',
  profile: '/profile',
  settings: '/settings',
  'create-agent': '/create-agent',
  spaces: '/spaces',
};

const PATH_TO_PAGE = new Map<string, Page>(
  Object.entries(PAGE_PATHS).map(([page, path]) => [path, page as Page])
);

export function getPathForRoute(route: AppRoute) {
  const path = PAGE_PATHS[route.page] || '/login';
  const searchParams = new URLSearchParams();

  if (route.agentId) {
    searchParams.set('agent', route.agentId);
  }

  if (route.spaceId) {
    searchParams.set('space', route.spaceId);
  }

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export function getRouteFromLocation(locationLike = window.location): AppRoute {
  const page = PATH_TO_PAGE.get(locationLike.pathname) || 'login';
  const searchParams = new URLSearchParams(locationLike.search);

  return {
    page,
    agentId: searchParams.get('agent'),
    spaceId: searchParams.get('space'),
  };
}

export function replaceRoute(route: AppRoute) {
  const nextPath = getPathForRoute(route);
  window.history.replaceState({}, '', nextPath);
}

export function pushRoute(route: AppRoute) {
  const nextPath = getPathForRoute(route);
  window.history.pushState({}, '', nextPath);
}

export function isProtectedPage(page: Page) {
  return page !== 'login' && page !== 'register';
}
