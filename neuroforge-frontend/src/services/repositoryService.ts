import api from './api';

export interface ConnectRepositoryRequest {
  repositoryName: string;
  owner: string;
  repositoryUrl: string;
  githubToken: string;
  projectId: number;
}

export interface RepositoryConnectionResponse {
  id: number;
  repositoryUrl: string;
  branchName: string;
  lastSyncedAt: string | null;
  active: boolean;
}

export interface RepositorySyncResponse {
  id: number;
  repositoryUrl: string;
  lastSyncedAt: string | null;
  message: string;
}

export interface TaskCommitResponse {
  commitSha: string;
  commitMessage: string;
  authorName: string;
  commitUrl: string;
  branchName: string;
  committedAt: string;
}

export const repositoryService = {
  connectRepository: async (data: ConnectRepositoryRequest) => {
    return api.post<RepositoryConnectionResponse>('/repositories/connect', data);
  },

  getAllRepositories: async () => {
    return api.get<RepositoryConnectionResponse[]>('/repositories');
  },

  getRepositoriesByProject: async (projectId: number) => {
    return api.get<{ data: RepositoryConnectionResponse[] }>(`/repositories/project/${projectId}`);
  },

  syncRepository: async (repositoryId: number) => {
    return api.post<RepositorySyncResponse>(`/repositories/${repositoryId}/sync`);
  },

  getTaskCommits: async (taskKey: string) => {
    return api.get<{ data: TaskCommitResponse[] }>(`/repositories/tasks/${taskKey}/commits`);
  },

  getTaskCommitsById: async (taskId: number) => {
    return api.get<{ success: boolean; message: string; data: TaskCommitResponse[] }>(`/repositories/tasks/${taskId}/commits-by-id`);
  },

  deleteRepository: async (repositoryId: number) => {
    return api.delete(`/repositories/${repositoryId}`);
  },
};
