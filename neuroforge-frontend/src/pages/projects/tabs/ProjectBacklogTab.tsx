import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Loader2, Trash2, Edit2, History, TrendingDown } from 'lucide-react';
import { projectService, Task, Sprint, ProjectMember, Project, TaskStatusHistory } from '@/services/projectService';
import { specificationService, Specification } from '@/services/specificationService';
import { useAuth } from '@/context/AuthContext';
import { canWriteTasks, canUpdateTasks, canViewModule5, canMoveTaskToDone } from '@/lib/roleUtils';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/projects/ConfirmDialog';
import SprintBurndownChart from '@/components/projects/SprintBurndownChart';
import { useToast } from '@/hooks/use-toast';

interface Props { project: Project }

const PAGE_SIZE = 20;
const STATUSES = ['ALL', 'TODO', 'IN_PROGRESS', 'CODE_REVIEW', 'TESTING', 'DONE'];
const PRIORITIES = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const statusColor: Record<string, string> = {
  TODO: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  CODE_REVIEW: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  TESTING: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  DONE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const priorityColor: Record<string, string> = {
  LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  MEDIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  HIGH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface TaskFormData {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  storyPoints?: number;
  labels?: string;
  assignedToId?: number;
  sprintId?: number;
  specificationId?: string;
  specificationVersionId?: string;
}

function TaskModal({ task, projectId, sprints, members, project, onClose }: {
  task?: Task;
  projectId: number;
  sprints: Sprint[];
  members: ProjectMember[];
  project: Project;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { role } = useAuth();
  const isEdit = !!task;
  const canMoveToDone = canMoveTaskToDone(role);

  const { data: specsData } = useQuery({
    queryKey: ['specifications', project.organizationId],
    queryFn: () => specificationService.getAll({ orgId: project.organizationId }).then((r: any) => r.data.data),
    enabled: !!project.organizationId,
  });
  const specs = Array.isArray(specsData?.content) ? specsData.content : (Array.isArray(specsData) ? specsData : []);

  const [form, setForm] = useState<TaskFormData>({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'MEDIUM',
    status: task?.status || 'TODO',
    storyPoints: task?.storyPoints,
    labels: task?.labels,
    assignedToId: task?.assignedToId,
    sprintId: task?.sprintId,
    specificationId: task?.specificationId,
    specificationVersionId: task?.specificationVersionId,
  });

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? projectService.updateTask(task!.id, form)
      : projectService.createTask({ ...form, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-sprints', projectId] });
      toast({ title: isEdit ? 'Task updated' : 'Task created' });
      onClose();
    },
    onError: () => toast({ title: 'Error', description: 'Operation failed.', variant: 'destructive' }),
  });

  const inputClass = 'w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all';

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-white block mb-1.5">Title</label>
        <input
          className={inputClass}
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Implement login API"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-white block mb-1.5">Description</label>
        <textarea
          className={inputClass}
          rows={3}
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Task description..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Priority</label>
          <select
            className={inputClass}
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
          >
            {PRIORITIES.filter(p => p !== 'ALL').map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Status</label>
          <select
            className={inputClass}
            value={form.status}
            onChange={e => {
              // Module 5: QA-only restriction for DONE status
              if (e.target.value === 'DONE' && !canMoveToDone) {
                toast({ 
                  title: 'Permission Denied', 
                  description: 'Only QA users can move tasks to DONE status.', 
                  variant: 'destructive' 
                });
                return;
              }
              setForm(f => ({ ...f, status: e.target.value }));
            }}
          >
            {STATUSES.filter(s => s !== 'ALL').map(s => (
              <option key={s} value={s} disabled={s === 'DONE' && !canMoveToDone}>{s}</option>
            ))}
          </select>
          {!canMoveToDone && form.status === 'DONE' && (
            <p className="text-xs text-muted-foreground mt-1">Only QA users can set status to DONE</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Story Points</label>
          <input
            type="number"
            min="0"
            max="21"
            className={inputClass}
            value={form.storyPoints || ''}
            onChange={e => setForm(f => ({ ...f, storyPoints: e.target.value ? Number(e.target.value) : undefined }))}
            placeholder="0-21"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Labels</label>
          <input
            className={inputClass}
            value={form.labels || ''}
            onChange={e => setForm(f => ({ ...f, labels: e.target.value }))}
            placeholder="e.g. bug, feature, urgent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Sprint</label>
          <select
            className={inputClass}
            value={form.sprintId?.toString() || ''}
            onChange={e => setForm(f => ({ ...f, sprintId: e.target.value ? Number(e.target.value) : undefined }))}
          >
            <option value="">No Sprint</option>
            {sprints.map(s => (
              <option key={s.id} value={s.id}>{s.sprintName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Assignee</label>
          <select
            className={inputClass}
            value={form.assignedToId?.toString() || ''}
            onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value ? Number(e.target.value) : undefined }))}
          >
            <option value="">Unassigned</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.memberName}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Linked Requirement</label>
          <select
            className={inputClass}
            value={form.specificationId || ''}
            onChange={e => setForm(f => ({ ...f, specificationId: e.target.value || undefined }))}
          >
            <option value="">None</option>
            {specs.filter((s: Specification) => s.status === 'APPROVED').map(s => (
              <option key={s.id} value={s.id}>{s.specificationKey} - {s.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Version</label>
          <select
            className={inputClass}
            value={form.specificationVersionId || ''}
            onChange={e => setForm(f => ({ ...f, specificationVersionId: e.target.value || undefined }))}
            disabled={!form.specificationId}
          >
            <option value="">Latest</option>
            {form.specificationId && specs.find((s: Specification) => s.id === form.specificationId) && (
              <option value={form.specificationId}>Version {specs.find((s: Specification) => s.id === form.specificationId)?.currentVersion}</option>
            )}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.title}
          className="flex-1 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? 'Saving...' : (isEdit ? 'Update Task' : 'Create Task')}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-white hover:border-primary/50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TaskHistoryModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['task-history', task.id],
    queryFn: () => projectService.getTaskHistory(task.id).then(r => r.data),
  });

  const history: TaskStatusHistory[] = historyData?.data || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-white">Status History for: {task.title}</h4>
      
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && history.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          No status history available.
        </div>
      )}

      {!isLoading && history.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {history.map((entry, idx) => (
            <div key={entry.id} className="bg-background/50 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400">
                    {entry.previousStatus}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">
                    {entry.newStatus}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(entry.changedAt)}</span>
              </div>
              {entry.changedBy && (
                <div className="text-xs text-muted-foreground">
                  Changed by: {entry.changedBy}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-white hover:border-primary/50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function ProjectBacklogTab({ project }: Props) {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [page, setPage] = useState(1);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [showBurndown, setShowBurndown] = useState(false);

  const canWrite = canWriteTasks(role);
  const canUpdate = canUpdateTasks(role);
  const canView = canViewModule5(role);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['project-tasks', project.id],
    queryFn: () => projectService.getTasksByProject(project.id).then(r => r.data),
  });

  const { data: sprintsData } = useQuery({
    queryKey: ['project-sprints', project.id],
    queryFn: () => projectService.getSprintsByProject(project.id).then(r => r.data),
  });

  const { data: burndownData, isLoading: burndownLoading } = useQuery({
    queryKey: ['sprint-burndown', selectedSprint?.id],
    queryFn: () => projectService.getSprintBurndown(selectedSprint!.id).then(r => r.data),
    enabled: !!selectedSprint && showBurndown,
  });

  const { data: membersData } = useQuery({
    queryKey: ['project-members', project.id],
    queryFn: () => projectService.getProjectMembers(project.id).then(r => r.data),
  });

  const tasks: Task[] = tasksData?.data || [];
  const sprints: Sprint[] = sprintsData?.data || [];
  const members: ProjectMember[] = membersData?.data || [];

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const matchSearch = !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = status === 'ALL' || t.status === status;
      const matchPriority = priority === 'ALL' || t.priority === priority;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [tasks, search, status, priority]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (task: Task) => projectService.deleteTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', project.id] });
      toast({ title: 'Task deleted', description: 'The task has been removed.' });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' }),
  });

  const inputClass = 'bg-background border border-border rounded-lg px-4 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Backlog</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {role === 'client' ? 'View tasks for this project' : 'Manage tasks for this project'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sprints.length > 0 && (
            <select
              className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary transition-all"
              value={selectedSprint?.id || ''}
              onChange={(e) => {
                const sprint = sprints.find(s => s.id === Number(e.target.value));
                if (sprint) {
                  setSelectedSprint(sprint);
                  setShowBurndown(true);
                }
              }}
            >
              <option value="">View Burndown...</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id}>{s.sprintName}</option>
              ))}
            </select>
          )}
          {canWrite && (
            <button
              onClick={() => {
                setModalTask(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-primary text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className={inputClass}
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          {STATUSES.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</option>)}
        </select>
        <select
          className={inputClass}
          value={priority}
          onChange={e => setPriority(e.target.value)}
        >
          {PRIORITIES.map(p => <option key={p} value={p}>{p === 'ALL' ? 'All Priorities' : p}</option>)}
        </select>
      </div>

      {/* Count */}
      {!tasksLoading && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} task{filtered.length !== 1 ? 's' : ''} found
        </p>
      )}

      {tasksLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}

      {!tasksLoading && filtered.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
          {canWrite ? 'No tasks yet. Create your first task to get started.' : (role === 'client' ? 'No tasks have been created yet.' : 'No tasks have been created yet.')}
        </div>
      )}

      {!tasksLoading && paginated.length > 0 && (
        <>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-background/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Task</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Story Points</th>
                  <th className="px-5 py-3 font-medium">Labels</th>
                  <th className="px-5 py-3 font-medium">Requirement</th>
                  <th className="px-5 py-3 font-medium">Sprint</th>
                  <th className="px-5 py-3 font-medium">Assignee</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-sm">
                {paginated.map(task => (
                  <tr key={task.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-white">{task.title}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColor[task.status]}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${priorityColor[task.priority]}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {task.storyPoints !== undefined && task.storyPoints !== null ? task.storyPoints : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {task.labels ? (
                        <div className="flex flex-wrap gap-1">
                          {task.labels.split(',').map((label, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded text-xs bg-primary/20 text-primary border border-primary/30">
                              {label.trim()}
                            </span>
                          ))}
                        </div>
                      ) : '—'}
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
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {task.sprintId ? sprints.find(s => s.id === task.sprintId)?.sprintName || '—' : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {task.assignedToId ? members.find(m => m.id === task.assignedToId)?.memberName || '—' : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setHistoryTask(task)}
                          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                          title="View history"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        {canUpdate && role !== 'client' && (
                          <button
                            onClick={() => {
                              setModalTask(task);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canWrite && (
                          <button
                            onClick={() => setDeleteTarget(task)}
                            className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:text-white hover:border-primary/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:text-white hover:border-primary/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Task Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalTask(null);
        }}
        title={modalTask ? 'Edit Task' : 'New Task'}
        size="lg"
      >
        <TaskModal
          task={modalTask || undefined}
          projectId={project.id}
          sprints={sprints}
          members={members}
          project={project}
          onClose={() => {
            setIsModalOpen(false);
            setModalTask(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation */}
      {canWrite && (
        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete Task"
          message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
          confirmLabel="Delete"
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteMutation.isPending}
        />
      )}

      {/* Task History Modal */}
      <Modal
        isOpen={historyTask !== null}
        onClose={() => setHistoryTask(null)}
        title="Task Status History"
        size="md"
      >
        {historyTask && (
          <TaskHistoryModal
            task={historyTask}
            onClose={() => setHistoryTask(null)}
          />
        )}
      </Modal>

      {/* Sprint Burndown Modal */}
      <Modal
        isOpen={showBurndown}
        onClose={() => {
          setShowBurndown(false);
          setSelectedSprint(null);
        }}
        title="Sprint Burndown Chart"
        size="lg"
      >
        {selectedSprint && (
          <SprintBurndownChart
            data={burndownData?.data || []}
            isLoading={burndownLoading}
            sprintName={selectedSprint.sprintName}
          />
        )}
      </Modal>
    </div>
  );
}
