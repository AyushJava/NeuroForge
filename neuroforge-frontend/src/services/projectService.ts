import api from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id: number;
  projectName: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  methodology?: string;
  techStack?: string;
  organizationId?: number;
  organizationName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sprint {
  id: number;
  sprintName: string;
  goal?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  projectId: number;
}

export interface Milestone {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  targetDate: string;
  actualDate?: string;
  status: string;
}

export interface Task {
  id: number;
  taskKey?: string; // Module 7: Task key for commit linking (e.g., NF-123)
  title: string;
  description?: string;
  priority: string;
  status: string;
  storyPoints?: number;
  labels?: string;
  assignedToId?: number;
  projectId?: number;
  sprintId?: number;
  // Module 4: Specification Traceability
  specificationId?: string;
  specificationVersionId?: string;
  specificationTitle?: string;
  specificationVersionNumber?: number;
  createdAt?: string;
  updatedAt?: string;
}

// A member of an organization's team who has been assigned onto this project.
export interface ProjectMember {
  id: number;
  projectId: number;
  teamMemberId: number;
  memberName: string;
  memberEmail?: string;
  role: string;
  teamId?: number;
  teamName?: string;
  assignedAt?: string;
}

export interface ProjectStats {
  projectId: number;
  projectName: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  totalSprints: number;
  totalMembers: number;
  healthScore: number;
  healthStatus: string;
}

export interface CreateProjectRequest {
  projectName: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  methodology?: string;
  techStack?: string;
  organizationId: number;
}

export interface UpdateProjectRequest {
  projectName?: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  methodology?: string;
  techStack?: string;
}

export interface CreateSprintRequest {
  sprintName: string;
  goal?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  projectId: number;
}

