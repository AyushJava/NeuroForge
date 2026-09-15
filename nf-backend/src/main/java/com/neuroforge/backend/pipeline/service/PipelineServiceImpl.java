package com.neuroforge.backend.pipeline.service;

import com.neuroforge.backend.ai.dto.ReleaseNotesRequest;
import com.neuroforge.backend.ai.dto.ReleaseNotesResponse;
import com.neuroforge.backend.ai.service.GroqService;
import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.pipeline.dto.*;
import com.neuroforge.backend.pipeline.entity.Pipeline;
import com.neuroforge.backend.pipeline.entity.PipelineRun;
import com.neuroforge.backend.pipeline.entity.Release;
import com.neuroforge.backend.pipeline.entity.ReleaseTask;
import com.neuroforge.backend.pipeline.repository.PipelineRepository;
import com.neuroforge.backend.pipeline.repository.PipelineRunRepository;
import com.neuroforge.backend.pipeline.repository.ReleaseRepository;
import com.neuroforge.backend.pipeline.repository.ReleaseTaskRepository;
import lombok.RequiredArgsConstructor;

import com.neuroforge.backend.organization.entity.Organization;
import com.neuroforge.backend.organization.repository.OrganizationRepository;
import com.neuroforge.backend.project.entity.Task;
import com.neuroforge.backend.project.repository.TaskRepository;

