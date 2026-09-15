import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { FolderKanban, CheckSquare, GitBranch, Activity, Loader2, TrendingUp } from 'lucide-react';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import { projectService, Project } from '@/services/projectService';
import { organizationService, Organization } from '@/services/organizationService';
import { useAuth } from '@/context/AuthContext';
import HealthBadge from '@/components/projects/HealthBadge';
import api from '@/services/api';

interface DashboardStats {
  totalProjects: number; activeProjects: number; completedProjects: number;
  totalSprints: number; totalTasks: number; completedTasks: number;
  pendingTasks: number; overallProgress: number;
}

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

export default function ProjectManagerDashboard() {
  const { user } = useAuth();
  
  // Get organizations to filter projects by active organization
  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll().then(r => r.data),
  });
  const orgs: Organization[] = orgsData?.data || [];
  
  // Use user's organizationId from JWT if available, otherwise fall back to most recent org
  const activeOrg = user?.organizationId 
    ? orgs.find(o => o.id === user.organizationId) || (orgs.length > 0 ? orgs[orgs.length - 1] : null)
    : (orgs.length > 0 ? orgs[orgs.length - 1] : null);

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', activeOrg?.id],
    queryFn: () => {
      if (activeOrg?.id) {
        return projectService.getByOrganization(activeOrg.id).then(r => r.data);
      }
      return projectService.getAll().then(r => r.data);
    },
    enabled: !activeOrg || !!activeOrg.id,
  });
  
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', activeOrg?.id],
    queryFn: () => {
      const params = activeOrg?.id ? { orgId: activeOrg.id } : {};
      return api.get<any>('/dashboard', { params }).then(r => r.data);
    },
    enabled: !activeOrg || !!activeOrg.id,
  });

  const projects: Project[] = projectsData?.data || [];
  const stats: DashboardStats | undefined = statsData?.data;
  const isLoading = projectsLoading || statsLoading;
  const recentProjects = [...projects]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="Project Manager Dashboard" />
        <main className="flex-1 p-8 overflow-y-auto">

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Project Manager Dashboard</h2>
            <p className="text-muted-foreground text-sm mt-1">Manage projects, sprints, tasks, and team activities.</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard label="Total Projects"  value={stats?.totalProjects  ?? projects.length} icon={FolderKanban} color="text-blue-400"    bg="bg-blue-500/10" />
                <StatCard label="Active Projects" value={stats?.activeProjects ?? 0}               icon={Activity}    color="text-emerald-400" bg="bg-emerald-500/10" />
                <StatCard label="Total Tasks"     value={stats?.totalTasks     ?? 0}               icon={CheckSquare} color="text-violet-400"  bg="bg-violet-500/10" />
                <StatCard label="Total Sprints"   value={stats?.totalSprints   ?? 0}               icon={GitBranch}   color="text-purple-400"  bg="bg-purple-500/10" />
              </div>

              <div className="bg-card border border-border rounded-xl shadow-sm mb-6">
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link href="/project-manager/analytics" className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-4 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg">
                    <Activity className="w-5 h-5" />
                    <span>View Analytics Dashboard</span>
                  </Link>
                  <Link href="/project-manager/quality-trends" className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium py-4 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg">
                    <TrendingUp className="w-5 h-5" />
                    <span>View Quality Trends</span>
                  </Link>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
                  <Link href="/project-manager/projects/new" className="text-xs text-primary hover:text-blue-400 transition-colors">
                    + New Project
                  </Link>
                </div>
                {recentProjects.length === 0 ? (
                  <div className="p-10 text-center">
                    <FolderKanban className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-white mb-1">No projects yet</p>
                    <Link href="/project-manager/projects/new" className="inline-block mt-2 text-xs text-primary hover:text-blue-400 transition-colors">
                      Create your first project →
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-background/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-5 py-3 font-medium">Project</th>
                          <th className="px-5 py-3 font-medium">Organization</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 font-medium">Created</th>
                          <th className="px-5 py-3 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 text-sm">
                        {recentProjects.map(p => (
                          <tr key={p.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-5 py-3.5 font-medium text-white">{p.projectName}</td>
                            <td className="px-5 py-3.5 text-muted-foreground">{p.organizationName || '—'}</td>
                            <td className="px-5 py-3.5"><HealthBadge status={p.status} size="sm" /></td>
                            <td className="px-5 py-3.5 text-muted-foreground text-xs">
                              {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-5 py-3.5">
                              <Link href={`/project-manager/projects/${p.id}`} className="text-xs text-primary hover:text-blue-400 transition-colors">
                                View →
                              </Link>
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
