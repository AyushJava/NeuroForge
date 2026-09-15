import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckSquare, Loader2, X, Trash2, Edit2, GitCommit, ExternalLink } from 'lucide-react';
import { projectService, Task, Sprint, Project, ProjectMember } from '@/services/projectService';
import { repositoryService, TaskCommitResponse } from '@/services/repositoryService';
import { useAuth } from '@/context/AuthContext';
import { canWriteTasks, canUpdateTasks } from '@/lib/roleUtils';
import ConfirmDialog from '@/components/projects/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';

interface Props { project: Project }

type TaskFormData = { title: string; description: string; priority: string; status: string; assignedToId: string; sprintId: string };
const PRIORITIES    = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'CODE_REVIEW', 'TESTING', 'DONE'];

// Status label mapping to match Kanban tab
const getStatusLabel = (status: string) => {
  const statusMap: Record<string, string> = {
    'TODO': 'To Do',
    'IN_PROGRESS': 'In Progress',
    'CODE_REVIEW': 'Code Review',
    'TESTING': 'Testing',
    'DONE': 'Done',
    'IN_REVIEW': 'Code Review', // Legacy mapping
  };
  return statusMap[status] || status.replace('_', ' ');
};

const priorityColor: Record<string, string> = {
  LOW:      'bg-slate-500/10  text-slate-400  border-slate-500/20',
  MEDIUM:   'bg-blue-500/10   text-blue-400   border-blue-500/20',
  HIGH:     'bg-amber-500/10  text-amber-400  border-amber-500/20',
  CRITICAL: 'bg-red-500/10    text-red-400    border-red-500/20',
};

