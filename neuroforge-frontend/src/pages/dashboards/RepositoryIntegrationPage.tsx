import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { GitBranch, GitCommit, RefreshCw, Plus, ExternalLink, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import { repositoryService, RepositoryConnectionResponse, ConnectRepositoryRequest } from '@/services/repositoryService';
import api from '@/services/api';

interface Props {
  projectId?: number;
  isTab?: boolean;
}

export default function RepositoryIntegrationPage({ projectId: propProjectId, isTab = false }: Props) {
  const params = useParams();
  const projectId = propProjectId || Number(params.projectId);
  const queryClient = useQueryClient();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [formData, setFormData] = useState<ConnectRepositoryRequest>({
    repositoryName: '',
    owner: '',
    repositoryUrl: '',
    githubToken: '',
    projectId: projectId || 0,
  });

  const { data: repositories, isLoading, error } = useQuery({
    queryKey: ['repositories', projectId],
    queryFn: () => repositoryService.getRepositoriesByProject(projectId).then(r => r.data.data),
    enabled: !!projectId,
  });

  const connectMutation = useMutation({
    mutationFn: repositoryService.connectRepository,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories', projectId] });
      setShowConnectModal(false);
      setFormData({ repositoryName: '', owner: '', repositoryUrl: '', githubToken: '', projectId: projectId || 0 });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (repositoryId: number) => repositoryService.syncRepository(repositoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (repositoryId: number) => repositoryService.deleteRepository(repositoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories', projectId] });
    },
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    connectMutation.mutate(formData);
  };

  const handleSync = (repositoryId: number) => {
    syncMutation.mutate(repositoryId);
  };

  const handleDelete = (repositoryId: number) => {
    if (confirm('Are you sure you want to delete this repository connection?')) {
      deleteMutation.mutate(repositoryId);
    }
  };

  const content = (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Repository Integration</h2>
          <p className="text-muted-foreground text-sm mt-1">Connect GitHub repositories and sync commits</p>
        </div>
        <button
          onClick={() => setShowConnectModal(true)}
          className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Connect Repository
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <p>Failed to load repositories</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {repositories && repositories.length > 0 ? (
            repositories.map((repo: RepositoryConnectionResponse) => (
              <div key={repo.id} className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <GitBranch className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-semibold text-white">{repo.repositoryUrl}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${repo.active ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                        {repo.active ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Default Branch</p>
                        <p className="text-white">{repo.branchName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Sync</p>
                        <p className="text-white">
                          {repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleString() : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleSync(repo.id)}
                      disabled={syncMutation.isPending}
                      className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Sync Now
                    </button>
                    <button
                      onClick={() => handleDelete(repo.id)}
                      disabled={deleteMutation.isPending}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No repositories connected</h3>
              <p className="text-muted-foreground mb-4">Connect your first GitHub repository to start tracking commits</p>
              <button
                onClick={() => setShowConnectModal(true)}
                className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Connect Repository
              </button>
            </div>
          )}
        </div>
      )}

      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Connect GitHub Repository</h3>
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Repository Name</label>
                <input
                  type="text"
                  value={formData.repositoryName}
                  onChange={(e) => setFormData({ ...formData, repositoryName: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Owner</label>
                <input
                  type="text"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Repository URL</label>
                <input
                  type="text"
                  value={formData.repositoryUrl}
                  onChange={(e) => setFormData({ ...formData, repositoryUrl: e.target.value })}
                  placeholder="https://github.com/owner/repo"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">GitHub Token</label>
                <input
                  type="password"
                  value={formData.githubToken}
                  onChange={(e) => setFormData({ ...formData, githubToken: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectMutation.isPending}
                  className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {connectMutation.isPending ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  if (isTab) {
    return <div className="space-y-6">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="Repository Integration" />
        <main className="flex-1 p-8 overflow-y-auto">
          {content}
        </main>
      </div>
    </div>
  );
}
