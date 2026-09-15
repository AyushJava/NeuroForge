package com.neuroforge.backend.integration.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.integration.repository.TaskCommitLinkRepository;
import com.neuroforge.backend.integration.entity.TaskCommitLink;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.integration.dto.ConnectRepositoryRequest;
import com.neuroforge.backend.integration.dto.RepositoryConnectionResponse;
import com.neuroforge.backend.integration.entity.RepositoryConnection;
import com.neuroforge.backend.integration.repository.RepositoryConnectionRepository;
import lombok.RequiredArgsConstructor;
import com.neuroforge.backend.integration.entity.CommitCache;

import com.neuroforge.backend.integration.repository.CommitCacheRepository;
import com.neuroforge.backend.integration.entity.Branch;
import com.neuroforge.backend.integration.repository.BranchRepository;
import com.neuroforge.backend.integration.entity.PullRequest;
import com.neuroforge.backend.integration.repository.PullRequestRepository;
import com.neuroforge.backend.integration.service.TokenEncryptionService;
import com.neuroforge.backend.project.repository.TaskRepository;

import com.neuroforge.backend.integration.dto.RepositorySyncResponse;

import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.Map;
import java.time.OffsetDateTime;
import com.neuroforge.backend.integration.dto.TaskCommitResponse;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class RepositoryConnectionServiceImpl implements RepositoryConnectionService {

    private final RepositoryConnectionRepository repositoryConnectionRepository;
    private final RestTemplate restTemplate;
    private final CommitCacheRepository commitCacheRepository;
    private final TaskCommitLinkRepository taskCommitLinkRepository;
    private final BranchRepository branchRepository;
    private final PullRequestRepository pullRequestRepository;
    private final TokenEncryptionService tokenEncryptionService;
    private final TaskRepository taskRepository;

    @Override
    public ApiResponse<RepositoryConnectionResponse> connectRepository(
            ConnectRepositoryRequest request) {

        if (repositoryConnectionRepository.existsByRepositoryUrl(request.getRepositoryUrl())) {
            throw AppException.badRequest("Repository is already connected");
        }

        RepositoryConnection repository = RepositoryConnection.builder()
                .repositoryName(request.getRepositoryName())
                .owner(request.getOwner())
                .repositoryUrl(request.getRepositoryUrl())
                .accessToken(tokenEncryptionService.encrypt(request.getGithubToken()))
                .defaultBranch("main")
                .connected(true)
                .project(com.neuroforge.backend.project.entity.Project.builder().id(request.getProjectId()).build())
                .build();

        repository = repositoryConnectionRepository.save(repository);

        RepositoryConnectionResponse response = RepositoryConnectionResponse.builder()
                .id(repository.getId())
                .repositoryUrl(repository.getRepositoryUrl())
                .branchName(repository.getDefaultBranch())
                .lastSyncedAt(repository.getLastSyncTime())
                .active(repository.getConnected())
                .build();

        return ApiResponse.ok(
                "Repository connected successfully",
                response);
    }

    @Override
    public ApiResponse<RepositorySyncResponse> syncRepository(Long repositoryId) {
        try {
            RepositoryConnection repository = repositoryConnectionRepository
                    .findById(repositoryId)
                    .orElseThrow(() -> AppException.notFound("Repository not found"));

            String repoUrl = repository.getRepositoryUrl();

            String path = repoUrl
                    .replace("https://github.com/", "")
                    .replace(".git", "");

            // Sync commits
            String apiUrl = "https://api.github.com/repos/" + path + "/commits";

            String decryptedToken;
            try {
                decryptedToken = tokenEncryptionService.decrypt(repository.getAccessToken());
            } catch (Exception e) {
                throw new RuntimeException("Failed to decrypt GitHub token. The token may have been encrypted with a different encryption key. Please delete and reconnect the repository.", e);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(decryptedToken);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));

            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<List> githubResponse = restTemplate.exchange(
                    apiUrl,
                    HttpMethod.GET,
                    entity,
                    List.class);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> commits = (List<Map<String, Object>>) githubResponse.getBody();
            repository.setLastSyncTime(LocalDateTime.now());
            repositoryConnectionRepository.save(repository);

            RepositorySyncResponse response = RepositorySyncResponse.builder()
                    .id(repository.getId())
                    .repositoryUrl(repository.getRepositoryUrl())
                    .lastSyncedAt(repository.getLastSyncTime())
                    .message("Repository synced successfully")
                    .build();

        if (commits != null) {

            for (Map<String, Object> commit : commits) {

                String sha = (String) commit.get("sha");

                if (commitCacheRepository.existsByCommitSha(sha)) {
                    continue;
                }

                Map<String, Object> commitInfo = (Map<String, Object>) commit.get("commit");

                Map<String, Object> author = (Map<String, Object>) commitInfo.get("author");

                CommitCache commitCache = CommitCache.builder()
                        .commitSha(sha)
                        .authorName((String) author.get("name"))
                        .commitMessage((String) commitInfo.get("message"))
                        .commitUrl((String) commit.get("html_url"))
                        .branchName(repository.getDefaultBranch())
                        .committedAt(
                                OffsetDateTime.parse((String) author.get("date"))
                                        .toLocalDateTime())
                        .repositoryConnection(repository)
                        .build();

                commitCache = commitCacheRepository.save(commitCache);

                String message = commitCache.getCommitMessage();

                Pattern pattern = Pattern.compile("NF-\\d+-\\d+|NF-\\d+");
                Matcher matcher = pattern.matcher(message);

                while (matcher.find()) {
                    String taskKey = matcher.group();
                    
                    // Resolve taskKey to actual Task entity
                    com.neuroforge.backend.project.entity.Task task = taskRepository.findByTaskKey(taskKey).orElse(null);
                    
                    if (task != null) {
                        // Check if link already exists
                        if (taskCommitLinkRepository.findByCommitIdAndTaskId(commitCache.getId(), task.getId()).isEmpty()) {
                            TaskCommitLink link = TaskCommitLink.builder()
                                    .taskKey(taskKey)
                                    .task(task)
                                    .commit(commitCache)
                                    .build();
                            taskCommitLinkRepository.save(link);
                        }
                    }
                }
            }
        }

        // Sync branches
        String branchesApiUrl = "https://api.github.com/repos/" + path + "/branches";
        ResponseEntity<List> branchesResponse = restTemplate.exchange(
                branchesApiUrl,
                HttpMethod.GET,
                entity,
                List.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> branches = (List<Map<String, Object>>) branchesResponse.getBody();

        if (branches != null) {
            for (Map<String, Object> branchData : branches) {
                String branchName = (String) branchData.get("name");
                Map<String, Object> commitData = (Map<String, Object>) branchData.get("commit");
                String commitSha = (String) commitData.get("sha");

                var existingBranch = branchRepository.findByBranchNameAndRepositoryConnectionId(branchName, repositoryId);
                if (existingBranch.isPresent()) {
                    Branch branch = existingBranch.get();
                    if (!commitSha.equals(branch.getCommitSha())) {
                        branch.setCommitSha(commitSha);
                        branchRepository.save(branch);
                    }
                } else {
                    Branch branch = Branch.builder()
                            .branchName(branchName)
                            .commitSha(commitSha)
                            .repositoryConnection(repository)
                            .build();
                    branchRepository.save(branch);
                }
            }
        }

        // Sync pull requests
        String prsApiUrl = "https://api.github.com/repos/" + path + "/pulls";
        ResponseEntity<List> prsResponse = restTemplate.exchange(
                prsApiUrl,
                HttpMethod.GET,
                entity,
                List.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pullRequests = (List<Map<String, Object>>) prsResponse.getBody();

        if (pullRequests != null) {
            for (Map<String, Object> prData : pullRequests) {
                Integer prNumber = (Integer) prData.get("number");
                String title = (String) prData.get("title");
                String state = (String) prData.get("state");
                String prUrl = (String) prData.get("html_url");
                
                Map<String, Object> user = (Map<String, Object>) prData.get("user");
                String author = user != null ? (String) user.get("login") : "Unknown";
                
                Map<String, Object> head = (Map<String, Object>) prData.get("head");
                String headBranch = head != null ? (String) head.get("ref") : "unknown";
                
                Map<String, Object> base = (Map<String, Object>) prData.get("base");
                String baseBranch = base != null ? (String) base.get("ref") : "unknown";

                var existingPr = pullRequestRepository.findByPrNumberAndRepositoryConnectionId(prNumber, repositoryId);
                if (existingPr.isPresent()) {
                    PullRequest pullRequest = existingPr.get();
                    pullRequest.setTitle(title);
                    pullRequest.setState(state);
                    pullRequest.setAuthor(author);
                    pullRequest.setHeadBranch(headBranch);
                    pullRequest.setBaseBranch(baseBranch);
                    pullRequest.setPrUrl(prUrl);
                    pullRequestRepository.save(pullRequest);
                } else {
                    PullRequest pullRequest = PullRequest.builder()
                            .prNumber(prNumber)
                            .title(title)
                            .state(state)
                            .author(author)
                            .headBranch(headBranch)
                            .baseBranch(baseBranch)
                            .prUrl(prUrl)
                            .repositoryConnection(repository)
                            .build();
                    pullRequestRepository.save(pullRequest);
                }
            }
        }

        return ApiResponse.ok(
                "Repository synced successfully",
                response);
        } catch (Exception e) {
            throw new RuntimeException("Sync failed: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<RepositoryConnectionResponse>> getAllRepositories() {

        List<RepositoryConnectionResponse> repositories = repositoryConnectionRepository.findAll()
                .stream()
                .map(repository -> RepositoryConnectionResponse.builder()
                        .id(repository.getId())
                        .repositoryUrl(repository.getRepositoryUrl())
                        .branchName(repository.getDefaultBranch())
                        .lastSyncedAt(repository.getLastSyncTime())
                        .active(repository.getConnected())
                        .build())
                .toList();

        return ApiResponse.ok(
                "Repositories fetched successfully",
                repositories);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<RepositoryConnectionResponse>> getRepositoriesByProject(Long projectId) {

        List<RepositoryConnectionResponse> repositories = repositoryConnectionRepository.findByProjectId(projectId)
                .stream()
                .map(repository -> RepositoryConnectionResponse.builder()
                        .id(repository.getId())
                        .repositoryUrl(repository.getRepositoryUrl())
                        .branchName(repository.getDefaultBranch())
                        .lastSyncedAt(repository.getLastSyncTime())
                        .active(repository.getConnected())
                        .build())
                .toList();

        return ApiResponse.ok(
                "Project repositories fetched successfully",
                repositories);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<TaskCommitResponse>> getTaskCommits(String taskKey) {

        List<TaskCommitResponse> commits = taskCommitLinkRepository.findByTaskKey(taskKey)
                .stream()
                .map(link -> {
                    CommitCache commit = link.getCommit();

                    return TaskCommitResponse.builder()
                            .commitSha(commit.getCommitSha())
                            .commitMessage(commit.getCommitMessage())
                            .authorName(commit.getAuthorName())
                            .commitUrl(commit.getCommitUrl())
                            .branchName(commit.getBranchName())
                            .committedAt(commit.getCommittedAt())
                            .build();
                })
                .toList();

        return ApiResponse.ok(
                "Task commits fetched successfully",
                commits);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<TaskCommitResponse>> getTaskCommitsByTaskId(Long taskId) {

        List<TaskCommitResponse> commits = taskCommitLinkRepository.findByTaskId(taskId)
                .stream()
                .map(link -> {
                    CommitCache commit = link.getCommit();

                    return TaskCommitResponse.builder()
                            .commitSha(commit.getCommitSha())
                            .commitMessage(commit.getCommitMessage())
                            .authorName(commit.getAuthorName())
                            .commitUrl(commit.getCommitUrl())
                            .branchName(commit.getBranchName())
                            .committedAt(commit.getCommittedAt())
                            .build();
                })
                .toList();

        return ApiResponse.ok(
                "Task commits fetched successfully",
                commits);
    }

    @Override
    @Transactional
    public ApiResponse<Void> deleteRepository(Long repositoryId) {
        RepositoryConnection repository = repositoryConnectionRepository
                .findById(repositoryId)
                .orElseThrow(() -> AppException.notFound("Repository not found"));

        // Delete associated data in correct order to respect foreign key constraints
        taskCommitLinkRepository.deleteByRepositoryConnectionId(repositoryId);
        commitCacheRepository.deleteByRepositoryConnectionId(repositoryId);
        branchRepository.deleteByRepositoryConnectionId(repositoryId);
        pullRequestRepository.deleteByRepositoryConnectionId(repositoryId);

        // Delete the repository connection
        repositoryConnectionRepository.delete(repository);

        return ApiResponse.ok("Repository deleted successfully", null);
    }
}
