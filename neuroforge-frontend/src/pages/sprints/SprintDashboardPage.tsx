import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Calendar, Target, CheckCircle2, Play, ArrowLeft, TrendingUp, BarChart3, StopCircle, Download, Sparkles, X } from 'lucide-react';
import { projectService, Sprint, Task, SprintProgress, BurndownPoint, SprintVelocity } from '@/services/projectService';
import analyticsService from '@/services/analyticsService';
import { useAuth } from '@/context/AuthContext';
import { canWriteSprints } from '@/lib/roleUtils';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const statusColor: Record<string, string> = {
  PLANNED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  ACTIVE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const taskStatusColor: Record<string, string> = {
  TODO: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  CODE_REVIEW: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  TESTING: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  DONE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function SprintDashboardPage() {
  const params = useParams<{ id: string; sprintId: string }>();
  const [, setLocation] = useLocation();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const projectId = Number(params.id);
  const sprintId = Number(params.sprintId);
  const [showAiSummary, setShowAiSummary] = useState(false);

  const canWrite = canWriteSprints(role);

  const { data: sprintData, isLoading: sprintLoading } = useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: () => projectService.getSprintById(sprintId).then(r => r.data),
    enabled: !!sprintId,
  });

  const { data: progressData, error: progressError } = useQuery({
    queryKey: ['sprint-progress', sprintId],
    queryFn: () => projectService.getSprintProgress(sprintId).then(r => r.data.data),
    enabled: !!sprintId,
  });

  const { data: burndownData, error: burndownError } = useQuery({
    queryKey: ['sprint-burndown', sprintId],
    queryFn: () => projectService.getSprintBurndown(sprintId).then(r => {
      console.log('Burndown API response:', r);
      console.log('Burndown data:', r.data);
      return r.data.data;
    }),
    enabled: !!sprintId,
  });

  const { data: velocityData, error: velocityError } = useQuery({
    queryKey: ['sprint-velocity', sprintId],
    queryFn: () => projectService.getSprintVelocity(sprintId).then(r => r.data.data),
    enabled: !!sprintId,
  });

  const startSprintMutation = useMutation({
    mutationFn: () => projectService.startSprint(sprintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      toast({ title: 'Sprint started successfully' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to start sprint', variant: 'destructive' }),
  });

  const completeSprintMutation = useMutation({
    mutationFn: () => projectService.completeSprint(sprintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['sprint-progress', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['sprint-burndown', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['sprint-velocity', sprintId] });
      toast({ title: 'Sprint completed successfully' });
    },
    onError: (error: any) => {
      console.error('Complete sprint error:', error);
      toast({ title: 'Error', description: error?.response?.data?.message || 'Failed to complete sprint', variant: 'destructive' });
    },
  });

  const { data: tasksData } = useQuery({
    queryKey: ['sprint-tasks', sprintId],
    queryFn: () => projectService.getTasksBySprint(sprintId).then(r => r.data),
    enabled: !!sprintId,
  });

  const { data: aiSummaryData, isLoading: aiSummaryLoading } = useQuery({
    queryKey: ['sprint-ai-summary', sprintId],
    queryFn: () => analyticsService.getSprintHealthSummary(sprintId).then(r => r.data),
    enabled: !!sprintId && showAiSummary,
  });

  const sprint: Sprint | undefined = sprintData?.data;
  const progress: SprintProgress | undefined = progressData;
  const burndown: BurndownPoint[] | undefined = burndownData;
  const velocity: SprintVelocity | undefined = velocityData;
  const tasks: Task[] = tasksData?.data || [];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const completionPercentage = progress?.completionPercentage || 0;

  const handleExportPdf = async () => {
    try {
      const response = await analyticsService.getSprintReportPdf(sprintId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sprint-report-${sprintId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'PDF exported successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export PDF', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="Sprint Dashboard" />
        <main className="flex-1 p-8 overflow-y-auto">

          {/* Back Button */}
          <button
            onClick={() => {
              const basePath = role === 'org-admin' ? '/org-admin' : '/project-manager';
              setLocation(`${basePath}/projects/${projectId}`);
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Project
          </button>

          {sprintLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}

          {!sprintLoading && !sprint && (
            <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
              Sprint not found.
            </div>
          )}

          {!sprintLoading && sprint && (
            <>
              {/* Error Display */}
              {(progressError || burndownError || velocityError) && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                  <p className="text-sm text-red-400">
                    {progressError?.message || burndownError?.message || velocityError?.message || 'Failed to load sprint analytics'}
                  </p>
                </div>
              )}

              {/* Sprint Header */}
              <div className="bg-card border border-border rounded-xl p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">{sprint.sprintName}</h2>
                    <span className={`px-3 py-1 rounded text-sm font-medium border ${statusColor[sprint.status]}`}>
                      {sprint.status}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAiSummary(true)}
                      className="flex items-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      AI Summary
                    </button>
                    <button
                      onClick={handleExportPdf}
                      className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export PDF
                    </button>
                    {canWrite && sprint.status === 'PLANNED' && (
                      <button
                        onClick={() => startSprintMutation.mutate()}
                        disabled={startSprintMutation.isPending}
                        className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Play className="w-4 h-4" />
                        {startSprintMutation.isPending ? 'Starting...' : 'Start Sprint'}
                      </button>
                    )}
                    {canWrite && sprint.status === 'ACTIVE' && (
                      <button
                        onClick={() => completeSprintMutation.mutate()}
                        disabled={completeSprintMutation.isPending}
                        className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <StopCircle className="w-4 h-4" />
                        {completeSprintMutation.isPending ? 'Completing...' : 'Complete Sprint'}
                      </button>
                    )}
                  </div>
                </div>

                {sprint.goal && (
                  <div className="flex items-start gap-3 mb-4">
                    <Target className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">{sprint.goal}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Start Date
                    </div>
                    <div className="text-sm text-white font-medium">{formatDate(sprint.startDate)}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      End Date
                    </div>
                    <div className="text-sm text-white font-medium">{formatDate(sprint.endDate)}</div>
                  </div>
                  {sprint.actualStartDate && (
                    <div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Play className="w-3.5 h-3.5" />
                        Actual Start
                      </div>
                      <div className="text-sm text-white font-medium">{formatDate(sprint.actualStartDate)}</div>
                    </div>
                  )}
                  {sprint.actualEndDate && (
                    <div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Actual End
                      </div>
                      <div className="text-sm text-white font-medium">{formatDate(sprint.actualEndDate)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Section */}
              {progress && (
                <div className="bg-card border border-border rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Sprint Progress</h3>
                  
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Completion</span>
                      <span className="text-sm font-medium text-white">{completionPercentage.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-background/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-white">{progress.totalTasks}</div>
                      <div className="text-xs text-muted-foreground">Total Tasks</div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-emerald-400">{progress.completedTasks}</div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-400">{progress.totalStoryPoints}</div>
                      <div className="text-xs text-muted-foreground">Total Points</div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-purple-400">{progress.completedStoryPoints}</div>
                      <div className="text-xs text-muted-foreground">Completed Points</div>
                    </div>
                  </div>

                  {/* Module 4: Requirement Traceability Stats */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                        <div className="text-2xl font-bold text-purple-400">{tasks.filter(t => t.specificationId).length}</div>
                        <div className="text-xs text-muted-foreground">Linked to Requirements</div>
                      </div>
                      <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
                        <div className="text-2xl font-bold text-emerald-400">{tasks.filter(t => t.specificationId && t.status === 'DONE').length}</div>
                        <div className="text-xs text-muted-foreground">Requirements Completed</div>
                      </div>
                      <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                        <div className="text-2xl font-bold text-amber-400">
                          {tasks.filter(t => t.specificationId).length > 0 
                            ? Math.round((tasks.filter(t => t.specificationId && t.status === 'DONE').length / tasks.filter(t => t.specificationId).length) * 100)
                            : 0}%
                        </div>
                        <div className="text-xs text-muted-foreground">Requirement Completion</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Velocity Section */}
              {velocity && (
                <div className="bg-card border border-border rounded-xl p-6 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold text-white">Sprint Velocity</h3>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-xs text-muted-foreground mb-1">Completed Points</div>
                      <div className="text-xl font-bold text-white">{velocity.completedStoryPoints}</div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-xs text-muted-foreground mb-1">Completed Tasks</div>
                      <div className="text-xl font-bold text-blue-400">{velocity.completedTasks}</div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-xs text-muted-foreground mb-1">Avg Points/Task</div>
                      <div className="text-xl font-bold text-purple-400">{velocity.averageStoryPointsPerTask?.toFixed(1) || '0.0'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Burndown Section */}
              <div className="bg-card border border-border rounded-xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-white">Burndown Chart</h3>
                </div>

                {burndownError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-400">Error loading burndown data: {burndownError.message}</p>
                  </div>
                )}

                {burndown && burndown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={burndown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        label={{ value: 'Story Points', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        itemStyle={{ color: '#f8fafc' }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(value: number) => [`${value} points`, 'Remaining']}
                        labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="remainingStoryPoints" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Actual Burndown"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {burndown === undefined ? 'Loading burndown data...' : 'No burndown data available. Make sure the sprint has start and end dates.'}
                  </div>
                )}
              </div>

              {/* Tasks Section */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-6 border-b border-border">
                  <h3 className="text-lg font-semibold text-white">
                    Tasks ({tasks.length})
                  </h3>
                </div>
                
                {tasks.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    No tasks in this sprint yet.
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-background/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-5 py-3 font-medium">Task</th>
                        <th className="px-5 py-3 font-medium">Requirement</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Priority</th>
                        <th className="px-5 py-3 font-medium">Story Points</th>
                        <th className="px-5 py-3 font-medium">Assignee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-sm">
                      {tasks.map(task => (
                        <tr key={task.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-white">{task.title}</div>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground">
                            {task.specificationTitle ? (
                              <div>
                                <div className="text-xs font-medium text-white">{task.specificationTitle}</div>
                                {task.specificationVersionNumber && (
                                  <div className="text-xs text-muted-foreground">v{task.specificationVersionNumber}</div>
                                )}
                              </div>
                            ) : '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${taskStatusColor[task.status]}`}>
                              {task.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground">{task.priority}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">
                            {task.storyPoints !== undefined && task.storyPoints !== null ? task.storyPoints : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground">
                            {task.assignedToId ? 'Assigned' : 'Unassigned'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* AI Summary Modal */}
      {showAiSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">AI Sprint Health Summary</h3>
              </div>
              <button onClick={() => setShowAiSummary(false)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {aiSummaryLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : aiSummaryData ? (
              <div className="space-y-4">
                <div className="bg-background/50 rounded-lg p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${
                      aiSummaryData.overallHealth === 'HEALTHY' ? 'bg-emerald-500' :
                      aiSummaryData.overallHealth === 'AT_RISK' ? 'bg-amber-500' :
                      'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium text-white">Overall Health: {aiSummaryData.overallHealth}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{aiSummaryData.summary}</p>
                </div>
                {aiSummaryData.risks && aiSummaryData.risks.length > 0 && (
                  <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                    <h4 className="text-sm font-medium text-red-400 mb-2">Risks Identified</h4>
                    <ul className="space-y-1">
                      {aiSummaryData.risks.map((risk, index) => (
                        <li key={index} className="text-sm text-muted-foreground">• {risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiSummaryData.recommendations && aiSummaryData.recommendations.length > 0 && (
                  <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/20">
                    <h4 className="text-sm font-medium text-emerald-400 mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {aiSummaryData.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-muted-foreground">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-4">
                  Generated at: {new Date(aiSummaryData.generatedAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                Failed to load AI summary. Please try again.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
