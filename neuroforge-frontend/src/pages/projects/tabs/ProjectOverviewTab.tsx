import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Activity, CheckSquare, GitBranch } from 'lucide-react';
import { projectService, Project, ProjectStats } from '@/services/projectService';
import ProgressBar from '@/components/projects/ProgressBar';
import HealthBadge from '@/components/projects/HealthBadge';

interface Props {
  project: Project;
}

export default function ProjectOverviewTab({ project }: Props) {
  const { data: statsData } = useQuery({
    queryKey: ['project-stats', project.id],
    queryFn: () => projectService.getStats(project.id).then(r => r.data),
  });
  const stats: ProjectStats | undefined = statsData?.data;

  const formatDate = (dt?: string) =>
    dt ? new Date(dt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';

  const statCards = [
    { label: 'Total Tasks', value: stats?.totalTasks ?? 0, icon: CheckSquare, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Completed', value: stats?.completedTasks ?? 0, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'In Progress', value: stats?.inProgressTasks ?? 0, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Sprints', value: stats?.totalSprints ?? 0, icon: GitBranch, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  const completionPct = stats && stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Description */}
      {project.description && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-2">About this Project</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-muted-foreground text-xs font-medium mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Progress + Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Overall Progress</h3>
          <ProgressBar value={completionPct} label="Task Completion" size="lg" />
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'To Do', value: stats?.todoTasks ?? 0, color: 'text-slate-400' },
              { label: 'In Progress', value: stats?.inProgressTasks ?? 0, color: 'text-amber-400' },
              { label: 'Done', value: stats?.completedTasks ?? 0, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="bg-background rounded-lg p-3">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Project Health</h3>
          {stats ? (
            <div className="flex flex-col items-center justify-center h-24">
              <div className="text-4xl font-bold text-white mb-2">{stats.healthScore}%</div>
              <HealthBadge status={stats.healthStatus} size="lg" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">Loading…</div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Project Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Status', value: <HealthBadge status={project.status} size="sm" /> },
            { label: 'Organization', value: project.organizationName || '—' },
            { label: 'Methodology', value: project.methodology || '—' },
            { label: 'Tech Stack', value: project.techStack || '—' },
            { label: 'Start Date', value: formatDate(project.startDate) },
            { label: 'End Date', value: formatDate(project.endDate) },
            { label: 'Team Members', value: `${stats?.totalMembers ?? 0}` },
            { label: 'Created', value: formatDate(project.createdAt) },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="text-muted-foreground w-28 flex-shrink-0">{row.label}</span>
              <span className="text-white">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