export interface UpdateSprintRequest {
  sprintName?: string;
  goal?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateMilestoneRequest {
  projectId: number;
  name: string;
  description?: string;
  targetDate: string;
  status?: string;
}

export interface UpdateMilestoneRequest {
  name?: string;
  description?: string;
  targetDate?: string;
  actualDate?: string;
  status?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  storyPoints?: number;
  labels?: string;
  assignedToId?: number;
  projectId: number;
  sprintId?: number;
  // Module 4: Specification Traceability
  specificationId?: string;
  specificationVersionId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  storyPoints?: number;
  labels?: string;
  assignedToId?: number;
  sprintId?: number;
  // Module 4: Specification Traceability
  specificationId?: string;
  specificationVersionId?: string;
}

export interface AssignProjectMemberRequest {
  projectId: number;
  teamMemberId: number;
}

// Module 5: Task Status History
export interface TaskStatusHistory {
  id: number;
  taskId: number;
  previousStatus: string;
  newStatus: string;
  changedBy?: string;
  changedAt: string;
}

export interface UpdateTaskStatusRequest {
  status: string;
}

// Module 5: Sprint Analytics
export interface SprintSummary {
  id: number;
  sprintName: string;
  status: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  completionPercentage: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  remainingStoryPoints: number;
}

export interface SprintStatistics {
  todoTasks: number;
  inProgressTasks: number;
  testingTasks: number;
  codeReviewTasks: number;
  doneTasks: number;
  highPriorityTasks: number;
  criticalPriorityTasks: number;
  averageStoryPoints: number;
  completionPercentage: number;
}

export interface SprintProgress {
  sprintId: number;
  sprintName: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  remainingStoryPoints: number;
  completionPercentage: number;
  currentSprintStatus: string;
}

export interface BurndownPoint {
  date: string;
  remainingStoryPoints: number;
}

export interface SprintVelocity {
  completedStoryPoints: number;
  completedTasks: number;
  averageStoryPointsPerTask: number;
  completionPercentage: number;
}

export interface TaskDistribution {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byAssignee: Record<string, number>;
}

// ─── Date helper ─────────────────────────────────────────────────────────────
const toIso = (d?: string) => (d && d.length === 10 ? `${d}T00:00:00` : d);

const toIsoProject = (data: CreateProjectRequest | UpdateProjectRequest): any => ({
  ...data,
  startDate: toIso((data as any).startDate),
  endDate:   toIso((data as any).endDate),
});

const toIsoSprint = (data: CreateSprintRequest | UpdateSprintRequest): any => ({
  ...data,
  startDate: toIso((data as any).startDate),
  endDate:   toIso((data as any).endDate),
});

// ─── Service ──────────────────────────────────────────────────────────────────

export const projectService = {
  // ── Projects ─────────────────────────────────────────────────────────────
  getAll: () => api.get<any>('/projects'),
  getByOrganization: (orgId: number) => api.get<any>(`/projects/organization/${orgId}`),
  getById: (id: number) => api.get<any>(`/projects/${id}`),
  create: (data: CreateProjectRequest) => api.post<any>('/projects', toIsoProject(data)),
  update: (id: number, data: UpdateProjectRequest) => api.put<any>(`/projects/${id}`, toIsoProject(data)),
  delete: (id: number) => api.delete(`/projects/${id}`),
  getStats: (id: number) => api.get<any>(`/projects/${id}/stats`),
  getPortfolio: (orgId: number) => api.get<any>(`/projects/portfolio/${orgId}`),

  // ── Sprints ─────────────────────────────────────────────────────────────
  createSprint: (data: CreateSprintRequest) => api.post<any>('/sprints', toIsoSprint(data)),
  getSprintsByProject: (projectId: number) => api.get<any>(`/sprints/project/${projectId}`),
  getSprintById: (id: number) => api.get<any>(`/sprints/${id}`),
  updateSprint: (id: number, data: UpdateSprintRequest) => api.put<any>(`/sprints/${id}`, toIsoSprint(data)),
  deleteSprint: (id: number) => api.delete(`/sprints/${id}`),
  // Module 5: Sprint lifecycle
  startSprint: (id: number) => api.post<any>(`/sprints/${id}/start`),
  completeSprint: (id: number) => api.post<any>(`/sprints/${id}/complete`),
  // Module 5: Sprint analytics
  getSprintSummary: (id: number) => api.get<any>(`/sprints/${id}/summary`),
  getSprintStatistics: (id: number) => api.get<any>(`/sprints/${id}/statistics`),
  getSprintProgress: (id: number) => api.get<any>(`/sprints/${id}/progress`),
  getSprintBurndown: (id: number) => api.get<any>(`/sprints/${id}/burndown`),
  getSprintVelocity: (id: number) => api.get<any>(`/sprints/${id}/velocity`),
  getTaskDistribution: (id: number) => api.get<any>(`/sprints/${id}/distribution`),

  // ── Milestones ───────────────────────────────────────────────────────────
  createMilestone: (data: CreateMilestoneRequest) => api.post<any>('/milestones', data),
  getMilestonesByProject: (projectId: number) => api.get<any>(`/milestones/project/${projectId}`),
  getMilestoneById: (id: number) => api.get<any>(`/milestones/${id}`),
  updateMilestone: (id: number, data: UpdateMilestoneRequest) => api.put<any>(`/milestones/${id}`, data),
  deleteMilestone: (id: number) => api.delete(`/milestones/${id}`),

  // ── Tasks ───────────────────────────────────────────────────────────────
  createTask: (data: CreateTaskRequest) => api.post<any>('/tasks', data),
  getTasksByProject: (projectId: number) => api.get<any>(`/tasks/project/${projectId}`),
  getTasksBySprint: (sprintId: number) => api.get<any>(`/tasks/sprint/${sprintId}`),
  getTaskById: (id: number) => api.get<any>(`/tasks/${id}`),
  updateTask: (id: number, data: UpdateTaskRequest) => api.put<any>(`/tasks/${id}`, data),
  deleteTask: (id: number) => api.delete(`/tasks/${id}`),
  // Module 5: Task status update with history
  updateTaskStatus: (id: number, data: UpdateTaskStatusRequest) => api.put<any>(`/tasks/${id}/status`, data),
  getTaskHistory: (id: number) => api.get<any>(`/tasks/${id}/history`),

  // ── Project Members ──────────────────────────────────────────────────────
  assignMember: (data: AssignProjectMemberRequest) => api.post<any>('/project-members', data),
  getProjectMembers: (projectId: number) => api.get<any>(`/project-members/${projectId}`),
  removeMember: (projectMemberId: number) => api.delete(`/project-members/${projectMemberId}`),
};
