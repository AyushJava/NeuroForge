import api from './api';

export interface AnalyticsDashboardResponse {
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  completionPercentage: number;
  averageCycleTimeHours: number;
  totalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  infoIssues: number;
  successfulDeployments: number;
  productionDeploymentAttempts: number;
  failedProductionDeployments: number;
  deploymentFrequencyPerDay: number;
  changeFailureRate: number;
}

export interface SprintAnalyticsResponse {
  sprintId: number;
  sprintName: string;
  sprintStatus: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  completionPercentage: number;
}

export interface SprintHealthSummaryResponse {
  sprintId: number;
  sprintName: string;
  generatedAt: string;
  overallHealth: string;
  summary: string;
  risks: string[];
  recommendations: string[];
}

export interface DeveloperAnalyticsResponse {
  userId: number;
  assignedTasks: number;
  completedTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  codeReviewTasks: number;
  testingTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  completionPercentage: number;
}

export interface TaskDistributionResponse {
  todo: number;
  inProgress: number;
  codeReview: number;
  testing: number;
  done: number;
}

export interface VelocityPointResponse {
  sprintId: number;
  sprintName: string;
  completedStoryPoints: number;
  completedTasks: number;
  sprintEndDate: string;
}

export interface VelocityResponse {
  sprints: VelocityPointResponse[];
}

export interface BurndownPointResponse {
  date: string;
  remainingStoryPoints: number;
  completedStoryPoints: number;
}

export interface BurndownResponse {
  sprintId: number;
  sprintName: string;
  startDate: string;
  endDate: string;
  totalStoryPoints: number;
  points: BurndownPointResponse[];
}

export interface IssueTrendPointResponse {
  date: string;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  infoIssues: number;
}

export interface IssueTrendResponse {
  points: IssueTrendPointResponse[];
}

export interface CycleTimePointResponse {
  taskId: number;
  taskTitle: string;
  sprintId: number;
  startedAt: string;
  completedAt: string;
  cycleTimeMinutes: number;
}

export interface CycleTimeResponse {
  averageCycleTimeHours: number;
  measuredTasks: number;
  points: CycleTimePointResponse[];
}

export interface DeploymentFrequencyResponse {
  deploymentsPerDay: number;
  trend: string;
}

export interface ChangeFailureRateResponse {
  failureRate: number;
  trend: string;
}

export interface MetricsSnapshotResponse {
  id: string;
  snapshotDate: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  completionPercentage: number;
  averageCycleTimeHours: number;
  totalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  infoIssues: number;
  successfulDeployments: number;
  productionDeploymentAttempts: number;
  failedProductionDeployments: number;
  deploymentFrequencyPerDay: number;
  changeFailureRate: number;
}

export interface VelocityHistoryResponse {
  sprints: VelocityPointResponse[];
}

export interface PortfolioHealthResponse {
  organizationId: number;
  organizationName: string;
  totalProjects: number;
  healthyProjects: number;
  atRiskProjects: number;
  criticalProjects: number;
  overallCompletionPercentage: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  totalTasks: number;
  completedTasks: number;
  projectSummaries: ProjectHealthSummary[];
}

export interface ProjectHealthSummary {
  projectId: number;
  projectName: string;
  teamId: number;
  healthStatus: string;
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  activeSprints: number;
  completedSprints: number;
}

const analyticsService = {
  // Dashboard
  getDashboard: (orgId?: number) => api.get<AnalyticsDashboardResponse>('/analytics/dashboard', { params: orgId ? { orgId } : {} }),

  // Portfolio Health
  getPortfolioHealth: (orgId: number) => api.get<PortfolioHealthResponse>(`/analytics/portfolio/organization/${orgId}`),

  // Sprint Analytics
  getSprintAnalytics: (sprintId: number) => api.get<SprintAnalyticsResponse>(`/analytics/sprint/${sprintId}`),
  getSprintHealthSummary: (sprintId: number) => api.get<SprintHealthSummaryResponse>(`/analytics/sprint/${sprintId}/health-summary`),
  getSprintReportPdf: (sprintId: number) => api.get(`/analytics/reports/sprint/${sprintId}/pdf`, { responseType: 'blob' }),

  // Developer Analytics
  getDeveloperAnalytics: (userId: number) => api.get<DeveloperAnalyticsResponse>(`/analytics/developer/${userId}`),

  // Task Distribution
  getTaskDistribution: (orgId?: number) => api.get<TaskDistributionResponse>('/analytics/task-distribution', { params: orgId ? { orgId } : {} }),

  // Velocity
  getVelocity: (orgId?: number) => api.get<VelocityResponse>('/analytics/velocity', { params: orgId ? { orgId } : {} }),
  getVelocityHistory: () => api.get<VelocityHistoryResponse>('/analytics/velocity-history'),

  // Burndown
  getBurndown: (orgId?: number) => api.get<BurndownResponse>('/analytics/burndown', { params: orgId ? { orgId } : {} }),

  // Issue Trends
  getIssueTrend: (orgId?: number) => api.get<IssueTrendResponse>('/analytics/issue-trend', { params: orgId ? { orgId } : {} }),

  // Cycle Time
  getCycleTime: (orgId?: number) => api.get<CycleTimeResponse>('/analytics/cycle-time', { params: orgId ? { orgId } : {} }),

  // Deployment Metrics
  getDeploymentFrequency: () => api.get<DeploymentFrequencyResponse>('/analytics/deployment-frequency'),
  getChangeFailureRate: () => api.get<ChangeFailureRateResponse>('/analytics/change-failure-rate'),

  // Metrics Snapshots
  getSnapshot: (date: string) => api.get<MetricsSnapshotResponse>(`/analytics/snapshots/${date}`),
  getSnapshots: (startDate: string, endDate: string) =>
    api.get<MetricsSnapshotResponse[]>('/analytics/snapshots', { params: { startDate, endDate } }),
};

export default analyticsService;
