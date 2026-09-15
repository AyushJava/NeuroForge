import { authApi } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;      // e.g. "ROLE_DEVELOPER" from backend JWT
  organizationId?: number; // Organization ID from backend
  approvalStatus?: string; // e.g. "APPROVED", "PENDING", "REJECTED"
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function saveTokens(tokens: TokenPair) {
  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
}

function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const authService = {

  // ── Registration: Step 1 — send OTP ────────────────────────────────────────
  // POST /auth/send-otp  { email }
  sendRegistrationOtp: async (email: string) => {
    const { data } = await authApi.post('/send-otp', { email });
    return data; // { success, message }
  },

  // ── Check if email has an accepted invitation ──────────────────────────────
  // GET /auth/check-invitation?email={email}
  checkInvitation: async (email: string) => {
    const { data } = await authApi.get(`/check-invitation?email=${encodeURIComponent(email)}`);
    return data; // { hasInvitation: boolean, role?: string }
  },

  // ── Registration: Step 2 — register with OTP ────────────────────────────────
  // POST /auth/register  { name, username, role, email, otp, password, organizationId }
  register: async (payload: {
    name: string;
    username: string;
    role: string;
    email: string;
    otp: string;
    password: string;
    organizationId?: number;
  }) => {
    const { data } = await authApi.post('/register', payload);
    return data; // { success, message }
  },

  // ── Login ──────────────────────────────────────────────────────────────────
  // POST /auth/login  { email, password }
  // Backend returns ApiResponse<LoginResponse> where LoginResponse has:
  //   accessToken, refreshToken, userId, name, email, username, role, organizationId
  login: async (email: string, password: string): Promise<AuthUser> => {
    const { data } = await authApi.post('/login', { email, password });
    const resp = data.data; // LoginResponse

    saveTokens({ accessToken: resp.accessToken, refreshToken: resp.refreshToken });

    const user: AuthUser = {
      id:    String(resp.userId ?? ''),
      name:  resp.name  ?? email,
      email: resp.email ?? email,
      role:  resp.role  ?? 'ROLE_USER',
      organizationId: resp.organizationId,
    };
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  // ── Forgot password: Step 1 — send OTP ─────────────────────────────────────
  sendForgotPasswordOtp: async (email: string) => {
    const { data } = await authApi.post('/forgot-password/send-otp', { email });
    return data;
  },

  // ── Forgot password: Step 2 — reset with OTP + new password ─────────────────
  resetPassword: async (email: string, otp: string, newPassword: string) => {
    const { data } = await authApi.post('/reset-password', { email, otp, newPassword });
    return data;
  },

  // ── Refresh token ───────────────────────────────────────────────────────────
  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');
    const { data } = await authApi.post('/refresh-token', { refreshToken });
    const tokens: TokenPair = {
      accessToken:  data.data.accessToken,
      refreshToken: data.data.refreshToken ?? refreshToken,
    };
    saveTokens(tokens);
    return tokens;
  },

  // ── Logout (client-side only) ─────────────────────────────────────────────
  logout: () => {
    clearTokens();
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
  },

  // ── Helpers ─────────────────────────────────────────────────────────────────
  getAccessToken: () => localStorage.getItem('accessToken'),

  getCurrentUser: (): AuthUser | null => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },

  isAuthenticated: () => !!localStorage.getItem('accessToken'),

  // ── OAuth2 Configuration Check ───────────────────────────────────────────────
  // GET /oauth2/google/config
  checkOAuthConfig: async () => {
    const { data } = await authApi.get('/oauth2/google/config');
    return data; // { success, message, data: { clientId, authUrl, redirectUri } }
  },
};
