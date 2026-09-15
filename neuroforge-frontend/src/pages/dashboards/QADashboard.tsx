import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { FolderKanban, Bug, ShieldCheck, Loader2, BarChart3, FileText, FlaskConical } from 'lucide-react';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import { projectService, Project } from '@/services/projectService';
import { specificationService, Specification } from '@/services/specificationService';
import HealthBadge from '@/components/projects/HealthBadge';
import { useAuth } from '@/context/AuthContext';

export default function QADashboard() {
  const { user } = useAuth();
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', user?.organizationId],
    queryFn: () => projectService.getByOrganization(user?.organizationId).then(r => r.data),
    enabled: !!user?.organizationId,
  });

  const { data: specsData } = useQuery({
    queryKey: ['approved-specs', user?.organizationId],
    queryFn: () => specificationService.getAll({ orgId: user?.organizationId, status: 'APPROVED' }).then((r: any) => r.data.data),
    enabled: !!user?.organizationId,
  });

  const projects: Project[] = projectsData?.data || [];
  const specs: Specification[] = Array.isArray(specsData?.content) ? specsData.content : (Array.isArray(specsData) ? specsData : []);
  const activeProjects = projects.filter(p => p.status === 'ACTIVE');
  const approvedSpecs = specs.filter((s: Specification) => s.status === 'APPROVED');

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="QA Dashboard" />
        <main className="flex-1 p-8 overflow-y-auto">

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">QA Dashboard</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Welcome back, {user?.name || 'QA'}. View your testing assignments and projects below.
              </p>
            </div>
            <Link href="/qa/analytics" className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <BarChart3 className="w-4 h-4" />
              View Analytics
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-8">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-muted-foreground text-sm font-medium mb-1">Role</h3>
              <p className="text-xl font-bold text-white">QA</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
                <FolderKanban className="w-5 h-5" />
              </div>
              <h3 className="text-muted-foreground text-sm font-medium mb-1">Accessible Projects</h3>
              <p className="text-3xl font-bold text-white">{isLoading ? '—' : projects.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 mb-4">
                <Bug className="w-5 h-5" />
              </div>
              <h3 className="text-muted-foreground text-sm font-medium mb-1">Active for Testing</h3>
              <p className="text-3xl font-bold text-white">{isLoading ? '—' : activeProjects.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-muted-foreground text-sm font-medium mb-1">Approved Specs</h3>
              <p className="text-3xl font-bold text-white">{approvedSpecs.length}</p>
            </div>
          </div>

          {/* Approved Specifications for Test Generation */}
          <div className="bg-card border border-border rounded-xl shadow-sm mb-8">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Approved Specifications</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FlaskConical className="w-4 h-4 text-amber-400" />
                <span>Generate test cases from approved specs</span>
              </div>
            </div>
            {approvedSpecs.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No approved specifications available for test generation.</div>
            ) : (
              <div className="divide-y divide-border">
                {approvedSpecs.slice(0, 5).map((spec: Specification) => (
                  <div key={spec.id} className="px-6 py-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <FileText className="w-4 h-4 text-amber-400" />
                          <p className="text-sm font-medium text-white">{spec.title}</p>
                          <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                            {spec.specificationKey}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Version {spec.currentVersion} • Approved
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          // Navigate to project list with specification ID for selection
                          window.location.href = `/qa/projects?spec=${spec.id}`;
                        }}
                        className="flex items-center gap-2 text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded hover:bg-amber-500/30 transition-colors"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        Generate Tests
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Testing Projects</h2>
              <Link href="/qa/projects" className="text-xs text-primary hover:text-blue-400 transition-colors">
                View All →
              </Link>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : projects.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No projects assigned yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-background/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Project</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Organization</th>
                      <th className="px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-sm">
                    {projects.map(p => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-white">{p.projectName}</td>
                        <td className="px-5 py-3.5"><HealthBadge status={p.status} size="sm" /></td>
                        <td className="px-5 py-3.5 text-muted-foreground">{p.organizationName || '—'}</td>
                        <td className="px-5 py-3.5">
                          <Link href={`/qa/projects/${p.id}`} className="text-xs text-primary hover:text-blue-400 transition-colors">
                            Open →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
