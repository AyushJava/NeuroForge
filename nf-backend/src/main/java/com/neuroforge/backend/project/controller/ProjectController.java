package com.neuroforge.backend.project.controller;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.project.dto.*;
import com.neuroforge.backend.project.service.ProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
@Tag(name = "Project Management")
@SecurityRequirement(name = "bearerAuth")
public class ProjectController {

    private final ProjectService projectService;

    // ── Write operations: Project Manager, Org Admin, Super Admin ────────────

    @PostMapping
    @Operation(summary = "Create Project")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<ProjectDto>> createProject(
            @Valid @RequestBody CreateProjectRequest request) {
        return ResponseEntity.ok(projectService.createProject(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update Project")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<ProjectDto>> updateProject(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProjectRequest request) {
        return ResponseEntity.ok(projectService.updateProject(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete Project")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<Void>> deleteProject(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.deleteProject(id));
    }

    // ── Read operations: all authenticated users ──────────────────────────────

    @GetMapping
    @Operation(summary = "Get all projects")
    public ResponseEntity<ApiResponse<List<ProjectDto>>> getAllProjects(
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.neuroforge.backend.entity.User currentUser) {
        return ResponseEntity.ok(projectService.getAllProjects(currentUser));
    }

    @GetMapping("/organization/{organizationId}")
    @Operation(summary = "Get projects by organization")
    public ResponseEntity<ApiResponse<List<ProjectDto>>> getProjectsByOrg(
            @PathVariable Long organizationId) {
        return ResponseEntity.ok(projectService.getProjectsByOrganization(organizationId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get Project")
    public ResponseEntity<ApiResponse<ProjectDto>> getProject(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getProjectById(id));
    }

    @GetMapping("/{id}/stats")
    @Operation(summary = "Get Project Stats")
    public ResponseEntity<ApiResponse<ProjectStatsDto>> getStats(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getProjectStats(id));
    }

    // ── Module 3: Portfolio View ───────────────────────────────────────────

    @GetMapping("/portfolio/{organizationId}")
    @Operation(summary = "Get Project Portfolio")
    public ResponseEntity<ApiResponse<List<PortfolioProjectDto>>> getPortfolio(
            @PathVariable Long organizationId) {
        return ResponseEntity.ok(projectService.getPortfolio(organizationId));
    }

    // ── Module 3: Project Dashboard ───────────────────────────────────────

    @GetMapping("/dashboard/{projectId}")
    @Operation(summary = "Get Project Dashboard")
    public ResponseEntity<ApiResponse<ProjectDashboardDto>> getDashboard(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(projectService.getDashboard(projectId));
    }
}
