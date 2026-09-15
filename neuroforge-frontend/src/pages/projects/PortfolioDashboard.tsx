import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, CheckCircle2, Clock, AlertCircle, TrendingUp, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { projectService, Project } from '@/services/projectService';
import { organizationService, Organization } from '@/services/organizationService';
import { useAuth } from '@/context/AuthContext';
import { canManageProjects } from '@/lib/roleUtils';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import HealthBadge from '@/components/projects/HealthBadge';
import ProgressBar from '@/components/projects/ProgressBar';

interface PortfolioProject {
  id: number;
  projectName: string;
  description?: string;
  status: string;
  health: string;
  organizationName?: string;
  startDate?: string;
  endDate?: string;
}

export default function PortfolioDashboard() {
  const { user, role } = useAuth();
  const basePath = role === 'org-admin' ? '/org-admin/projects' : '/project-manager/projects';
  const canEdit = canManageProjects(role);

  // For org-admin and project-manager, get organizations to filter projects
  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll().then(r => r.data),
    enabled: role === 'org-admin' || role === 'project-manager',
  });
  const orgs: Organization[] = orgsData?.data || [];
  
  // Use user's organizationId from JWT if available, otherwise fall back to most recent org
  const activeOrg = user?.organizationId 
    ? orgs.find(o => o.id === user.organizationId) || (orgs.length > 0 ? orgs[orgs.length - 1] : null)
    : (orgs.length > 0 ? orgs[orgs.length - 1] : null);

  const { data, isLoading } = useQuery({
    queryKey: ['portfolio', role, activeOrg?.id],
    queryFn: () => {
      if ((role === 'org-admin' || role === 'project-manager') && activeOrg?.id) {
        return projectService.getPortfolio(activeOrg.id).then(r => r.data);
      }
      return projectService.getAll().then(r => r.data);
    },
    enabled: (role !== 'org-admin' && role !== 'project-manager') || !!activeOrg?.id,
  });
  const projects: PortfolioProject[] = data?.data || [];

  // Fetch project stats to get task completion rates
  const { data: projectStatsData } = useQuery({
    queryKey: ['project-stats', projects.map(p => p.id)],
    queryFn: () => Promise.all(projects.map(p => projectService.getStats(p.id).then(r => r.data))),
    enabled: projects.length > 0,
  });
  const projectStats: any[] = projectStatsData || [];

  // Extract actual stats data from nested response
  const actualProjectStats = projectStats.map(stat => stat?.data || stat);

  const stats = useMemo(() => {
    const total      = projects.length;
    const active     = projects.filter(p => p.status === 'ACTIVE').length;
    const completed  = projects.filter(p => p.status === 'COMPLETED').length;
    const onHold     = projects.filter(p => p.status === 'ON_HOLD').length;
    const archived   = projects.filter(p => p.status === 'ARCHIVED').length;

    // Calculate task-based completion rate
    const totalTasks = actualProjectStats.reduce((sum, stat) => sum + (stat?.totalTasks || 0), 0);
    const completedTasks = actualProjectStats.reduce((sum, stat) => sum + (stat?.completedTasks || 0), 0);
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { total, active, completed, onHold, archived, taskCompletionRate };
  }, [projects, actualProjectStats]);

  const statusGroups = [
    { status: 'ACTIVE',    icon: TrendingUp,    color: 'text-emerald-400', bg: 'bg-emerald-500/10', count: stats.active },
    { status: 'COMPLETED', icon: CheckCircle2,  color: 'text-blue-400',    bg: 'bg-blue-500/10',    count: stats.completed },
    { status: 'ON_HOLD',   icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   count: stats.onHold },
    { status: 'ARCHIVED',  icon: AlertCircle,   color: 'text-slate-400',   bg: 'bg-slate-500/10',   count: stats.archived },
  ];

  const recentProjects = [...projects]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="Portfolio Dashboard" />
        <main className="flex-1 p-8 overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Project Portfolio</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Overview of all {stats.total} project{stats.total !== 1 ? 's' : ''}
              </p>
            </div>
            {canEdit && (
              <Link
                href={`${basePath}`}
                className="text-sm text-primary hover:text-blue-400 transition-colors"
              >
                View All Projects →
              </Link>
            )}
          </div>

          {isLoading && (
            <div className="flex justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {!isLoading && (
            <>
              {/* Status summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {statusGroups.map(g => (
                  <div key={g.status} className="bg-card border border-border rounded-xl p-5">
                    <div className={`w-9 h-9 rounded-lg ${g.bg} flex items-center justify-center mb-3`}>
                      <g.icon className={`w-4 h-4 ${g.color}`} />
                    </div>
                    <p className="text-muted-foreground text-xs font-medium mb-1">{g.status}</p>
                    <p className="text-2xl font-bold text-white">{g.count}</p>
                  </div>
                ))}
              </div>

              {/* Status distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Portfolio Composition</h3>
                  {stats.total > 0 ? (
                    <div className="space-y-3">
                      {statusGroups.map(g => (
                        <div key={g.status}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">{g.status}</span>
                            <span className="text-xs font-medium text-white">
                              {g.count} ({Math.round((g.count / stats.total) * 100)}%)
                            </span>
                          </div>
                          <ProgressBar
                            value={Math.round((g.count / stats.total) * 100)}
                            showPercent={false}
                            size="sm"
                            color={g.status === 'ACTIVE' ? 'green' : g.status === 'COMPLETED' ? 'blue' : g.status === 'ON_HOLD' ? 'amber' : 'red'}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No projects yet</p>
                  )}
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Portfolio Stats</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Total Projects', value: stats.total, icon: FolderKanban },
                      { label: 'Active Rate', value: stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}%` : '0%', icon: TrendingUp },
                      { label: 'Task Completion Rate', value: `${stats.taskCompletionRate}%`, icon: CheckCircle2 },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                        <s.icon className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-muted-foreground flex-1">{s.label}</span>
                        <span className="text-sm font-bold text-white">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent projects */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-5 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Recent Projects</h3>
                  {canEdit && <Link href={basePath} className="text-xs text-primary hover:text-blue-400 transition-colors">View All</Link>}
                </div>
                {recentProjects.length === 0 ? (
                  <div className="p-10 text-center">
                    <FolderKanban className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-white mb-1">No projects yet</p>
                    <p className="text-xs text-muted-foreground">Create your first project to get started.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-background/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-5 py-3 font-medium">Project</th>
                          <th className="px-5 py-3 font-medium">Organization</th>
                          <th className="px-5 py-3 font-medium">Health</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 font-medium">Created</th>
                          <th className="px-5 py-3 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 text-sm">
                        {recentProjects.map(p => (
                          <tr key={p.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-white">{p.projectName}</p>
                              {p.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-xs">{p.description}</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-muted-foreground">{p.organizationName || '—'}</td>
                            <td className="px-5 py-3.5"><HealthBadge status={p.health} size="sm" /></td>
                            <td className="px-5 py-3.5"><HealthBadge status={p.status} size="sm" /></td>
                            <td className="px-5 py-3.5 text-muted-foreground text-xs">
                              {p.startDate ? new Date(p.startDate).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-5 py-3.5">
                              {canEdit && (
                                <Link href={`${basePath}/${p.id}`} className="text-xs text-primary hover:text-blue-400 transition-colors">
                                  View →
                                </Link>
                              )}
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
    </div>
  );
}
