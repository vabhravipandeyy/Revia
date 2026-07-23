import {
  apiFetch,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from '@/src/utils/apiFetch';

interface SignupResponse {
  message: string;
  user: {
    userId: string;
    email: string;
    name: string;
    username: string;
    gender: string;
    age: number;
    bio: string;
    avatar: string;
    createdAt: string;
  };
}

interface LoginResponse {
  message: string;
  tokens: {
    accessToken: string;
    idToken?: string;
    refreshToken?: string;
    expiresIn: number;
    tokenType: string;
  };
}

interface MeResponse {
  user: {
    userId: string;
    email: string;
    name: string;
    username: string;
    gender: string;
    age: number;
    bio: string;
    avatar: string;
    createdAt: string | null;
  };
}

interface UpdateProfilePayload {
  name: string;
  username: string;
  gender: string;
  age: number;
  bio: string;
  avatar: string;
}

interface BasicMessageResponse {
  message: string;
}

export async function signup(
  email: string,
  password: string,
  profile: {
    name: string;
    username: string;
    gender: string;
    age: number;
    bio?: string;
  }
) {
  return apiFetch<SignupResponse & { requiresVerification?: boolean }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, ...profile }),
  });
}

export async function verifySignup(email: string, otp: string) {
  return apiFetch<BasicMessageResponse>('/auth/signup/verify', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
}

export async function resendSignupOtp(email: string) {
  return apiFetch<BasicMessageResponse>('/auth/signup/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function login(email: string, password: string) {
  const response = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  setStoredToken(response.tokens.accessToken);
  return response;
}

export async function getMe() {
  return apiFetch<MeResponse>('/auth/me', {
    method: 'GET',
    auth: true,
    logoutOnUnauthorized: true,
  });
}

export async function updateProfile(profile: UpdateProfilePayload) {
  return apiFetch<MeResponse & { message: string }>('/users/me', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(profile),
  });
}

export async function requestPasswordReset(email: string) {
  return apiFetch<BasicMessageResponse>('/auth/forgot-password/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(email: string, otp: string, newPassword: string) {
  return apiFetch<BasicMessageResponse>('/auth/forgot-password/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<BasicMessageResponse>('/auth/change-password', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function requestDeleteAccountOtp() {
  return apiFetch<BasicMessageResponse>('/users/delete-account/request', {
    method: 'POST',
    auth: true,
  });
}

export async function confirmDeleteAccount(otp: string) {
  return apiFetch<BasicMessageResponse>('/users/delete-account/confirm', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ otp }),
  });
}

export function logout() {
  clearStoredToken();
}

export function getToken() {
  return getStoredToken();
}