function TaskModal({ task, projectId, sprintOptions, memberOptions, onClose, readOnlyStatus }: {
  task?: Task;
  projectId: number;
  sprintOptions: Sprint[];
  memberOptions: ProjectMember[];
  onClose: () => void;
  readOnlyStatus?: boolean; // developer/qa: only status can be changed
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!task;

  const [form, setForm] = useState<TaskFormData>({
    title:        task?.title        || '',
    description:  task?.description  || '',
    priority:     task?.priority     || 'MEDIUM',
    status:       task?.status       || 'TODO',
    assignedToId: task?.assignedToId?.toString() || '',
    sprintId:     task?.sprintId?.toString()     || '',
  });

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? projectService.updateTask(task!.id, {
          title:        readOnlyStatus ? task!.title        : form.title,
          description:  readOnlyStatus ? task!.description  : form.description,
          priority:     readOnlyStatus ? task!.priority     : form.priority,
          status:       form.status,
          assignedToId: readOnlyStatus ? task!.assignedToId : (form.assignedToId ? Number(form.assignedToId) : undefined),
          sprintId:     readOnlyStatus ? task!.sprintId     : (form.sprintId     ? Number(form.sprintId)     : undefined),
        })
      : projectService.createTask({
          title:        form.title,
          description:  form.description,
          priority:     form.priority,
          status:       form.status,
          assignedToId: form.assignedToId ? Number(form.assignedToId) : undefined,
          projectId,
          sprintId:     form.sprintId     ? Number(form.sprintId)     : undefined,
        }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
      toast({ title: isEdit ? 'Task updated' : 'Task created' });
      onClose();
    },
    onError: () => toast({ title: 'Error', description: 'Operation failed.', variant: 'destructive' }),
  });

  const inputClass = 'w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all';
  const readonlyClass = `${inputClass} opacity-60 cursor-not-allowed`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111827] border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">
            {isEdit ? (readOnlyStatus ? 'Update Task Status' : 'Edit Task') : 'New Task'}
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          {/* Title — readonly for status-only users */}
          <div>
            <label className="text-xs font-medium text-white block mb-1.5">Title</label>
            <input
              className={readOnlyStatus ? readonlyClass : inputClass}
              value={form.title}
              readOnly={readOnlyStatus}
              onChange={e => !readOnlyStatus && setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Implement login API"
            />
          </div>

          {/* Description — hidden for status-only users */}
          {!readOnlyStatus && (
            <div>
              <label className="text-xs font-medium text-white block mb-1.5">Description</label>
              <textarea rows={2} className={`${inputClass} resize-none`} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Task details..." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Priority — readonly for status-only users */}
            {!readOnlyStatus && (
              <div>
                <label className="text-xs font-medium text-white block mb-1.5">Priority</label>
                <select className={inputClass} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
            <div className={readOnlyStatus ? 'col-span-2' : ''}>
              <label className="text-xs font-medium text-white block mb-1.5">Status</label>
              <select className={inputClass} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {TASK_STATUSES.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
              </select>
            </div>
          </div>

          {/* Assignment / Sprint — hidden for status-only */}
          {!readOnlyStatus && (
            <>
              <div>
                <label className="text-xs font-medium text-white block mb-1.5">Assigned To</label>
                {memberOptions.length > 0 ? (
                  <select className={inputClass} value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {memberOptions.map(m => <option key={m.id} value={m.id}>{m.memberName}</option>)}
                  </select>
                ) : (
                  <p className="text-xs text-muted-foreground">No members assigned — add from the Members tab first.</p>
                )}
              </div>
              {sprintOptions.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-white block mb-1.5">Sprint</label>
                  <select className={inputClass} value={form.sprintId} onChange={e => setForm(f => ({ ...f, sprintId: e.target.value }))}>
                    <option value="">No sprint</option>
                    {sprintOptions.map(s => <option key={s.id} value={s.id}>{s.sprintName}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          <button
            onClick={() => mutation.mutate()}
            disabled={(!form.title && !readOnlyStatus) || mutation.isPending}
            className="w-full bg-primary text-white text-sm font-medium py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskCommitsModal({ taskId, taskTitle, onClose }: { taskId: number; taskTitle: string; onClose: () => void }) {
  const { data: commitsData, isLoading } = useQuery({
    queryKey: ['task-commits', taskId],
    queryFn: () => repositoryService.getTaskCommitsById(taskId).then(r => r.data),
  });

  const commits = commitsData?.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111827] border border-border rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-primary" />
            Related Commits
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{taskTitle}</p>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : !commits || commits.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
              <GitCommit className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-white mb-1">No commits found</p>
              <p className="text-xs text-muted-foreground">Commits containing the task ID will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {commits.map((commit: TaskCommitResponse) => (
                <div key={commit.commitSha} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <code className="text-xs text-primary font-mono">{commit.commitSha.substring(0, 7)}</code>
                    <span className="text-xs text-muted-foreground">{new Date(commit.committedAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-white mb-2">{commit.commitMessage}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>By {commit.authorName}</span>
                    <span>on {commit.branchName}</span>
                  </div>
                  {commit.commitUrl && (
                    <a
                      href={commit.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-blue-400 mt-2 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View on GitHub
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectTasksTab({ project }: Props) {
  const { role } = useAuth();
  const canWrite  = canWriteTasks(role);    // PM+ can create & delete
  const canUpdate = canUpdateTasks(role);   // Developer/QA can update status
  const isClient  = role === 'client';      // Client: read-only

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<Task | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [commitsTask, setCommitsTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState('ALL');

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', project.id],
    queryFn: () => projectService.getTasksByProject(project.id).then(r => r.data),
  });
  const { data: sprintsData } = useQuery({
    queryKey: ['sprints', project.id],
    queryFn: () => projectService.getSprintsByProject(project.id).then(r => r.data),
  });
  const { data: membersData } = useQuery({
    queryKey: ['project-members', project.id],
    queryFn: () => projectService.getProjectMembers(project.id).then(r => r.data),
  });

  const allTasks: Task[]           = tasksData?.data  || [];
  const sprints:  Sprint[]         = sprintsData?.data || [];
  const members:  ProjectMember[]  = membersData?.data || [];
  const tasks = filter === 'ALL' ? allTasks : allTasks.filter(t => t.status === filter);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectService.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', project.id] });
      queryClient.invalidateQueries({ queryKey: ['project-stats', project.id] });
      toast({ title: 'Task deleted' });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Tasks ({allTasks.length})</h3>
        {/* Create Task — project managers and above only */}
        {canWrite && (
          <button
            onClick={() => setModal('new')}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['ALL', ...TASK_STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === s ? 'bg-primary border-primary text-white' : 'border-border text-muted-foreground hover:text-white hover:border-primary/50'}`}>
            {s === 'ALL' ? 'All' : getStatusLabel(s)}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}

      {!isLoading && tasks.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <CheckSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-white mb-1">No tasks found</p>
          <p className="text-xs text-muted-foreground">{filter !== 'ALL' ? 'No tasks with this status.' : canWrite ? 'Create your first task.' : 'No tasks have been created yet.'}</p>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Task</th>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Assigned To</th>
                {!isClient && <th className="px-5 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-sm">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {task.taskKey && (
                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{task.taskKey}</span>
                      )}
                      <p className="font-medium text-white">{task.title}</p>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{task.description}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${priorityColor[task.priority] || ''}`}>{task.priority}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${task.status === 'DONE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : task.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : task.status === 'CODE_REVIEW' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : task.status === 'TESTING' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">
                    {task.assignedToId
                      ? (members.find(m => m.id === task.assignedToId)?.memberName || `Member #${task.assignedToId}`)
                      : '—'}
                  </td>
                  {!isClient && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {/* View Commits — all authenticated users */}
                        <button
                          onClick={() => setCommitsTask(task)}
                          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                          title="View related commits"
                        >
                          <GitCommit className="w-3.5 h-3.5" />
                        </button>
                        {/* Edit — developer/qa can update status; PM+ full edit */}
                        {canUpdate && (
                          <button
                            onClick={() => setModal(task)}
                            className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                            title={canWrite ? 'Edit task' : 'Update status'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* Delete — project managers and above only */}
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
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <TaskModal
          task={modal === 'new' ? undefined : modal}
          projectId={project.id}
          sprintOptions={sprints}
          memberOptions={members}
          onClose={() => setModal(null)}
          readOnlyStatus={!canWrite && canUpdate} // developer/qa: status-only
        />
      )}
      {commitsTask && (
        <TaskCommitsModal
          taskId={commitsTask.id}
          taskTitle={commitsTask.title}
          onClose={() => setCommitsTask(null)}
        />
      )}
      {canWrite && (
        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete Task"
          message={`Delete task "${deleteTarget?.title}"?`}
          confirmLabel="Delete"
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
