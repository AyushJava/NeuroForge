import React from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { projectService } from '@/services/projectService';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import ProjectWizard, { ProjectFormValues } from '@/components/projects/ProjectWizard';
import { useToast } from '@/hooks/use-toast';

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const basePath = role === 'org-admin' ? '/org-admin/projects' : '/project-manager/projects';

  const { data, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectService.getById(id).then(r => r.data),
    enabled: !!id,
  });
  const project = data?.data;

  const mutation = useMutation({
    mutationFn: (formData: ProjectFormValues) =>
      projectService.update(id, {
        projectName: formData.projectName,
        description: formData.description,
        status: formData.status,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        methodology: formData.methodology,
        techStack: formData.techStack,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast({ title: 'Project updated!', description: 'Changes saved successfully.' });
      setLocation(`${basePath}/${id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to update project.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const toDateInput = (dt?: string) => dt ? new Date(dt).toISOString().split('T')[0] : '';

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="Edit Project" />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <Link href={`${basePath}/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6 transition-colors w-fit">
              <ArrowLeft className="w-4 h-4" /> Back to Project
            </Link>

            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Edit Project</h2>
                  <p className="text-sm text-muted-foreground">Update project details</p>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : project ? (
                <ProjectWizard
                  isEdit
                  defaultValues={{
                    projectName: project.projectName,
                    description: project.description || '',
                    status: project.status,
                    startDate: toDateInput(project.startDate),
                    endDate: toDateInput(project.endDate),
                    methodology: project.methodology || '',
                    techStack: project.techStack || '',
                    organizationId: project.organizationId || 0,
                  }}
                  onSubmit={async (data: ProjectFormValues) => { await mutation.mutateAsync(data); }}
                  isLoading={mutation.isPending}
                />
              ) : (
                <p className="text-sm text-red-400">Project not found.</p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
