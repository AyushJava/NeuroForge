import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Trash2, Edit2, Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { projectService, Milestone, CreateMilestoneRequest, UpdateMilestoneRequest } from '@/services/projectService';
import { Project } from '@/services/projectService';
import { useAuth } from '@/context/AuthContext';
import { canManageProjects } from '@/lib/roleUtils';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/projects/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';

interface Props { project: Project }

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  OVERDUE: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  PENDING: Clock,
  IN_PROGRESS: Calendar,
  COMPLETED: CheckCircle2,
  OVERDUE: AlertCircle,
};

export default function ProjectMilestonesTab({ project }: Props) {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modalMilestone, setModalMilestone] = useState<Milestone | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);

  const canManage = canManageProjects(role);

  const { data, isLoading } = useQuery({
    queryKey: ['milestones', project.id],
    queryFn: () => projectService.getMilestonesByProject(project.id).then(r => r.data),
  });
  const milestones: Milestone[] = data?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: CreateMilestoneRequest) => projectService.createMilestone(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', project.id] });
      toast({ title: 'Milestone created!' });
      setIsModalOpen(false);
      setModalMilestone(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create milestone.', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMilestoneRequest }) => 
      projectService.updateMilestone(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', project.id] });
      toast({ title: 'Milestone updated!' });
      setIsModalOpen(false);
      setModalMilestone(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update milestone.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectService.deleteMilestone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', project.id] });
      toast({ title: 'Milestone deleted' });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete milestone.', variant: 'destructive' }),
  });

  const formatDate = (dt: string) => new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Milestones</h3>
        {canManage && (
          <button
            onClick={() => {
              setModalMilestone(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-primary text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Milestone
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : milestones.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-white mb-1">No milestones yet</p>
          <p className="text-xs text-muted-foreground">Create milestones to track project progress.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map(m => {
            const StatusIcon = STATUS_ICONS[m.status] || Clock;
            const isOverdue = m.status !== 'COMPLETED' && new Date(m.targetDate) < new Date();
            const displayStatus = isOverdue ? 'OVERDUE' : m.status;
            
            return (
              <div key={m.id} className="bg-card border border-border rounded-xl p-4 hover:border-border/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-white">{m.name}</h4>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${STATUS_COLORS[displayStatus]}`}>
                        <StatusIcon className="w-3 h-3" />
                        {displayStatus}
                      </span>
                    </div>
                    {m.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{m.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Target: {formatDate(m.targetDate)}
                      </span>
                      {m.actualDate && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Actual: {formatDate(m.actualDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setModalMilestone(m);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(m)}
                        className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalMilestone(null);
        }}
        title={modalMilestone ? 'Edit Milestone' : 'New Milestone'}
        size="md"
      >
        <MilestoneForm
          milestone={modalMilestone}
          projectId={project.id}
          onSubmit={async (data) => {
            if (modalMilestone) {
              await updateMutation.mutateAsync({ id: modalMilestone.id, data: data as UpdateMilestoneRequest });
            } else {
              await createMutation.mutateAsync(data as CreateMilestoneRequest);
            }
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Milestone"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

function MilestoneForm({ milestone, projectId, onSubmit, isLoading }: {
  milestone: Milestone | null;
  projectId: number;
  onSubmit: (data: CreateMilestoneRequest | UpdateMilestoneRequest) => Promise<void>;
  isLoading: boolean;
}) {
  const [name, setName] = useState(milestone?.name || '');
  const [description, setDescription] = useState(milestone?.description || '');
  const [targetDate, setTargetDate] = useState(milestone?.targetDate?.split('T')[0] || '');
  const [actualDate, setActualDate] = useState(milestone?.actualDate?.split('T')[0] || '');
  const [status, setStatus] = useState(milestone?.status || 'PENDING');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (milestone) {
      await onSubmit({ name, description, targetDate, actualDate: actualDate || undefined, status } as UpdateMilestoneRequest);
    } else {
      await onSubmit({ projectId, name, description, targetDate, status } as CreateMilestoneRequest);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-white mb-1.5">Name *</label>
        <input
          className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
          placeholder="Milestone name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white mb-1.5">Description</label>
        <textarea
          className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm resize-none"
          rows={3}
          placeholder="Description..."
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white mb-1.5">Target Date *</label>
        <input
          type="date"
          className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
          value={targetDate}
          onChange={e => setTargetDate(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white mb-1.5">Actual Date</label>
        <input
          type="date"
          className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
          value={actualDate}
          onChange={e => setActualDate(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white mb-1.5">Status</label>
        <select
          className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-primary text-white font-medium rounded-lg py-3 shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {milestone ? 'Save Changes' : 'Create Milestone'}
      </button>
    </form>
  );
}
