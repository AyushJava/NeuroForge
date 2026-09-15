package com.neuroforge.backend.project.controller;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.project.dto.*;
import com.neuroforge.backend.project.service.MilestoneService;
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
@RequestMapping("/api/milestones")
@RequiredArgsConstructor
@Tag(name = "Milestone Management")
@SecurityRequirement(name = "bearerAuth")
public class MilestoneController {

    private final MilestoneService milestoneService;

    @PostMapping
    @Operation(summary = "Create Milestone")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<MilestoneDto>> createMilestone(
            @Valid @RequestBody CreateMilestoneRequest request) {
        return ResponseEntity.ok(milestoneService.createMilestone(request));
    }

    @GetMapping("/project/{projectId}")
    @Operation(summary = "Get Milestones by Project")
    public ResponseEntity<ApiResponse<List<MilestoneDto>>> getMilestonesByProject(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(milestoneService.getMilestonesByProject(projectId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get Milestone by ID")
    public ResponseEntity<ApiResponse<MilestoneDto>> getMilestoneById(@PathVariable Long id) {
        return ResponseEntity.ok(milestoneService.getMilestoneById(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update Milestone")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<MilestoneDto>> updateMilestone(
            @PathVariable Long id,
            @Valid @RequestBody UpdateMilestoneRequest request) {
        return ResponseEntity.ok(milestoneService.updateMilestone(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete Milestone")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<Void>> deleteMilestone(@PathVariable Long id) {
        return ResponseEntity.ok(milestoneService.deleteMilestone(id));
    }
}
