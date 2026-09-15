import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useSearchParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, LayoutGrid, List, Search } from 'lucide-react';
import { projectService, Project } from '@/services/projectService';
import { organizationService, Organization } from '@/services/organizationService';
import { useAuth } from '@/context/AuthContext';
import { canManageProjects, getProjectBasePath } from '@/lib/roleUtils';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import ProjectCard from '@/components/projects/ProjectCard';
import ProjectTable from '@/components/projects/ProjectTable';
import ProjectLoadingSkeleton from '@/components/projects/ProjectLoadingSkeleton';
import ProjectEmptyState from '@/components/projects/ProjectEmptyState';
import ConfirmDialog from '@/components/projects/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';

const PAGE_SIZE = 9;
const STATUSES = ['ALL', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED', 'INACTIVE'];

export default function ProjectListPage() {
  const [, setLocation] = useLocation();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const basePath = getProjectBasePath(role);
  const canEdit  = canManageProjects(role);
  const specId = searchParams.get('spec');

  // For org-admin and project-manager, get organizations to filter projects
  // Also use the user's organizationId from JWT if available
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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', role, activeOrg?.id],
    queryFn: () => {
      if ((role === 'org-admin' || role === 'project-manager') && activeOrg?.id) {
        return projectService.getByOrganization(activeOrg.id).then(r => r.data);
      }
      return projectService.getAll().then(r => r.data);
    },
    enabled: (role !== 'org-admin' && role !== 'project-manager') || !!activeOrg?.id,
  });

  const projects: Project[] = data?.data || [];

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = !search ||
        p.projectName.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.organizationName || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = status === 'ALL' || p.status === status;
      return matchSearch && matchStatus;
    });
  }, [projects, search, status]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // If spec parameter is present, navigate to the first project's test cases tab
  useEffect(() => {
    if (specId && paginated.length > 0) {
      setLocation(`${basePath}/${paginated[0].id}?tab=test-cases&spec=${specId}`);
    }
  }, [specId, paginated, basePath, setLocation]);

  const deleteMutation = useMutation({
    mutationFn: (project: Project) => projectService.delete(project.id),
    onSuccess: (_, project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // Refresh the owning organisation's stats so the project count stays accurate
      if (project.organizationId) {
        queryClient.invalidateQueries({ queryKey: ['org-stats', project.organizationId] });
      }
      toast({ title: 'Project deleted', description: 'The project has been removed.' });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete project.', variant: 'destructive' });
    },
  });

  const inputClass = 'bg-background border border-border rounded-lg px-4 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all';

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="Projects" />
        <main className="flex-1 p-8 overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                {canEdit ? 'All Projects' : 'My Projects'}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {canEdit ? 'Manage and track all your projects' : 'View your assigned projects'}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setLocation(`${basePath}/new`)}
                className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects..."
                className={`${inputClass} pl-9 w-full`}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              className={inputClass}
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</option>)}
            </select>
            <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
              <button
                onClick={() => setView('grid')}
                className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('table')}
                className={`p-1.5 rounded-md transition-colors ${view === 'table' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-white'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Count */}
          {!isLoading && (
            <p className="text-xs text-muted-foreground mb-4">
              {filtered.length} project{filtered.length !== 1 ? 's' : ''} found
            </p>
          )}

          {isLoading && <ProjectLoadingSkeleton rows={6} variant={view === 'table' ? 'table' : 'cards'} />}

          {isError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-red-400 text-sm">
              Failed to load projects. Make sure the backend is running.
            </div>
          )}

          {!isLoading && !isError && paginated.length === 0 && (
            <ProjectEmptyState
              title="No Projects Found"
              message={search || status !== 'ALL' ? 'Try adjusting your filters.' : canEdit ? 'Get started by creating your first project.' : 'No projects have been assigned to you yet.'}
              action={canEdit ? { label: 'New Project', onClick: () => setLocation(`${basePath}/new`) } : undefined}
            />
          )}

          {!isLoading && !isError && paginated.length > 0 && (
            <>
              {view === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginated.map(p => (
                    <ProjectCard key={p.id} project={p} basePath={basePath} showViewDetails={role !== 'org-admin'} />
                  ))}
                </div>
              ) : (
                <ProjectTable
                  projects={paginated}
                  basePath={basePath}
                  onDelete={canEdit ? setDeleteTarget : undefined}
                  canEdit={canEdit}
                />
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-white hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-white hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {canEdit && (
        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete Project"
          message={`Are you sure you want to delete "${deleteTarget?.projectName}"? This will also remove all sprints, tasks, and member assignments.`}
          confirmLabel="Delete"
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
