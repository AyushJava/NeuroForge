import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Users, FolderKanban, MailPlus, Users2, Loader2, Building2, Clock, X, BarChart3 } from 'lucide-react';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import { organizationService, Organization, TeamMember, OrgStatsDto } from '@/services/organizationService';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

interface UserDto { id: number; name: string; email: string; role: string; enabled?: boolean; approvalStatus?: string; }

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number | string; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center ${color} mb-4`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-muted-foreground text-sm font-medium mb-1">{label}</h3>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function OrgAdminDashboard() {
  const [showPendingUsers, setShowPendingUsers] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll().then(r => r.data),
  });
  const orgs: Organization[] = orgsData?.data || [];
  // Use user's organizationId from JWT if available, otherwise fall back to most recent org
  const activeOrg = user?.organizationId 
    ? orgs.find(o => o.id === user.organizationId) || (orgs.length > 0 ? orgs[orgs.length - 1] : null)
    : (orgs.length > 0 ? orgs[orgs.length - 1] : null);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['org-stats', activeOrg?.id],
    queryFn: () => organizationService.getStats(activeOrg!.id).then(r => r.data),
    enabled: !!activeOrg?.id,
  });
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['org-members', activeOrg?.id],
    queryFn: () => organizationService.getMembers(activeOrg!.id).then(r => r.data),
    enabled: !!activeOrg?.id,
  });
  const { data: pendingUsersData, isLoading: pendingUsersLoading } = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => api.get<any>('/users/pending').then(r => r.data),
    enabled: showPendingUsers,
  });

  const stats: OrgStatsDto | undefined = statsData?.data;
  const members: TeamMember[] = membersData?.data || [];
  const isLoading = orgsLoading || statsLoading || membersLoading;

  const approveUserMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: number; action: string }) =>
      api.put<any>(`/users/${userId}/approve`, { action }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      toast({ title: 'User Updated', description: 'User approval status has been updated.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to update user', variant: 'destructive' });
    },
  });

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="Organization Admin Dashboard" />
        <main className="flex-1 p-8 overflow-y-auto">

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Organization Admin Dashboard</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Manage your organization, teams, and projects.
              </p>
            </div>
            <Link href="/org-admin/analytics" className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <BarChart3 className="w-4 h-4" />
              View Analytics
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !activeOrg ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
              <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-white mb-1">No organization found</p>
              <p className="text-xs text-muted-foreground mb-4">Create your first organization to get started.</p>
              <Link href="/org-admin/organizations/new" className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                Create Organization
              </Link>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{activeOrg.name}</h3>
                  <p className="text-xs text-muted-foreground">/{activeOrg.slug} · {activeOrg.plan} Plan</p>
                </div>
                <Link href={`/org-admin/organizations/${activeOrg.id}`} className="ml-auto text-xs text-primary hover:text-blue-400 transition-colors">
                  Manage →
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard label="Teams"            value={stats?.teamsCount ?? 0}          icon={Users2}     color="text-blue-400"    bg="bg-blue-500/10" />
                <StatCard label="Members"          value={stats?.membersCount ?? 0}         icon={Users}      color="text-indigo-400"  bg="bg-indigo-500/10" />
                <StatCard label="Pending Invites"  value={stats?.pendingInvitesCount ?? 0}  icon={MailPlus}   color="text-amber-400"   bg="bg-amber-500/10" />
                <StatCard label="Projects"         value={stats?.projectsCount ?? 0}        icon={FolderKanban} color="text-emerald-400" bg="bg-emerald-500/10" />
              </div>

              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Members ({members.length})</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPendingUsers(true)}
                      className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                      Pending Approvals
                    </button>
                    <Link href={`/org-admin/organizations/${activeOrg.id}`} className="text-xs text-primary hover:text-blue-400 transition-colors">
                      View All →
                    </Link>
                  </div>
                </div>
                {members.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">No members yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-background/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-6 py-3 font-medium">Name</th>
                          <th className="px-6 py-3 font-medium">Email</th>
                          <th className="px-6 py-3 font-medium">Role</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-border/50">
                        {members.slice(0, 8).map(m => (
                          <tr key={m.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                  {m.userName?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <span className="font-medium text-white">{m.userName}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">{m.userEmail}</td>
                            <td className="px-6 py-4">
                              <span className="text-xs px-2 py-0.5 rounded border bg-slate-500/10 text-slate-400 border-slate-500/20">
                                {m.role}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Pending Users Modal */}
      {showPendingUsers && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-4xl shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Pending User Approvals</h3>
              <button onClick={() => setShowPendingUsers(false)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {pendingUsersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {pendingUsersData?.data?.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">No pending users awaiting approval.</div>
                ) : (
                  <div className="space-y-4">
                    {pendingUsersData?.data?.map((user: UserDto) => (
                      <div key={user.id} className="bg-background/50 border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                              {user.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className="font-medium text-white">{user.name}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                  {user.role?.replace('ROLE_', '') || 'USER'}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  PENDING
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveUserMutation.mutate({ userId: user.id, action: 'APPROVE' })}
                              disabled={approveUserMutation.isPending}
                              className="px-3 py-1.5 text-sm bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => approveUserMutation.mutate({ userId: user.id, action: 'REJECT' })}
                              disabled={approveUserMutation.isPending}
                              className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
