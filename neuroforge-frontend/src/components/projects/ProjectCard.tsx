import React from 'react';
import { Calendar, Building2, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { Project } from '@/services/projectService';
import HealthBadge from './HealthBadge';
import ProgressBar from './ProgressBar';

interface ProjectCardProps {
  project: Project;
  basePath: string;
  progress?: number;
  showViewDetails?: boolean;
}

export default function ProjectCard({ project, basePath, showViewDetails = true }: ProjectCardProps) {
  const formatDate = (dt?: string) =>
    dt ? new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const progress = (project as any).progress || 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-all group shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-3">
          <h3 className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
            {project.projectName}
          </h3>
          {project.organizationName && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3" />
              {project.organizationName}
            </div>
          )}
        </div>
        <HealthBadge status={project.status} size="sm" />
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{project.description}</p>
      )}

      {/* Progress */}
      <div className="mb-4">
        <ProgressBar value={progress} label="Progress" />
      </div>

      {/* Dates */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
        {project.startDate && (
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(project.startDate)}
          </div>
        )}
        {project.endDate && (
          <>
            <span>→</span>
            <span>{formatDate(project.endDate)}</span>
          </>
        )}
      </div>

      {/* Action */}
      {showViewDetails && (
        <Link
          href={`${basePath}/${project.id}`}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-blue-400 transition-colors"
        >
          View Details <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