import com.neuroforge.backend.pipeline.repository.PipelineStageRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PipelineServiceImpl implements PipelineService {
    private final PipelineRepository pipelineRepository;
    private final PipelineRunRepository pipelineRunRepository;
    private final PipelineStageRepository pipelineStageRepository;
    private final PipelineSimulator pipelineSimulator;
    private final ReleaseRepository releaseRepository;
    private final ReleaseTaskRepository releaseTaskRepository;
    private final TaskRepository taskRepository;
    private final GroqService groqService;
    private final OrganizationRepository organizationRepository;

    @Override
    @Transactional
    public ApiResponse<PipelineRunResponse> runPipeline(RunPipelineRequest request) {
        if (!hasRole("ROLE_PROJECT_MANAGER")) {
            throw AppException.forbidden("Only Project Managers can trigger pipeline runs");
        }

        Pipeline pipeline = pipelineRepository.findById(request.getPipelineId())
                .orElseThrow(() -> AppException.notFound("Pipeline not found"));

        // Use the orgId from request if provided, otherwise use pipeline's organization
        Long orgId = request.getOrgId();
        com.neuroforge.backend.organization.entity.Organization org = null;
        if (orgId != null) {
            org = organizationRepository.findById(orgId).orElse(null);
        } else {
            org = pipeline.getOrganization();
        }

        PipelineRun run = PipelineRun.builder()
                .pipeline(pipeline)
                .organization(org)
                .status("RUNNING")
                .triggeredBy(getCurrentUserEmail())
                .startedAt(LocalDateTime.now())
                .build();

        run = pipelineRunRepository.saveAndFlush(run);

        PipelineRunResponse response = PipelineRunResponse.builder()
                .runId(run.getId())
                .pipelineName(pipeline.getName())
                .status(run.getStatus())
                .startedAt(run.getStartedAt())
                .completedAt(run.getCompletedAt())
                .build();

        // Call simulator after transaction commits
        Long runId = run.getId();
        TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
            @Override
            public void afterCommit() {
                pipelineSimulator.simulate(runId);
            }
        });

        return ApiResponse.ok(
                "Pipeline started successfully",
                response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<PipelineStageResponse>> getPipelineStages(Long runId) {
        PipelineRun run = pipelineRunRepository.findById(runId)
                .orElseThrow(() -> AppException.notFound("Pipeline run not found"));

        List<PipelineStageResponse> stages = pipelineStageRepository.findByPipelineRun(run)
                .stream()
                .map(stage -> PipelineStageResponse.builder()
                        .stageName(stage.getStageName())
                        .status(stage.getStatus())
                        .startedAt(stage.getStartedAt())
                        .completedAt(stage.getCompletedAt())
                        .build())
                .toList();

        return ApiResponse.ok(
                "Pipeline stages fetched successfully",
                stages);
    }

    @Override
    @Transactional
    public ApiResponse<ReleaseResponse> createRelease(CreateReleaseRequest request) {
        Release.ReleaseBuilder releaseBuilder = Release.builder()
                .version(request.getVersion())
                .status("DRAFT")
                .createdAt(LocalDateTime.now());

        if (request.getOrganizationId() != null) {
            Organization organization = organizationRepository.findById(request.getOrganizationId())
                    .orElseThrow(() -> AppException.notFound("Organization not found"));
            releaseBuilder.organization(organization);
        }

        Release release = releaseBuilder.build();
        release = releaseRepository.save(release);
        if (request.getTaskIds() != null) {
            for (Long taskId : request.getTaskIds()) {
                ReleaseTask releaseTask = ReleaseTask.builder()
                        .release(release)
                        .taskId(taskId)
                        .build();

                releaseTaskRepository.save(releaseTask);
            }
        }

        ReleaseResponse response = ReleaseResponse.builder()
                .id(release.getId())
                .version(release.getVersion())
                .status(release.getStatus())
                .createdAt(release.getCreatedAt())
                .releasedAt(release.getReleasedAt())
                .build();

        return ApiResponse.ok(
                "Release created successfully",
                response);
    }

    @Override
    @Transactional
    public ApiResponse<ReleaseNoteResponse> generateReleaseNotes(Long releaseId) {
        Release release = releaseRepository.findById(releaseId)
                .orElseThrow(() -> AppException.notFound("Release not found"));

        List<ReleaseTask> releaseTasks = releaseTaskRepository.findByReleaseId(releaseId);

        List<String> doneTaskTitles = releaseTasks.stream()
                .map(releaseTask -> {
                    Task task = taskRepository.findById(releaseTask.getTaskId()).orElse(null);
                    if (task != null && "DONE".equals(task.getStatus())) {
                        return task.getTitle();
                    }
                    return null;
                })
                .filter(title -> title != null)
                .collect(Collectors.toList());

        ReleaseNotesResponse llmResponse;
        if (doneTaskTitles.isEmpty()) {
            llmResponse = ReleaseNotesResponse.builder()
                    .releaseNotes("No completed tasks found for this release.")
                    .build();
        } else {
            ReleaseNotesRequest llmRequest = ReleaseNotesRequest.builder()
                    .tasks(doneTaskTitles)
                    .build();
            llmResponse = groqService.generateReleaseNotes(llmRequest);
        }

        release.setReleaseNotes(llmResponse.getReleaseNotes());
        releaseRepository.save(release);

        ReleaseNoteResponse response = ReleaseNoteResponse.builder()
                .version(release.getVersion())
                .releaseNotes(release.getReleaseNotes())
                .build();

        return ApiResponse.ok(
                "Release notes generated successfully",
                response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<PipelineHistoryResponse>> getPipelineHistory(Long orgId) {
        List<PipelineHistoryResponse> history;

        if (orgId != null) {
            history = pipelineRunRepository
                    .findAll()
                    .stream()
                    .filter(run -> run.getOrganization() == null ||
                                   run.getOrganization().getId().equals(orgId))
                    .map(run -> PipelineHistoryResponse.builder()
                            .runId(run.getId())
                            .pipelineName(run.getPipeline().getName())
                            .status(run.getStatus())
                            .startedAt(run.getStartedAt())
                            .completedAt(run.getCompletedAt())
                            .build())
                    .sorted((a, b) -> b.getStartedAt().compareTo(a.getStartedAt()))
                    .toList();
        } else {
            history = pipelineRunRepository
                    .findAll()
                    .stream()
                    .map(run -> PipelineHistoryResponse.builder()
                            .runId(run.getId())
                            .pipelineName(run.getPipeline().getName())
                            .status(run.getStatus())
                            .startedAt(run.getStartedAt())
                            .completedAt(run.getCompletedAt())
                            .build())
                    .sorted((a, b) -> b.getStartedAt().compareTo(a.getStartedAt()))
                    .toList();
        }

        return ApiResponse.ok(
                "Pipeline history fetched successfully",
                history);
    }

    @Override
    @Transactional
    public ApiResponse<ReleaseNoteResponse> updateReleaseNotes(
                    Long releaseId,
                    UpdateReleaseNotesRequest request) {

        Release release = releaseRepository.findById(releaseId)
                .orElseThrow(() -> AppException.notFound("Release not found"));

        release.setReleaseNotes(request.getReleaseNotes());

        releaseRepository.save(release);

        ReleaseNoteResponse response = ReleaseNoteResponse.builder()
                .version(release.getVersion())
                .releaseNotes(release.getReleaseNotes())
                .build();

        return ApiResponse.ok(
                "Release notes updated successfully",
                response);
    }

    @Override
    @Transactional
    public ApiResponse<PipelineRunResponse> retryPipeline(Long runId) {
        PipelineRun oldRun = pipelineRunRepository.findById(runId)
                .orElseThrow(() -> AppException.notFound("Pipeline run not found"));

        if (!"FAILED".equals(oldRun.getStatus())) {
                throw AppException.badRequest("Only failed pipelines can be retried");
        }

        PipelineRun newRun = PipelineRun.builder()
                .pipeline(oldRun.getPipeline())
                .status("RUNNING")
                .triggeredBy(getCurrentUserEmail())
                .startedAt(LocalDateTime.now())
                .build();

        newRun = pipelineRunRepository.saveAndFlush(newRun);

        pipelineSimulator.simulate(newRun.getId());

        PipelineRunResponse response = PipelineRunResponse.builder()
                .runId(newRun.getId())
                .pipelineName(newRun.getPipeline().getName())
                .status(newRun.getStatus())
                .startedAt(newRun.getStartedAt())
                .completedAt(newRun.getCompletedAt())
                .build();

        return ApiResponse.ok("Pipeline restarted successfully", response);
    }

    @Override
    @Transactional
    public ApiResponse<String> approveProduction(Long runId) {
        if (!hasRole("ROLE_PROJECT_MANAGER")) {
                throw AppException.forbidden("Only Project Managers can approve production deployment");
        }

        PipelineRun run = pipelineRunRepository.findById(runId)
                .orElseThrow(() -> AppException.notFound("Pipeline run not found"));

        if (!"WAITING_FOR_APPROVAL".equals(run.getStatus())) {
                throw AppException.badRequest("Pipeline is not waiting for approval");
        }

        run.setStatus("APPROVED");
        pipelineRunRepository.save(run);

        pipelineSimulator.deployProduction(runId);

        return ApiResponse.ok(
                "Production deployment approved",
                "Deployment started");
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PipelineMetricsResponse> getPipelineMetrics(Long orgId) {
        List<PipelineRun> runs = pipelineRunRepository.findAll();

        if (orgId != null) {
            runs = runs.stream()
                    .filter(run -> run.getOrganization() == null ||
                                   run.getOrganization().getId().equals(orgId))
                    .toList();
        }

        long total = runs.size();
        long success = runs.stream().filter(run -> "SUCCESS".equals(run.getStatus())).count();
        long failed = runs.stream().filter(run -> "FAILED".equals(run.getStatus())).count();
        long waiting = runs.stream().filter(run -> "WAITING_FOR_APPROVAL".equals(run.getStatus())).count();

        double successRate = total == 0 ? 0 : (success * 100.0) / total;

        double averageDuration = 0;
        long fastest = 0;
        long slowest = 0;

        if (!runs.isEmpty()) {
                List<Long> durations = runs.stream()
                                .filter(run -> run.getStartedAt() != null && run.getCompletedAt() != null)
                                .map(run -> java.time.Duration
                                                .between(run.getStartedAt(), run.getCompletedAt())
                                                .getSeconds())
                                .toList();

                if (!durations.isEmpty()) {
                        averageDuration = durations.stream()
                                        .mapToLong(Long::longValue)
                                        .average()
                                        .orElse(0);

                        fastest = durations.stream()
                                        .mapToLong(Long::longValue)
                                        .min()
                                        .orElse(0);

                        slowest = durations.stream()
                                        .mapToLong(Long::longValue)
                                        .max()
                                        .orElse(0);
                }
        }

        PipelineMetricsResponse response = PipelineMetricsResponse.builder()
                .totalRuns(total)
                .successfulRuns(success)
                .failedRuns(failed)
                .waitingApprovalRuns(waiting)
                .successRate(successRate)
                .averageDurationSeconds(averageDuration)
                .fastestRunSeconds(fastest)
                .slowestRunSeconds(slowest)
                .build();

        return ApiResponse.ok(
                "Pipeline metrics fetched successfully",
                response);
    }

    @Override
    @Transactional
    public ApiResponse<String> cancelPipeline(Long runId) {
        PipelineRun run = pipelineRunRepository.findById(runId)
                .orElseThrow(() -> AppException.notFound("Pipeline run not found"));

        if (!"RUNNING".equals(run.getStatus())
                        && !"WAITING_FOR_APPROVAL".equals(run.getStatus())) {

                throw AppException.badRequest("Pipeline cannot be cancelled");
        }

        run.setStatus("CANCELLED");
        run.setCompletedAt(LocalDateTime.now());

        pipelineRunRepository.save(run);

        return ApiResponse.ok(
                "Pipeline cancelled successfully",
                "Run ID: " + runId);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<ReleaseHistoryResponse>> getReleaseHistory(Long orgId) {
        List<Release> releases;
        
        if (orgId != null) {
            releases = releaseRepository.findByOrganizationId(orgId);
        } else {
            releases = releaseRepository.findAll();
        }
        
        List<ReleaseHistoryResponse> response = releases
                        .stream()
                        .map(release -> ReleaseHistoryResponse.builder()
                                        .id(release.getId())
                                        .version(release.getVersion())
                                        .status(release.getStatus())
                                        .createdAt(release.getCreatedAt())
                                        .releasedAt(release.getReleasedAt())
                                        .releaseNotes(release.getReleaseNotes())
                                        .build())
                        .toList();

        return ApiResponse.ok(
                "Release history fetched successfully",
                response);
    }

    @Override
    @Transactional
    public ApiResponse<ReleaseResponse> publishRelease(Long releaseId) {
        Release release = releaseRepository.findById(releaseId)
                .orElseThrow(() -> AppException.notFound("Release not found"));

        if ("RELEASED".equals(release.getStatus())) {
                throw AppException.badRequest("Release is already published");
        }

        release.setStatus("RELEASED");
        release.setReleasedAt(LocalDateTime.now());

        release = releaseRepository.save(release);

        ReleaseResponse response = ReleaseResponse.builder()
                .id(release.getId())
                .version(release.getVersion())
                .status(release.getStatus())
                .createdAt(release.getCreatedAt())
                .releasedAt(release.getReleasedAt())
                .build();

        return ApiResponse.ok(
                "Release published successfully",
                response);
    }

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
                return authentication.getName();
        }
        return "system";
    }

    private boolean hasRole(String role) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
                return authentication.getAuthorities().stream()
                                .anyMatch(authority -> authority.getAuthority().equals(role));
        }
        return false;
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<Pipeline> getActivePipeline(Long orgId) {
        if (orgId != null) {
            Optional<Pipeline> pipeline = pipelineRepository.findByOrganizationIdAndActiveTrue(orgId);
            if (pipeline.isPresent()) {
                return ApiResponse.ok("Active pipeline fetched successfully", pipeline.get());
            }
            // Fallback to global pipelines (pipelines without organization)
            Pipeline globalPipeline = pipelineRepository.findAll().stream()
                    .filter(p -> p.getOrganization() == null && p.getActive())
                    .findFirst()
                    .orElseThrow(() -> AppException.notFound("No active pipeline found for this organization"));
            return ApiResponse.ok("Active pipeline fetched successfully", globalPipeline);
        }
        // If no orgId, return first active pipeline
        Pipeline pipeline = pipelineRepository.findAll().stream()
                .filter(Pipeline::getActive)
                .findFirst()
                .orElseThrow(() -> AppException.notFound("No active pipeline found"));
        return ApiResponse.ok("Active pipeline fetched successfully", pipeline);
    }
}
