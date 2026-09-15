import api from './api';

export interface PipelineRunResponse {
  runId: number;
  pipelineName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface PipelineStageResponse {
  stageName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface PipelineHistoryResponse {
  runId: number;
  pipelineName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface PipelineMetricsResponse {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  waitingApprovalRuns: number;
  successRate: number;
  averageDurationSeconds: number;
  fastestRunSeconds: number;
  slowestRunSeconds: number;
}

export interface ReleaseResponse {
  id: number;
  version: string;
  status: string;
  createdAt: string;
  releasedAt: string | null;
}

export interface ReleaseNoteResponse {
  version: string;
  releaseNotes: string;
}

export interface ReleaseHistoryResponse {
  id: number;
  version: string;
  status: string;
  createdAt: string;
  releasedAt: string | null;
  releaseNotes?: string;
}

export interface RunPipelineRequest {
  pipelineId: number;
  orgId?: number;
}

export interface Pipeline {
  id: number;
  name: string;
  repositoryName: string;
  defaultBranch: string;
  active: boolean;
}

export interface CreateReleaseRequest {
  version: string;
  taskIds: number[];
}

export interface UpdateReleaseNotesRequest {
  releaseNotes: string;
}

export const pipelineService = {
  async runPipeline(request: RunPipelineRequest): Promise<PipelineRunResponse> {
    const { data } = await api.post('/pipelines/run', request);
    return data.data;
  },

  async getPipelineStages(runId: number): Promise<PipelineStageResponse[]> {
    const { data } = await api.get(`/pipelines/${runId}/stages`);
    return data.data;
  },

  async getPipelineHistory(orgId?: number): Promise<PipelineHistoryResponse[]> {
    const params = orgId ? { orgId } : {};
    const { data } = await api.get('/pipelines/history', { params });
    return data.data;
  },

  async getPipelineMetrics(orgId?: number): Promise<PipelineMetricsResponse> {
    const params = orgId ? { orgId } : {};
    const { data } = await api.get('/pipelines/metrics', { params });
    return data.data;
  },

  async retryPipeline(runId: number): Promise<PipelineRunResponse> {
    const { data } = await api.post(`/pipelines/${runId}/retry`);
    return data.data;
  },

  async cancelPipeline(runId: number): Promise<void> {
    await api.post(`/pipelines/${runId}/cancel`);
  },

  async approveProduction(runId: number): Promise<void> {
    await api.post(`/pipelines/${runId}/approve`);
  },

  async createRelease(request: CreateReleaseRequest): Promise<ReleaseResponse> {
    const { data } = await api.post('/pipelines/release', request);
    return data.data;
  },

  async generateReleaseNotes(releaseId: number): Promise<ReleaseNoteResponse> {
    const { data } = await api.get(`/pipelines/release/${releaseId}/notes`);
    return data.data;
  },

  async updateReleaseNotes(releaseId: number, request: UpdateReleaseNotesRequest): Promise<ReleaseNoteResponse> {
    const { data } = await api.put(`/pipelines/release/${releaseId}/notes`, request);
    return data.data;
  },

  async getReleaseHistory(orgId?: number): Promise<ReleaseHistoryResponse[]> {
    const params = orgId ? { orgId } : {};
    const { data } = await api.get('/pipelines/releases', { params });
    return data.data;
  },

  async publishRelease(releaseId: number): Promise<ReleaseResponse> {
    const { data } = await api.post(`/pipelines/release/${releaseId}/publish`);
    return data.data;
  },

  async getActivePipeline(orgId?: number): Promise<Pipeline> {
    const params = orgId ? { orgId } : {};
    const { data } = await api.get('/pipelines/active', { params });
    return data.data;
  },
};
