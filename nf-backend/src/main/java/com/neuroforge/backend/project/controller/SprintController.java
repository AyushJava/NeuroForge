package com.neuroforge.backend.project.controller;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.project.dto.*;
import com.neuroforge.backend.project.service.SprintService;
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
@RequestMapping("/api/sprints")
@RequiredArgsConstructor
@Tag(name = "Sprint Management")
@SecurityRequirement(name = "bearerAuth")
public class SprintController {

    private final SprintService sprintService;

    // ── Write operations: Project Manager, Org Admin, Super Admin ────────────

    @PostMapping
    @Operation(summary = "Create Sprint")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<SprintDto>> createSprint(
            @Valid @RequestBody CreateSprintRequest request) {
        return ResponseEntity.ok(sprintService.createSprint(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update Sprint")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<SprintDto>> updateSprint(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSprintRequest request) {
        return ResponseEntity.ok(sprintService.updateSprint(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete Sprint")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<Void>> deleteSprint(
            @PathVariable Long id) {
        return ResponseEntity.ok(sprintService.deleteSprint(id));
    }

    // ── Read operations: all authenticated users ──────────────────────────────

    @GetMapping
    @Operation(summary = "Get All Sprints")
    public ResponseEntity<ApiResponse<List<SprintDto>>> getAllSprints() {
        return ResponseEntity.ok(sprintService.getAllSprints());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get Sprint By Id")
    public ResponseEntity<ApiResponse<SprintDto>> getSprintById(
            @PathVariable Long id) {
        return ResponseEntity.ok(sprintService.getSprintById(id));
    }

    @GetMapping("/project/{projectId}")
    @Operation(summary = "Get Sprints By Project")
    public ResponseEntity<ApiResponse<List<SprintDto>>> getProjectSprints(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(sprintService.getProjectSprints(projectId));
    }

    // ── Module 5: Sprint Lifecycle ─────────────────────────────────────────────

    @PostMapping("/{id}/start")
    @Operation(summary = "Start Sprint")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<SprintDto>> startSprint(@PathVariable Long id) {
        return ResponseEntity.ok(sprintService.startSprint(id));
    }

    @PostMapping("/{id}/complete")
    @Operation(summary = "Complete Sprint")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<SprintDto>> completeSprint(@PathVariable Long id) {
        return ResponseEntity.ok(sprintService.completeSprint(id));
    }

    // ── Module 5: Sprint Analytics ───────────────────────────────────────────────

    @GetMapping("/{id}/summary")
    @Operation(summary = "Get Sprint Summary")
    public ResponseEntity<ApiResponse<SprintSummaryResponse>> getSprintSummary(@PathVariable Long id) {
        return ResponseEntity.ok(sprintService.getSprintSummary(id));
    }

    @GetMapping("/{id}/statistics")
    @Operation(summary = "Get Sprint Statistics")
    public ResponseEntity<ApiResponse<SprintStatisticsResponse>> getSprintStatistics(@PathVariable Long id) {
        return ResponseEntity.ok(sprintService.getSprintStatistics(id));
    }

    @GetMapping("/{id}/progress")
    @Operation(summary = "Get Sprint Progress")
    public ResponseEntity<ApiResponse<SprintProgressResponse>> getSprintProgress(@PathVariable Long id) {
        return ResponseEntity.ok(sprintService.getSprintProgress(id));
    }

    @GetMapping("/{id}/burndown")
    @Operation(summary = "Get Sprint Burndown")
    public ResponseEntity<ApiResponse<List<BurndownPointResponse>>> getSprintBurndown(@PathVariable Long id) {
        return ResponseEntity.ok(sprintService.getSprintBurndown(id));
    }

    @GetMapping("/{id}/velocity")
    @Operation(summary = "Get Sprint Velocity")
    public ResponseEntity<ApiResponse<SprintVelocityResponse>> getSprintVelocity(@PathVariable Long id) {
        return ResponseEntity.ok(sprintService.getSprintVelocity(id));
    }

    @GetMapping("/{id}/distribution")
    @Operation(summary = "Get Task Distribution")
    public ResponseEntity<ApiResponse<TaskDistributionResponse>> getTaskDistribution(@PathVariable Long id) {
        return ResponseEntity.ok(sprintService.getTaskDistribution(id));
    }
}
