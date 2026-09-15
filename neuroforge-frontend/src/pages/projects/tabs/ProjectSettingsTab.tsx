import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Settings, Trash2, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import { projectService, Project } from '@/services/projectService';
import { useAuth } from '@/context/AuthContext';
import { canManageProjects, getProjectBasePath } from '@/lib/roleUtils';
import ConfirmDialog from '@/components/projects/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';

interface Props { project: Project }

export default function ProjectSettingsTab({ project }: Props) {
  const { role } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDelete, setShowDelete] = useState(false);

  const basePath = getProjectBasePath(role);
  const canEdit  = canManageProjects(role);   // PM, Org Admin, Super Admin

  const deleteMutation = useMutation({
    mutationFn: () => projectService.delete(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Project deleted', description: 'The project has been permanently removed.' });
      setLocation(basePath);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete project.', variant: 'destructive' }),
  });

  const formatDate = (dt?: string) =>
    dt ? new Date(dt).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

  return (
    <div className="space-y-6">
      {/* Project Info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Project Information</h3>
        </div>
        <div className="space-y-3 text-sm">
          {[
            { label: 'Project ID',   value: `#${project.id}` },
            { label: 'Name',         value: project.projectName },
            { label: 'Status',       value: project.status },
            { label: 'Organization', value: project.organizationName || '—' },
            { label: 'Methodology',  value: project.methodology || '—' },
            { label: 'Tech Stack',   value: project.techStack || '—' },
            { label: 'Start Date',   value: formatDate(project.startDate) },
            { label: 'End Date',     value: formatDate(project.endDate) },
            { label: 'Created',      value: formatDate(project.createdAt) },
            { label: 'Last Updated', value: formatDate(project.updatedAt) },
          ].map(row => (
            <div key={row.label} className="flex items-center">
              <span className="text-muted-foreground w-36">{row.label}</span>
              <span className="text-white font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Project */}
      {canEdit && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Edit Project</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Update the project name, description, status, or dates.
          </p>
          <Link
            href={`${basePath}/${project.id}/edit`}
            className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Edit Project Settings
          </Link>
        </div>
      )}

      {/* Danger Zone */}
      {canEdit && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Delete this project</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This will permanently delete the project along with all its sprints, tasks, and member assignments.
                This action cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 bg-red-500 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-red-600 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        title="Delete Project"
        message={`Are you sure you want to permanently delete "${project.projectName}"? All sprints, tasks, and member assignments will be deleted. This cannot be undone.`}
        confirmLabel="Delete Project"
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDelete(false)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
