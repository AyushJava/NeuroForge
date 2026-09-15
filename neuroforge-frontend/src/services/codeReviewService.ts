import api from './api';

export interface AnalyzeReviewRequest {
  taskId: number;
  requestedBy: number;
  reviewSource: 'MANUAL' | 'PASTED_CODE' | 'COMMIT';
  language: string;
  sourceCode: string;
  commitSha?: string;
}

export interface ReviewIssue {
  line: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  description: string;
  suggestion: string;
}

export interface AnalyzeReviewResponse {
  reviewId: string;
  overallScore: number;
  summary: string;
  issues: ReviewIssue[];
}

export interface CreateCodeReviewRequest {
  taskId: number;
  requestedBy: number;
  reviewSource: 'MANUAL' | 'PASTED_CODE' | 'COMMIT';
  sourceReference?: string;
}

export interface CodeReviewResponse {
  id: number;
  taskId: number;
  requestedBy: number;
  approvedBy: number | null;
  status: 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ACCEPTED' | 'REJECTED';
  reviewSource: 'MANUAL' | 'PASTED_CODE' | 'COMMIT';
  overallScore: number | null;
  summary: string | null;
  sourceReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCodeReviewStatusRequest {
  status: 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ACCEPTED' | 'REJECTED';
  overallScore?: number;
  summary?: string;
}

export interface QualityTrendResponse {
  developerId: number;
  developerName: string;
  averageScore: number;
  totalReviews: number;
  acceptedReviews: number;
  rejectedReviews: number;
  trendData: TrendDataPoint[];
}

export interface TrendDataPoint {
  date: string;
  score: number | null;
  status: string;
}

export const codeReviewService = {
  // Analyze code with AI
  analyzeReview: async (request: AnalyzeReviewRequest): Promise<AnalyzeReviewResponse> => {
    const response = await api.post<AnalyzeReviewResponse>('/reviews/analyze', request);
    return response.data;
  },

  // Create code review
  createCodeReview: async (request: CreateCodeReviewRequest): Promise<CodeReviewResponse> => {
    const response = await api.post<CodeReviewResponse>('/code-reviews', request);
    return response.data;
  },

  // Get all code reviews
  getAllCodeReviews: async (): Promise<CodeReviewResponse[]> => {
    const response = await api.get<CodeReviewResponse[]>('/code-reviews');
    return response.data;
  },

  // Get code review by ID
  getCodeReviewById: async (id: number): Promise<CodeReviewResponse> => {
    const response = await api.get<CodeReviewResponse>(`/code-reviews/${id}`);
    return response.data;
  },

  // Get code reviews by task
  getCodeReviewsByTask: async (taskId: number): Promise<CodeReviewResponse[]> => {
    const response = await api.get<CodeReviewResponse[]>(`/code-reviews/task/${taskId}`);
    return response.data;
  },

  // Get code reviews by status
  getCodeReviewsByStatus: async (status: string): Promise<CodeReviewResponse[]> => {
    const response = await api.get<CodeReviewResponse[]>(`/code-reviews/status/${status}`);
    return response.data;
  },

  // Get latest review for task
  getLatestReviewForTask: async (taskId: number): Promise<CodeReviewResponse> => {
    const response = await api.get<CodeReviewResponse>(`/code-reviews/task/${taskId}/latest`);
    return response.data;
  },

  // Update review status
  updateReviewStatus: async (reviewId: number, request: UpdateCodeReviewStatusRequest): Promise<CodeReviewResponse> => {
    const response = await api.patch<CodeReviewResponse>(`/code-reviews/${reviewId}/status`, request);
    return response.data;
  },

  // Approve review
  approveReview: async (reviewId: number): Promise<CodeReviewResponse> => {
    const response = await api.patch<CodeReviewResponse>(`/code-reviews/${reviewId}/approve`);
    return response.data;
  },

  // Reject review
  rejectReview: async (reviewId: number): Promise<CodeReviewResponse> => {
    const response = await api.patch<CodeReviewResponse>(`/code-reviews/${reviewId}/reject`);
    return response.data;
  },

  // Delete code review
  deleteCodeReview: async (reviewId: number): Promise<void> => {
    await api.delete(`/code-reviews/${reviewId}`);
  },

  // Get quality trends for developer
  getQualityTrendsForDeveloper: async (developerId: number): Promise<QualityTrendResponse> => {
    const response = await api.get<QualityTrendResponse>(`/code-reviews/trends/developer/${developerId}`);
    return response.data;
  },

  // Get quality trends for all developers
  getQualityTrendsForAllDevelopers: async (orgId?: number): Promise<QualityTrendResponse[]> => {
    const params = orgId ? { orgId } : {};
    const response = await api.get<QualityTrendResponse[]>('/code-reviews/trends/all', { params });
    return response.data;
  },
};
