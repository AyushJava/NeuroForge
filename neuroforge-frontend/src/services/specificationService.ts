import api from './api';

export interface Specification {
  id: string;
  specificationKey: string;
  title: string;
  currentVersion: number;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  organizationId?: number;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpecificationVersion {
  id: string;
  specificationId: string;
  versionNumber: number;
  description: string;
  userStories: string;
  acceptanceCriteria: string;
  functionalRequirements: string;
  nonFunctionalRequirements: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  generatedBy: string;
  generatedAt: string;
  reviewedBy: string;
  reviewedAt: string;
  approvedBy: string;
  approvedAt: string;
  reviewComments: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpecificationRequest {
  title: string;
  description: string;
  userStories: string;
  acceptanceCriteria: string;
  functionalRequirements: string;
  nonFunctionalRequirements: string;
}

export interface UpdateSpecificationRequest {
  description: string;
  userStories: string;
  acceptanceCriteria: string;
  functionalRequirements: string;
  nonFunctionalRequirements: string;
}

export interface GenerateSpecificationRequest {
  prompt: string;
  projectId?: string;
}

export interface GenerateSpecificationResponse {
  description: string;
  userStories: string[];
  acceptanceCriteria: string[];
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
}

export interface SaveAISpecificationRequest {
  title: string;
  projectId?: string;
  description: string;
  userStories: string[];
  acceptanceCriteria: string[];
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  aiSpecificationId?: string;
  organizationId?: number;
}

export const specificationService = {
  getAll: (params?: { title?: string; status?: string; orgId?: number; page?: number; size?: number }) =>
    api.get('/specifications', { params }),

  getApprovedSpecificationsByProject: (projectId: number) =>
    api.get(`/specifications/project/${projectId}/approved`),

  getById: (id: string) =>
    api.get(`/specifications/${id}`),
  
  create: (data: CreateSpecificationRequest) =>
    api.post('/specifications', data),
  
  update: (id: string, data: UpdateSpecificationRequest) =>
    api.put(`/specifications/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/specifications/${id}`),
  
  // Version management
  getVersions: (id: string) =>
    api.get(`/specifications/${id}/versions`),
  
  getVersion: (id: string, version: number) =>
    api.get(`/specifications/${id}/versions/${version}`),
  
  getLatest: (id: string) =>
    api.get(`/specifications/${id}/latest`),
  
  updateDraftVersion: (id: string, version: number, data: UpdateSpecificationRequest) =>
    api.put(`/specifications/${id}/versions/${version}`, data),
  
  // Approval workflow
  submitForReview: (id: string, version: number) =>
    api.post(`/specifications/${id}/versions/${version}/submit`),
  
  approve: (id: string, version: number) =>
    api.post(`/specifications/${id}/versions/${version}/approve`),
  
  reject: (id: string, version: number, data: { reviewComments: string }) =>
    api.post(`/specifications/${id}/versions/${version}/reject`, data),
  
  archive: (id: string, version: number) =>
    api.post(`/specifications/${id}/versions/${version}/archive`),
  
  // Version comparison
  compare: (id: string, v1: number, v2: number) =>
    api.get(`/specifications/${id}/versions/${v1}/compare/${v2}`),

  // Module 4: AI Generation
  generate: (data: GenerateSpecificationRequest) =>
    api.post('/specifications/generate', data),

  saveAI: (data: SaveAISpecificationRequest) =>
    api.post('/specifications/save-ai', data),
};
