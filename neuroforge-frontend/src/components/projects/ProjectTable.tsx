import React from 'react';
import { Link } from 'wouter';
import { Edit2, Trash2, Eye } from 'lucide-react';
import { Project } from '@/services/projectService';
import HealthBadge from './HealthBadge';

interface ProjectTableProps {
  projects: Project[];
  basePath: string;
  onDelete?: (project: Project) => void;
  canEdit?: boolean;
}

export default function ProjectTable({ projects, basePath, onDelete, canEdit = true }: ProjectTableProps) {
  const formatDate = (dt?: string) =>
    dt ? new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-background/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-5 py-3 font-medium">Project</th>
            <th className="px-5 py-3 font-medium">Organization</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Start Date</th>
            <th className="px-5 py-3 font-medium">End Date</th>
            <th className="px-5 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-border/50">
          {projects.map((project) => (
            <tr key={project.id} className="hover:bg-white/5 transition-colors">
              <td className="px-5 py-3.5">
                <p className="font-medium text-white">{project.projectName}</p>
                {project.description && (
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{project.description}</p>
                )}
              </td>
              <td className="px-5 py-3.5 text-muted-foreground text-sm">
                {project.organizationName || '—'}
              </td>
              <td className="px-5 py-3.5">
                <HealthBadge status={project.status} size="sm" />
              </td>
              <td className="px-5 py-3.5 text-muted-foreground">{formatDate(project.startDate)}</td>
              <td className="px-5 py-3.5 text-muted-foreground">{formatDate(project.endDate)}</td>
              <td className="px-5 py-3.5">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`${basePath}/${project.id}`}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  {canEdit && (
                    <>
                      <Link
                        href={`${basePath}/${project.id}/edit`}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      {onDelete && (
                        <button
                          onClick={() => onDelete(project)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
