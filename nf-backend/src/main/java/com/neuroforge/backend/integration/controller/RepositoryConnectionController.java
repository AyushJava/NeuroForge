package com.neuroforge.backend.integration.controller;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.integration.dto.RepositorySyncResponse;
import com.neuroforge.backend.integration.dto.ConnectRepositoryRequest;
import com.neuroforge.backend.integration.dto.RepositoryConnectionResponse;
import com.neuroforge.backend.integration.service.RepositoryConnectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import com.neuroforge.backend.integration.dto.TaskCommitResponse;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/repositories")
@RequiredArgsConstructor
public class RepositoryConnectionController {

    private final RepositoryConnectionService repositoryConnectionService;

    @PostMapping("/connect")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ApiResponse<RepositoryConnectionResponse> connectRepository(
            @Valid @RequestBody ConnectRepositoryRequest request) {

        return repositoryConnectionService.connectRepository(request);
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ApiResponse<List<RepositoryConnectionResponse>> getAllRepositories() {
        return repositoryConnectionService.getAllRepositories();
    }

    @GetMapping("/project/{projectId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ApiResponse<List<RepositoryConnectionResponse>> getRepositoriesByProject(
            @PathVariable Long projectId) {
        return repositoryConnectionService.getRepositoriesByProject(projectId);
    }

    @PostMapping("/{repositoryId}/sync")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<RepositorySyncResponse>> syncRepository(
            @PathVariable Long repositoryId) {

        return ResponseEntity.ok(
                repositoryConnectionService.syncRepository(repositoryId));
    }

    @GetMapping("/tasks/{taskKey}/commits")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<TaskCommitResponse>> getTaskCommits(
            @PathVariable String taskKey) {

        return repositoryConnectionService.getTaskCommits(taskKey);
    }

    @GetMapping("/tasks/{taskId}/commits-by-id")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<TaskCommitResponse>> getTaskCommitsByTaskId(
            @PathVariable Long taskId) {

        return repositoryConnectionService.getTaskCommitsByTaskId(taskId);
    }

    @DeleteMapping("/{repositoryId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ApiResponse<Void> deleteRepository(
            @PathVariable Long repositoryId) {

        return repositoryConnectionService.deleteRepository(repositoryId);
    }
}
