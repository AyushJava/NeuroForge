package com.neuroforge.backend.integration.service;

import java.util.List;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.integration.dto.ConnectRepositoryRequest;
import com.neuroforge.backend.integration.dto.RepositoryConnectionResponse;
import com.neuroforge.backend.integration.dto.TaskCommitResponse;
import com.neuroforge.backend.integration.dto.RepositorySyncResponse;

public interface RepositoryConnectionService {

    ApiResponse<RepositoryConnectionResponse> connectRepository(
            ConnectRepositoryRequest request);

    ApiResponse<List<RepositoryConnectionResponse>> getAllRepositories();

    ApiResponse<List<RepositoryConnectionResponse>> getRepositoriesByProject(Long projectId);

    ApiResponse<RepositorySyncResponse> syncRepository(Long repositoryId);

    ApiResponse<List<TaskCommitResponse>> getTaskCommits(String taskKey);

    ApiResponse<List<TaskCommitResponse>> getTaskCommitsByTaskId(Long taskId);

    ApiResponse<Void> deleteRepository(Long repositoryId);

}
