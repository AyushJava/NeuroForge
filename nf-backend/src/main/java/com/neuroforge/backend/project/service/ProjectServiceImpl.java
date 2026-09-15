package com.neuroforge.backend.project.service;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.organization.entity.Organization;
import com.neuroforge.backend.organization.repository.OrganizationRepository;
import com.neuroforge.backend.project.dto.*;
import com.neuroforge.backend.project.entity.Project;
import com.neuroforge.backend.project.repository.ProjectMemberRepository;
import com.neuroforge.backend.project.repository.ProjectRepository;
import com.neuroforge.backend.project.repository.SprintRepository;
import com.neuroforge.backend.project.repository.TaskRepository;
import com.neuroforge.backend.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectServiceImpl implements ProjectService {

    private final ProjectRepository projectRepository;
    private final OrganizationRepository organizationRepository;
    private final TaskRepository taskRepository;
    private final SprintRepository sprintRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final com.neuroforge.backend.project.repository.ProjectHealthSnapshotRepository healthSnapshotRepository;

    @Override
    @Transactional
    public ApiResponse<ProjectDto> createProject(CreateProjectRequest request) {
        Organization organization = organizationRepository.findById(request.getOrganizationId())
                .orElseThrow(() -> AppException.notFound("Organization not found"));
        Project project = Project.builder()
                .projectName(request.getProjectName())
                .description(request.getDescription())
                .status(request.getStatus() == null ? "ACTIVE" : request.getStatus())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .methodology(request.getMethodology())
                .techStack(request.getTechStack())
                .organization(organization)
                .build();
        project = projectRepository.save(project);
        return ApiResponse.ok("Project created successfully", ProjectDto.from(project));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<ProjectDto>> getAllProjects(User currentUser) {
        List<Project> projects;
        boolean isSuperAdmin = "ROLE_SUPER_ADMIN".equals(currentUser.getRole());
        boolean isOrgAdmin = "ROLE_ORG_ADMIN".equals(currentUser.getRole());
        boolean isProjectManager = "ROLE_PROJECT_MANAGER".equals(currentUser.getRole());
        boolean isDeveloper = "ROLE_DEVELOPER".equals(currentUser.getRole());
        boolean isQA = "ROLE_QA".equals(currentUser.getRole());
        boolean isClient = "ROLE_CLIENT".equals(currentUser.getRole());

        if (isSuperAdmin) {
            // Super admins can see all projects
            projects = projectRepository.findAllWithOrganization();
        } else if (isOrgAdmin || isProjectManager) {
            // Org Admin and Project Manager see all projects in their organization
            if (currentUser.getOrganizationId() == null) {
                return ApiResponse.ok("Projects retrieved successfully", List.of());
            }
            projects = projectRepository.findByOrganizationIdWithOrganization(currentUser.getOrganizationId());
        } else if (isDeveloper || isQA) {
            // Developers and QA see only projects they are assigned to
            projects = projectRepository.findAssignedProjectsByUserId(currentUser.getId());
        } else if (isClient) {
            // Clients see projects they are assigned to (if any)
            projects = projectRepository.findAssignedProjectsByUserId(currentUser.getId());
        } else {
            // Other roles: no projects
            return ApiResponse.ok("Projects retrieved successfully", List.of());
        }

        List<ProjectDto> projectDtos = projects.stream().map(project -> {
            ProjectDto dto = ProjectDto.from(project);
            long totalTasks = taskRepository.countByProjectId(project.getId());
            long completedTasks = taskRepository.countByProjectIdAndStatus(project.getId(), "DONE");
            double progress = totalTasks == 0 ? 0 : (completedTasks * 100.0) / totalTasks;
            dto.setProgress(Math.round(progress * 100.0) / 100.0);
            return dto;
        }).collect(Collectors.toList());
        return ApiResponse.ok("Projects retrieved successfully", projectDtos);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<ProjectDto>> getProjectsByOrganization(Long organizationId) {
        List<Project> projects = projectRepository.findByOrganizationIdWithOrganization(organizationId);
        List<ProjectDto> projectDtos = projects.stream().map(project -> {
            ProjectDto dto = ProjectDto.from(project);
            long totalTasks = taskRepository.countByProjectId(project.getId());
            long completedTasks = taskRepository.countByProjectIdAndStatus(project.getId(), "DONE");
            double progress = totalTasks == 0 ? 0 : (completedTasks * 100.0) / totalTasks;
            dto.setProgress(Math.round(progress * 100.0) / 100.0);
            return dto;
        }).collect(Collectors.toList());
        return ApiResponse.ok("Projects retrieved successfully", projectDtos);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<ProjectDto> getProjectById(Long id) {
        Project project = projectRepository.findByIdWithOrganization(id)
                .orElseThrow(() -> AppException.notFound("Project not found"));
        
        // Validate organization membership (IDOR protection)
        if (!SecurityUtils.isSuperAdmin()) {
            Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                    .orElseThrow(() -> AppException.forbidden("User has no organization"));
            if (!project.getOrganization().getId().equals(userOrgId)) {
                throw AppException.forbidden("Access denied: project belongs to a different organization");
            }
        }
        
        return ApiResponse.ok("Project found", ProjectDto.from(project));
    }

    @Override
    @Transactional
    public ApiResponse<ProjectDto> updateProject(Long id, UpdateProjectRequest request) {
        Project project = projectRepository.findByIdWithOrganization(id)
                .orElseThrow(() -> AppException.notFound("Project not found"));
        
        // Validate organization membership
        if (!SecurityUtils.isSuperAdmin()) {
            Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                    .orElseThrow(() -> AppException.forbidden("User has no organization"));
            if (!project.getOrganization().getId().equals(userOrgId)) {
                throw AppException.forbidden("Access denied: project belongs to a different organization");
            }
        }
        
        if (request.getProjectName() != null)  project.setProjectName(request.getProjectName());
        if (request.getDescription() != null)  project.setDescription(request.getDescription());
        if (request.getStatus() != null)        project.setStatus(request.getStatus());
        if (request.getStartDate() != null)     project.setStartDate(request.getStartDate());
        if (request.getEndDate() != null)       project.setEndDate(request.getEndDate());
        if (request.getMethodology() != null)   project.setMethodology(request.getMethodology());
        if (request.getTechStack() != null)     project.setTechStack(request.getTechStack());
        project = projectRepository.save(project);
        return ApiResponse.ok("Project updated successfully", ProjectDto.from(project));
    }

    @Override
    @Transactional
    public ApiResponse<Void> deleteProject(Long id) {
        Project project = projectRepository.findByIdWithOrganization(id)
                .orElseThrow(() -> AppException.notFound("Project not found"));
        
        // Validate organization membership
        if (!SecurityUtils.isSuperAdmin()) {
            Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                    .orElseThrow(() -> AppException.forbidden("User has no organization"));
            if (!project.getOrganization().getId().equals(userOrgId)) {
                throw AppException.forbidden("Access denied: project belongs to a different organization");
            }
        }
        
        projectRepository.deleteById(id);
        return ApiResponse.ok("Project deleted successfully");
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<ProjectStatsDto> getProjectStats(Long id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Project not found"));
        long totalTasks     = taskRepository.countByProjectId(id);
        long completedTasks = taskRepository.countByProjectIdAndStatus(id, "DONE");
        long inProgressTasks = taskRepository.countByProjectIdAndStatus(id, "IN_PROGRESS");
        long todoTasks      = taskRepository.countByProjectIdAndStatus(id, "TODO");
        long totalSprints   = sprintRepository.findByProjectId(id).size();
        long totalMembers   = projectMemberRepository.findByProject(project).size();
        int healthScore = 100;
        if (totalTasks > 0) {
            healthScore = (int) ((double) completedTasks / totalTasks * 100);
        }
        if ("COMPLETED".equals(project.getStatus())) healthScore = 100;
        String healthStatus = healthScore >= 70 ? "HEALTHY" : healthScore >= 40 ? "AT_RISK" : "CRITICAL";
        ProjectStatsDto stats = ProjectStatsDto.builder()
                .projectId(id).projectName(project.getProjectName()).status(project.getStatus())
                .totalTasks(totalTasks).completedTasks(completedTasks)
                .inProgressTasks(inProgressTasks).todoTasks(todoTasks)
                .totalSprints(totalSprints).totalMembers(totalMembers)
                .healthScore(healthScore).healthStatus(healthStatus)
                .build();
        return ApiResponse.ok("Project stats retrieved", stats);
    }

    // ── Module 3: Portfolio View ──────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<PortfolioProjectDto>> getPortfolio(Long organizationId) {
        List<Project> projects = projectRepository.findByOrganizationIdWithOrganization(organizationId);
        
        List<PortfolioProjectDto> portfolio = projects.stream().map(project -> {
            // Get latest health snapshot for this project
            String health = "HEALTHY"; // Default
            java.util.Optional<com.neuroforge.backend.project.entity.ProjectHealthSnapshot> latestSnapshot = 
                healthSnapshotRepository.findFirstByProjectIdOrderBySnapshotDateDesc(project.getId());
            
            if (latestSnapshot.isPresent()) {
                health = latestSnapshot.get().getHealthStatus();
            } else {
                // Fallback to simple calculation if no snapshot exists
                long totalTasks = taskRepository.countByProjectId(project.getId());
                long completedTasks = taskRepository.countByProjectIdAndStatus(project.getId(), "DONE");
                double completionRate = totalTasks > 0 ? (completedTasks * 100.0 / totalTasks) : 0;
                if (completionRate >= 70) health = "HEALTHY";
                else if (completionRate >= 40) health = "AT_RISK";
                else health = "CRITICAL";
            }
            
            return PortfolioProjectDto.from(project, health);
        }).collect(Collectors.toList());
        
        return ApiResponse.ok("Portfolio retrieved successfully", portfolio);
    }

    // ── Module 3: Project Dashboard ───────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<ProjectDashboardDto> getDashboard(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Project not found"));
        long totalTasks      = taskRepository.countByProjectId(projectId);
        long completedTasks  = taskRepository.countByProjectIdAndStatus(projectId, "DONE");
        long pendingTasks    = taskRepository.countByProjectIdAndStatus(projectId, "TODO");
        long inProgressTasks = taskRepository.countByProjectIdAndStatus(projectId, "IN_PROGRESS");
        long totalMembers    = projectMemberRepository.countByProjectId(projectId);
        long totalSprints    = sprintRepository.countByProjectId(projectId);
        double progress = totalTasks == 0 ? 0 : (completedTasks * 100.0) / totalTasks;
        ProjectDashboardDto dashboard = ProjectDashboardDto.builder()
                .projectId(project.getId()).projectName(project.getProjectName())
                .totalTasks(totalTasks).completedTasks(completedTasks)
                .pendingTasks(pendingTasks).inProgressTasks(inProgressTasks)
                .totalMembers(totalMembers).totalSprints(totalSprints)
                .progress(progress)
                .build();
        return ApiResponse.ok("Dashboard retrieved successfully", dashboard);
    }
}
