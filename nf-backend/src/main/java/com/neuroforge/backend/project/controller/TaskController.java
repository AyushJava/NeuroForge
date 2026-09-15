package com.neuroforge.backend.project.controller;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.project.dto.*;
import com.neuroforge.backend.project.service.TaskService;
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
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
@Tag(name = "Task Management")
@SecurityRequirement(name = "bearerAuth")
public class TaskController {

    private final TaskService taskService;

    // ── Write operations restricted by role ──────────────────────────────────

    /**
     * Create Task — Project Manager, Super Admin only.
     * Developers and Testers can update task status via PUT but cannot create tasks.
     */
    @PostMapping
    @Operation(summary = "Create Task")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<TaskDto>> createTask(
            @Valid @RequestBody CreateTaskRequest request) {
        return ResponseEntity.ok(taskService.createTask(request));
    }

    /**
     * Update Task — Project Manager, Super Admin, Developer, Tester.
     * Developer/Tester use this to update task status; frontend limits which fields they send.
     */
    @PutMapping("/{id}")
    @Operation(summary = "Update Task")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER','ROLE_DEVELOPER','ROLE_QA')")
    public ResponseEntity<ApiResponse<TaskDto>> updateTask(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTaskRequest request) {
        return ResponseEntity.ok(taskService.updateTask(id, request));
    }

    /**
     * Delete Task — Project Manager, Super Admin only.
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete Task")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<Void>> deleteTask(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.deleteTask(id));
    }

    // ── Read operations: all authenticated users ──────────────────────────────

    @GetMapping
    @Operation(summary = "Get All Tasks")
    public ResponseEntity<ApiResponse<List<TaskDto>>> getAllTasks() {
        return ResponseEntity.ok(taskService.getAllTasks());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get Task By Id")
    public ResponseEntity<ApiResponse<TaskDto>> getTaskById(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.getTaskById(id));
    }

    @GetMapping("/project/{projectId}")
    @Operation(summary = "Get Tasks By Project")
    public ResponseEntity<ApiResponse<List<TaskDto>>> getTasksByProject(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(taskService.getTasksByProject(projectId));
    }

    @GetMapping("/sprint/{sprintId}")
    @Operation(summary = "Get Tasks By Sprint")
    public ResponseEntity<ApiResponse<List<TaskDto>>> getTasksBySprint(
            @PathVariable Long sprintId) {
        return ResponseEntity.ok(taskService.getTasksBySprint(sprintId));
    }

    @GetMapping("/board/{projectId}")
    @Operation(summary = "Task Board (grouped by status)")
    public ResponseEntity<ApiResponse<TaskBoardDto>> getTaskBoard(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(taskService.getTaskBoard(projectId));
    }

    // ── Module 5: Task Status Update with History Tracking ─────────────────────

    @PutMapping("/{id}/status")
    @Operation(summary = "Update Task Status")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ORG_ADMIN','ROLE_PROJECT_MANAGER','ROLE_DEVELOPER','ROLE_QA')")
    public ResponseEntity<ApiResponse<TaskDto>> updateTaskStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTaskStatusRequest request) {
        return ResponseEntity.ok(taskService.updateTaskStatus(id, request));
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Get Task Status History")
    public ResponseEntity<ApiResponse<List<TaskStatusHistoryResponse>>> getTaskStatusHistory(
            @PathVariable Long id) {
        return ResponseEntity.ok(taskService.getTaskStatusHistory(id));
    }
}
