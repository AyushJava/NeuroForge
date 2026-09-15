import React from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { projectService } from '@/services/projectService';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import ProjectWizard, { ProjectFormValues } from '@/components/projects/ProjectWizard';
import { useToast } from '@/hooks/use-toast';

export default function CreateProjectPage() {
  const [, setLocation] = useLocation();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const basePath = role === 'org-admin' ? '/org-admin/projects' : '/project-manager/projects';

  const mutation = useMutation({
    mutationFn: (data: ProjectFormValues) =>
      projectService.create({
        projectName:    data.projectName,
        description:    data.description,
        status:         data.status || 'ACTIVE',
        startDate:      data.startDate || undefined,
        endDate:        data.endDate   || undefined,
        methodology:    data.methodology,
        techStack:      data.techStack,
        organizationId: data.organizationId,
      }),
    onSuccess: (res) => {
      const project = res.data?.data;
      // Refresh the project list
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // Refresh the owning organisation's stats so "Projects" count updates
      if (project?.organizationId) {
        queryClient.invalidateQueries({ queryKey: ['org-stats', project.organizationId] });
      }
      toast({ title: 'Project created!', description: 'Your new project is ready.' });
      setLocation(project?.id ? `${basePath}/${project.id}` : basePath);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create project.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="Create Project" />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <Link href={basePath} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6 transition-colors w-fit">
              <ArrowLeft className="w-4 h-4" /> Back to Projects
            </Link>

            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Create New Project</h2>
                  <p className="text-sm text-muted-foreground">Fill in the details to create a new project</p>
                </div>
              </div>

              <ProjectWizard
                onSubmit={async (data: ProjectFormValues) => { await mutation.mutateAsync(data); }}
                isLoading={mutation.isPending}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
