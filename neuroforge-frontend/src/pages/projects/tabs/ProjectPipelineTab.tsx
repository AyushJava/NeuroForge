import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, RotateCcw, X, CheckCircle, XCircle, Clock, AlertTriangle, FileText, Plus, Edit, Eye, Loader2 } from 'lucide-react';
import { pipelineService, PipelineRunResponse, PipelineStageResponse, PipelineHistoryResponse, PipelineMetricsResponse, ReleaseResponse, ReleaseHistoryResponse, CreateReleaseRequest, UpdateReleaseNotesRequest, Pipeline } from '@/services/pipelineService';
import { pipelineWebSocketService, PipelineStageUpdate } from '@/services/pipelineWebSocketService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { projectService, Task } from '@/services/projectService';
import { UiRoleSlug } from '@/lib/roleUtils';

interface Props { projectId: number }

const STAGES = ['Build', 'Unit Test', 'Security Scan', 'Deploy Dev', 'Deploy QA', 'Deploy Prod'];

const getStageStatusColor = (status: string) => {
  switch (status) {
    case 'RUNNING': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'SUCCESS': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'FAILED': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const getPipelineStatusColor = (status: string) => {
  switch (status) {
    case 'RUNNING': return 'text-blue-400';
    case 'SUCCESS': return 'text-green-400';
    case 'FAILED': return 'text-red-400';
    case 'WAITING_FOR_APPROVAL': return 'text-amber-400';
    case 'CANCELLED': return 'text-slate-400';
    default: return 'text-slate-400';
  }
};

export default function ProjectPipelineTab({ projectId }: Props) {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem('accessToken');
  
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [stages, setStages] = useState<PipelineStageResponse[]>([]);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseVersion, setReleaseVersion] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [showEditNotesModal, setShowEditNotesModal] = useState(false);
  const [editingReleaseId, setEditingReleaseId] = useState<number | null>(null);
  const [editedNotes, setEditedNotes] = useState('');

  // Queries
  const { data: allProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll().then((r: any) => r.data.data),
  });

  const projectData = Array.isArray(allProjects) ? allProjects?.find((p: any) => p.id === projectId) : undefined;

  const { data: history } = useQuery({
    queryKey: ['pipeline-history', projectData?.organizationId],
    queryFn: () => pipelineService.getPipelineHistory(projectData?.organizationId),
    enabled: !!projectData,
  });

  const { data: metrics } = useQuery({
    queryKey: ['pipeline-metrics', projectData?.organizationId],
    queryFn: () => pipelineService.getPipelineMetrics(projectData?.organizationId),
    enabled: !!projectData,
  });

  const { data: releases } = useQuery({
    queryKey: ['release-history', projectData?.organizationId],
    queryFn: () => pipelineService.getReleaseHistory(projectData?.organizationId),
    enabled: !!projectData,
  });

  const { data: tasksResponse } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => projectService.getTasksByProject(projectId),
  });
  const tasks = tasksResponse?.data?.data as Task[] || [];

  const { data: activePipeline } = useQuery({
    queryKey: ['active-pipeline', projectData?.organizationId],
    queryFn: () => pipelineService.getActivePipeline(projectData?.organizationId),
    enabled: !!projectData,
  });

  // Mutations
  const runPipelineMutation = useMutation({
    mutationFn: () => {
      if (!activePipeline) {
        throw new Error('No active pipeline found');
      }
      return pipelineService.runPipeline({ pipelineId: activePipeline.id, orgId: projectData?.organizationId });
    },
    onSuccess: (data) => {
      setActiveRunId(data.runId);
      toast({ title: 'Pipeline started' });
      queryClient.invalidateQueries({ queryKey: ['pipeline-history'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (runId: number) => pipelineService.retryPipeline(runId),
    onSuccess: (data) => {
      setActiveRunId(data.runId);
      toast({ title: 'Pipeline retried' });
      queryClient.invalidateQueries({ queryKey: ['pipeline-history'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (runId: number) => pipelineService.cancelPipeline(runId),
    onSuccess: () => {
      toast({ title: 'Pipeline cancelled' });
      queryClient.invalidateQueries({ queryKey: ['pipeline-history'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (runId: number) => pipelineService.approveProduction(runId),
    onSuccess: () => {
      toast({ title: 'Production approved' });
      queryClient.invalidateQueries({ queryKey: ['pipeline-history'] });
    },
  });

  const createReleaseMutation = useMutation({
    mutationFn: (request: CreateReleaseRequest) => pipelineService.createRelease(request),
    onSuccess: () => {
      setShowReleaseModal(false);
      setReleaseVersion('');
      setSelectedTaskIds([]);
      toast({ title: 'Release created' });
      queryClient.invalidateQueries({ queryKey: ['release-history'] });
    },
  });

  const generateNotesMutation = useMutation({
    mutationFn: (releaseId: number) => pipelineService.generateReleaseNotes(releaseId),
    onSuccess: () => {
      toast({ title: 'Release notes generated' });
      queryClient.invalidateQueries({ queryKey: ['release-history'] });
    },
  });

  const publishReleaseMutation = useMutation({
    mutationFn: (releaseId: number) => pipelineService.publishRelease(releaseId),
    onSuccess: () => {
      toast({ title: 'Release published' });
      queryClient.invalidateQueries({ queryKey: ['release-history'] });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: ({ releaseId, notes }: { releaseId: number; notes: string }) =>
      pipelineService.updateReleaseNotes(releaseId, { releaseNotes: notes }),
    onSuccess: () => {
      setShowEditNotesModal(false);
      setEditedNotes('');
      setEditingReleaseId(null);
      toast({ title: 'Release notes updated' });
      queryClient.invalidateQueries({ queryKey: ['release-history'] });
    },
  });

  // WebSocket connection
  useEffect(() => {
    if (token && projectId && !pipelineWebSocketService.isConnected()) {
      pipelineWebSocketService.connect(token, projectId).catch(console.error);
    }
  }, [token, projectId]);

  // Subscribe to pipeline updates
  useEffect(() => {
    if (activeRunId) {
      const handleUpdate = (update: PipelineStageUpdate) => {
        if (update.runId === activeRunId) {
          setStages(prev => {
            const existing = prev.find(s => s.stageName === update.stageName);
            if (existing) {
              return prev.map(s => s.stageName === update.stageName ? { ...s, status: update.status } : s);
            }
            return [...prev, { stageName: update.stageName, status: update.status, startedAt: '', completedAt: null }];
          });
          
          // Refresh history to get final status
          queryClient.invalidateQueries({ queryKey: ['pipeline-history'] });
        }
      };

      pipelineWebSocketService.subscribeToPipelineUpdates(activeRunId, handleUpdate);

      // Fetch initial stages
      pipelineService.getPipelineStages(activeRunId).then(setStages).catch(console.error);

      return () => {
        pipelineWebSocketService.unsubscribeFromPipelineUpdates(activeRunId);
      };
    }
  }, [activeRunId, queryClient]);

  const isPM = role === 'project-manager';
  const canViewStatus = role === 'developer' || role === 'qa' || role === 'client';
  const canViewReleases = role === 'client';

  const activeRun = history?.find(r => r.runId === activeRunId);

  // Calculate sequential run number for the organization (1-based)
  const getRunNumber = (runId: number) => {
    if (!history) return 1;
    const index = history.findIndex(r => r.runId === runId);
    return index >= 0 ? history.length - index : 1;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">CI/CD Pipeline</h2>
          <p className="text-slate-400">Manage deployment pipelines and releases</p>
        </div>
        {isPM && (
          <button
            onClick={() => runPipelineMutation.mutate()}
            disabled={runPipelineMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition"
          >
            {runPipelineMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Pipeline
          </button>
        )}
      </div>

      {/* Active Pipeline */}
      {activeRun && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Pipeline #{getRunNumber(activeRun.runId)}</h3>
              <p className={`text-sm ${getPipelineStatusColor(activeRun.status)}`}>
                Status: {activeRun.status}
              </p>
            </div>
            <div className="flex gap-2">
              {activeRun.status === 'FAILED' && isPM && (
                <button
                  onClick={() => retryMutation.mutate(activeRun.runId)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition"
                >
                  <RotateCcw className="w-4 h-4" /> Retry
                </button>
              )}
              {(activeRun.status === 'RUNNING' || activeRun.status === 'WAITING_FOR_APPROVAL') && (
                <button
                  onClick={() => cancelMutation.mutate(activeRun.runId)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              )}
            </div>
          </div>

          {/* Stages */}
          <div className="grid grid-cols-6 gap-4">
            {STAGES.map((stage, index) => {
              const stageData = stages.find(s => s.stageName === stage);
              const status = stageData?.status || 'PENDING';
              const isLast = index === STAGES.length - 1;
              
              return (
                <div key={stage} className="relative">
                  <div className={`p-4 rounded-lg border ${getStageStatusColor(status)} transition-all`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{stage}</span>
                      {status === 'RUNNING' && <Loader2 className="w-4 h-4 animate-spin" />}
                      {status === 'SUCCESS' && <CheckCircle className="w-4 h-4" />}
                      {status === 'FAILED' && <XCircle className="w-4 h-4" />}
                      {status === 'PENDING' && <Clock className="w-4 h-4" />}
                    </div>
                    <span className="text-xs opacity-75">{status}</span>
                  </div>
                  {!isLast && (
                    <div className="absolute top-1/2 -right-2 w-4 h-0.5 bg-slate-600" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Production Approval */}
          {activeRun.status === 'WAITING_FOR_APPROVAL' && (
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="font-medium text-white">Production Approval Required</p>
                    <p className="text-sm text-slate-400">Pipeline is waiting for PM approval before deploying to production</p>
                  </div>
                </div>
                {isPM ? (
                  <button
                    onClick={() => approveMutation.mutate(activeRun.runId)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition"
                  >
                    {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve Production'}
                  </button>
                ) : (
                  <span className="text-sm text-slate-400">Only PM can approve</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pipeline History */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Pipeline History</h3>
        <div className="space-y-3">
          {history?.map(run => (
            <div
              key={run.runId}
              className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition cursor-pointer"
              onClick={() => setActiveRunId(run.runId)}
            >
              <div>
                <span className="font-medium text-white">Run #{getRunNumber(run.runId)}</span>
                <span className="ml-3 text-sm text-slate-400">{new Date(run.startedAt).toLocaleString()}</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${getStageStatusColor(run.status)}`}>
                {run.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Pipeline Metrics</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <p className="text-2xl font-bold text-white">{metrics.totalRuns}</p>
              <p className="text-sm text-slate-400">Total Runs</p>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <p className="text-2xl font-bold text-green-400">{metrics.successRate.toFixed(1)}%</p>
              <p className="text-sm text-slate-400">Success Rate</p>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <p className="text-2xl font-bold text-blue-400">{metrics.averageDurationSeconds.toFixed(0)}s</p>
              <p className="text-sm text-slate-400">Avg Duration</p>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <p className="text-2xl font-bold text-amber-400">{metrics.waitingApprovalRuns}</p>
              <p className="text-sm text-slate-400">Waiting Approval</p>
            </div>
          </div>
        </div>
      )}

      {/* Releases */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Releases</h3>
          {isPM && (
            <button
              onClick={() => setShowReleaseModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
            >
              <Plus className="w-4 h-4" /> Create Release
            </button>
          )}
        </div>
        <div className="space-y-3">
          {releases?.map(release => (
            <div key={release.id} className="p-4 bg-slate-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-white">v{release.version}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStageStatusColor(release.status)}`}>
                    {release.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {release.status === 'DRAFT' && isPM && (
                    <>
                      <button
                        onClick={() => generateNotesMutation.mutate(release.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs transition"
                      >
                        <FileText className="w-3 h-3" /> Generate Notes
                      </button>
                      <button
                        onClick={() => publishReleaseMutation.mutate(release.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition"
                      >
                        <CheckCircle className="w-3 h-3" /> Publish
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-400">
                Created: {new Date(release.createdAt).toLocaleString()}
                {release.releasedAt && ` • Released: ${new Date(release.releasedAt).toLocaleString()}`}
              </p>
              {release.releaseNotes && (
                <div className="mt-3 p-3 bg-slate-800/50 rounded border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-slate-400">Release Notes:</p>
                    {release.status === 'DRAFT' && isPM && (
                      <button
                        onClick={() => {
                          setEditingReleaseId(release.id);
                          setEditedNotes(release.releaseNotes || '');
                          setShowEditNotesModal(true);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{release.releaseNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create Release Modal */}
      {showReleaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Create Release</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Version</label>
                <input
                  type="text"
                  value={releaseVersion}
                  onChange={(e) => setReleaseVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tasks</label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {tasks?.filter((t: Task) => t.status === 'DONE').length === 0 ? (
                    <p className="text-sm text-slate-400">No completed tasks available</p>
                  ) : (
                    tasks?.filter((t: Task) => t.status === 'DONE').map((task: Task) => (
                      <label key={task.id} className="flex items-center gap-2 p-2 bg-slate-900/50 rounded">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={(e) => {
                           	if (e.target.checked) {
                            setSelectedTaskIds([...selectedTaskIds, task.id]);
                          } else {
                            setSelectedTaskIds(selectedTaskIds.filter(id => id !== task.id));
                          }
                        }}
                        className="rounded"
                        />
                        <span className="text-sm text-white">{task.title}</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Selected: {selectedTaskIds.length} tasks</p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowReleaseModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (releaseVersion && selectedTaskIds.length > 0) {
                      createReleaseMutation.mutate({ 
                        version: releaseVersion, 
                        taskIds: selectedTaskIds,
                        organizationId: projectData?.organizationId 
                      });
                    }
                  }}
                  disabled={!releaseVersion || selectedTaskIds.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Release Notes Modal */}
      {showEditNotesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Edit Release Notes</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Release Notes</label>
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowEditNotesModal(false);
                    setEditedNotes('');
                    setEditingReleaseId(null);
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (editingReleaseId && editedNotes) {
                      updateNotesMutation.mutate({ releaseId: editingReleaseId, notes: editedNotes });
                    }
                  }}
                  disabled={!editedNotes}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
