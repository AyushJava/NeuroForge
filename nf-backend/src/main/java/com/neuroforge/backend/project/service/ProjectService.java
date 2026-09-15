package com.neuroforge.backend.project.service;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.project.dto.*;

import java.util.List;

public interface ProjectService {

    ApiResponse<ProjectDto> createProject(CreateProjectRequest request);

    ApiResponse<List<ProjectDto>> getAllProjects(User currentUser);

    ApiResponse<List<ProjectDto>> getProjectsByOrganization(Long organizationId);

    ApiResponse<ProjectDto> getProjectById(Long id);

    ApiResponse<ProjectDto> updateProject(Long id, UpdateProjectRequest request);

    ApiResponse<Void> deleteProject(Long id);

    ApiResponse<ProjectStatsDto> getProjectStats(Long id);

    // Module 3 additions
    ApiResponse<List<PortfolioProjectDto>> getPortfolio(Long organizationId);

    ApiResponse<ProjectDashboardDto> getDashboard(Long projectId);
}
