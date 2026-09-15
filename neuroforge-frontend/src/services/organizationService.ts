import api from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrgRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'QA' | 'CLIENT';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  industry?: string;
  size?: string;
  plan: string;
  description?: string;
  logoUrl?: string;
  teamsCount: number;
  membersCount: number;
  createdAt: string;
}

export interface Team {
  id: number;
  name: string;
  description?: string;
  organizationId: number;
  leadId?: number;
  leadName?: string;
  membersCount: number;
  createdAt: string;
}

export interface TeamMember {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  teamId?: number;
  teamName?: string;
  organizationId: number;
  role: OrgRole;
  joinedAt: string;
}

export interface Invite {
  id: number;
  email: string;
  organizationId: number;
  orgName?: string;
  status: InviteStatus;
  role: OrgRole;
  createdAt: string;
  expiresAt: string;
}

export interface OrgStatsDto {
  teamsCount: number;
  membersCount: number;
  pendingInvitesCount: number;
  projectsCount: number;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  industry?: string;
  size?: string;
  plan?: string;
  description?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  industry?: string;
  size?: string;
  description?: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  leadId?: number;
  initialMemberIds?: number[];
}

export interface InviteMemberRequest {
  email: string;
  role: OrgRole;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const organizationService = {
  // Organizations
  getAll: () => api.get<any>('/organizations'),
  getPublic: () => api.get<any>('/organizations/public'),
  getById: (id: number) => api.get<any>(`/organizations/${id}`),
  create: (data: CreateOrganizationRequest) => api.post<any>('/organizations', data),
  update: (id: number, data: UpdateOrganizationRequest) => api.put<any>(`/organizations/${id}`, data),
  delete: (id: number) => api.delete(`/organizations/${id}`),
  getStats: (id: number) => api.get<any>(`/organizations/${id}/stats`),

  // Teams
  getTeams: (orgId: number) => api.get<any>(`/organizations/${orgId}/teams`),
  createTeam: (orgId: number, data: CreateTeamRequest) =>
    api.post<any>(`/organizations/${orgId}/teams`, data),
  updateTeam: (orgId: number, teamId: number, data: Partial<CreateTeamRequest>) =>
    api.put<any>(`/organizations/${orgId}/teams/${teamId}`, data),
  deleteTeam: (orgId: number, teamId: number) =>
    api.delete(`/organizations/${orgId}/teams/${teamId}`),

  // Team Members
  getTeamMembers: (orgId: number, teamId: number) =>
    api.get<any>(`/organizations/${orgId}/teams/${teamId}/members`),
  addTeamMember: (orgId: number, teamId: number, memberId: number) =>
    api.post<any>(`/organizations/${orgId}/teams/${teamId}/members`, { memberId }),
  removeTeamMember: (orgId: number, teamId: number, memberId: number) =>
    api.delete(`/organizations/${orgId}/teams/${teamId}/members/${memberId}`),

  // Members
  getMembers: (orgId: number) => api.get<any>(`/organizations/${orgId}/members`),
  removeMember: (orgId: number, memberId: number) =>
    api.delete(`/organizations/${orgId}/members/${memberId}`),

  // Invitations
  inviteMember: (orgId: number, data: InviteMemberRequest) =>
    api.post<any>(`/organizations/${orgId}/invitations`, data),
  getInvitations: (orgId: number) => api.get<any>(`/organizations/${orgId}/invitations`),
  cancelInvitation: (orgId: number, inviteId: number) =>
    api.delete(`/organizations/${orgId}/invitations/${inviteId}`),
  resendInvitation: (orgId: number, inviteId: number) =>
    api.post(`/organizations/${orgId}/invitations/${inviteId}/resend`),

  // Accept / Reject (public — no auth required)
  acceptInvitation: (token: string) => api.post('/invitations/accept', { token }),
  rejectInvitation: (token: string) => api.post('/invitations/reject', { token }),
};
