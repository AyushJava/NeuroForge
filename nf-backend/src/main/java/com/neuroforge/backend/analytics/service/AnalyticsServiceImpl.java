package com.neuroforge.backend.analytics.service;

import com.neuroforge.backend.analytics.dto.AnalyticsDashboardResponse;
import com.neuroforge.backend.security.SecurityUtils;
import com.neuroforge.backend.analytics.dto.BurndownPointResponse;
import com.neuroforge.backend.analytics.dto.BurndownResponse;
import com.neuroforge.backend.analytics.dto.ChangeFailureRateResponse;
import com.neuroforge.backend.analytics.dto.CycleTimePointResponse;
import com.neuroforge.backend.analytics.dto.CycleTimeResponse;
import com.neuroforge.backend.analytics.dto.DeveloperAnalyticsResponse;
import com.neuroforge.backend.analytics.dto.DeploymentFrequencyResponse;
import com.neuroforge.backend.analytics.dto.IssueTrendPointResponse;
import com.neuroforge.backend.analytics.dto.IssueTrendResponse;
import com.neuroforge.backend.analytics.dto.SprintAnalyticsResponse;
import com.neuroforge.backend.analytics.dto.TaskDistributionResponse;
import com.neuroforge.backend.analytics.dto.VelocityPointResponse;
import com.neuroforge.backend.analytics.dto.VelocityResponse;
import com.neuroforge.backend.analytics.entity.DeploymentRecord;
import com.neuroforge.backend.analytics.enums.DeploymentEnvironment;
import com.neuroforge.backend.analytics.enums.DeploymentStatus;
import lombok.extern.slf4j.Slf4j;
import com.neuroforge.backend.analytics.repository.DeploymentRecordRepository;
import com.neuroforge.backend.project.entity.Sprint;
import com.neuroforge.backend.project.entity.Task;
import com.neuroforge.backend.project.entity.TaskStatusHistory;
import com.neuroforge.backend.ai.enums.IssueSeverity;
import com.neuroforge.backend.specification.exception.ResourceNotFoundException;
import com.neuroforge.backend.mongodb.document.ReviewDocument;
import com.neuroforge.backend.mongodb.document.ReviewIssue;
import com.neuroforge.backend.mongodb.repository.ReviewDocumentRepository;
import com.neuroforge.backend.project.repository.SprintRepository;
import com.neuroforge.backend.project.repository.TaskRepository;
import com.neuroforge.backend.project.repository.TaskStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

import com.lowagie.text.Cell;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Table;
import com.lowagie.text.pdf.PdfWriter;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsServiceImpl implements AnalyticsService {

    private final TaskRepository taskRepository;
    private final SprintRepository sprintRepository;
    private final TaskStatusHistoryRepository taskStatusHistoryRepository;
    private final ReviewDocumentRepository reviewDocumentRepository;
    private final DeploymentRecordRepository deploymentRecordRepository;

    @Override
    public AnalyticsDashboardResponse getDashboard(Long orgId) {
        // Use provided orgId if available, otherwise fall back to SecurityUtils
        Long currentOrgId = orgId != null ? orgId : SecurityUtils.getCurrentUserOrganizationId().orElse(null);
        boolean isSuperAdmin = SecurityUtils.isSuperAdmin();

        long totalTasks;
        long completedTasks;
        long inProgressTasks;
        long codeReviewTasks;
        long testingTasks;
        long todoTasks;
        Integer totalStoryPoints;
        Integer completedStoryPoints;

        if (isSuperAdmin || currentOrgId == null) {
            // Super admin sees all data
            totalTasks = taskRepository.count();
            completedTasks = taskRepository.countByStatus("DONE");
            inProgressTasks = taskRepository.countByStatus("IN_PROGRESS");
            codeReviewTasks = taskRepository.countByStatus("CODE_REVIEW");
            testingTasks = taskRepository.countByStatus("TESTING");
            todoTasks = taskRepository.countByStatus("TODO");
            totalStoryPoints = taskRepository.getTotalStoryPoints();
            completedStoryPoints = taskRepository.getStoryPointsByStatus("DONE");
        } else {
            // Other roles only see their organization's data
            totalTasks = taskRepository.countByOrganizationId(currentOrgId);
            completedTasks = taskRepository.countByOrganizationIdAndStatus(currentOrgId, "DONE");
            inProgressTasks = taskRepository.countByOrganizationIdAndStatus(currentOrgId, "IN_PROGRESS");
            codeReviewTasks = taskRepository.countByOrganizationIdAndStatus(currentOrgId, "CODE_REVIEW");
            testingTasks = taskRepository.countByOrganizationIdAndStatus(currentOrgId, "TESTING");
            todoTasks = taskRepository.countByOrganizationIdAndStatus(currentOrgId, "TODO");
            totalStoryPoints = taskRepository.getTotalStoryPointsByOrganization(currentOrgId);
            completedStoryPoints = taskRepository.getStoryPointsByOrganizationAndStatus(currentOrgId, "DONE");
        }

        double completionPercentage = 0.0;
        if (totalTasks > 0) {
            double rawPercentage = (completedTasks * 100.0) / totalTasks;
            completionPercentage = Math.round(rawPercentage * 100.0) / 100.0;
        }

        // Calculate average cycle time for the dashboard
        double averageCycleTimeHours = 0.0;
        List<Task> doneTasks = currentOrgId != null ? taskRepository.findByOrganizationIdAndStatus(currentOrgId, "DONE") : taskRepository.findByStatus("DONE");
        long measuredCycleTimeTasks = 0;
        double totalCycleTimeMinutes = 0.0;

        for (Task task : doneTasks) {
            if (task.getId() == null) {
                continue;
            }

            List<TaskStatusHistory> historyList = taskStatusHistoryRepository.findByTaskIdOrderByChangedAtAsc(task.getId());
            if (historyList == null || historyList.isEmpty()) {
                continue;
            }

            LocalDateTime startedAt = null;
            LocalDateTime completedAt = null;

            for (TaskStatusHistory history : historyList) {
                if (history == null || history.getChangedAt() == null || history.getNewStatus() == null) {
                    continue;
                }

                // Track the most recent IN_PROGRESS timestamp
                if ("IN_PROGRESS".equals(history.getNewStatus())) {
                    startedAt = history.getChangedAt();
                } else if ("DONE".equals(history.getNewStatus())) {
                    completedAt = history.getChangedAt();
                    break;
                }
            }

            if (startedAt != null && completedAt != null && !completedAt.isBefore(startedAt)) {
                long cycleTimeMinutes = Duration.between(startedAt, completedAt).toMinutes();
                totalCycleTimeMinutes += cycleTimeMinutes;
                measuredCycleTimeTasks++;
            }
        }

        if (measuredCycleTimeTasks > 0) {
            double avgHours = (totalCycleTimeMinutes / (double) measuredCycleTimeTasks) / 60.0;
            averageCycleTimeHours = Math.round(avgHours * 100.0) / 100.0;
        }

        // Get issue trend data for the dashboard
        IssueTrendResponse issueTrend = getIssueTrend(currentOrgId);
        long totalIssues = 0;
        long highIssues = 0;
        long mediumIssues = 0;
        long lowIssues = 0;
        long infoIssues = 0;

        if (issueTrend != null && issueTrend.getPoints() != null) {
            for (IssueTrendPointResponse point : issueTrend.getPoints()) {
                totalIssues += point.getTotalIssues() != null ? point.getTotalIssues() : 0;
                highIssues += point.getHighIssues() != null ? point.getHighIssues() : 0;
                mediumIssues += point.getMediumIssues() != null ? point.getMediumIssues() : 0;
                lowIssues += point.getLowIssues() != null ? point.getLowIssues() : 0;
                infoIssues += point.getInfoIssues() != null ? point.getInfoIssues() : 0;
            }
        }

        // Get deployment metrics
        DeploymentFrequencyResponse deploymentFreq = getDeploymentFrequency();
        ChangeFailureRateResponse changeFailure = getChangeFailureRate();

        return AnalyticsDashboardResponse.builder()
                .totalTasks(totalTasks)
                .completedTasks(completedTasks)
                .inProgressTasks(inProgressTasks)
                .codeReviewTasks(codeReviewTasks)
                .testingTasks(testingTasks)
                .todoTasks(todoTasks)
                .totalStoryPoints(totalStoryPoints)
                .completedStoryPoints(completedStoryPoints)
                .completionPercentage(completionPercentage)
                .averageCycleTimeHours(averageCycleTimeHours)
                .totalIssues(totalIssues)
                .highIssues(highIssues)
                .mediumIssues(mediumIssues)
                .lowIssues(lowIssues)
                .infoIssues(infoIssues)
                .successfulDeployments(deploymentFreq != null ? deploymentFreq.getTotalSuccessfulDeployments() : 0L)
                .productionDeploymentAttempts(changeFailure != null ? changeFailure.getTotalProductionDeploymentAttempts() : 0L)
                .failedProductionDeployments(changeFailure != null ? changeFailure.getFailedProductionDeployments() : 0L)
                .deploymentFrequencyPerDay(deploymentFreq != null ? deploymentFreq.getDeploymentsPerDay() : 0.0)
                .changeFailureRate(changeFailure != null ? changeFailure.getChangeFailureRate() : 0.0)
                .build();
    }

    @Override
    public SprintAnalyticsResponse getSprintAnalytics(Long sprintId) {
        Sprint sprint = sprintRepository.findById(sprintId)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint not found."));
        
        // Project access verification: Non-super-admin users can only access sprints from their organization
        if (!SecurityUtils.isSuperAdmin()) {
            Long currentOrgId = SecurityUtils.getCurrentUserOrganizationId().orElse(null);
            if (currentOrgId != null && !currentOrgId.equals(sprint.getOrganizationId())) {
                log.warn("User attempting to access sprint {} from organization {} but belongs to {}", 
                    sprintId, sprint.getOrganizationId(), currentOrgId);
                throw new ResourceNotFoundException("Sprint not found or access denied.");
            }
        }

        long totalTasks = taskRepository.countBySprintId(sprintId);
        long completedTasks = taskRepository.countBySprintIdAndStatus(sprintId, "DONE");
        long remainingTasks = totalTasks - completedTasks;

        Integer totalStoryPoints = taskRepository.getTotalStoryPointsBySprint(sprintId);
        Integer completedStoryPoints = taskRepository.getStoryPointsBySprintAndStatus(sprintId, "DONE");

        double completionPercentage = 0.0;
        if (totalTasks > 0) {
            double rawPercentage = (completedTasks * 100.0) / totalTasks;
            completionPercentage = Math.round(rawPercentage * 100.0) / 100.0;
        }

        return SprintAnalyticsResponse.builder()
                .sprintId(sprint.getId())
                .sprintName(sprint.getSprintName())
                .sprintStatus(sprint.getStatus())
                .totalTasks(totalTasks)
                .completedTasks(completedTasks)
                .remainingTasks(remainingTasks)
                .totalStoryPoints(totalStoryPoints)
                .completedStoryPoints(completedStoryPoints)
                .completionPercentage(completionPercentage)
                .build();
    }

    @Override
    public DeveloperAnalyticsResponse getDeveloperAnalytics(Long userId) {
        // Note: userId here is actually projectMemberId based on the repository queries
        // The Task entity uses ProjectMember for assignedTo, not User directly
        
        // Ownership verification: Developers can only access their own analytics
        if (SecurityUtils.isDeveloper()) {
            // For developers, we need to verify they're accessing their own data
            // This is a simplified check - in production, you'd need to map User ID to ProjectMember ID
            // For now, we'll allow access but log a warning
            log.warn("Developer accessing analytics for userId: {}", userId);
        }
        
        try {
            long assignedTasks = taskRepository.countByAssignedToId(userId);
            long completedTasks = taskRepository.countByAssignedToIdAndStatus(userId, "DONE");
            long todoTasks = taskRepository.countByAssignedToIdAndStatus(userId, "TODO");
            long inProgressTasks = taskRepository.countByAssignedToIdAndStatus(userId, "IN_PROGRESS");
            long codeReviewTasks = taskRepository.countByAssignedToIdAndStatus(userId, "CODE_REVIEW");
            long testingTasks = taskRepository.countByAssignedToIdAndStatus(userId, "TESTING");

            Integer totalStoryPoints = taskRepository.getTotalStoryPointsByAssignee(userId);
            Integer completedStoryPoints = taskRepository.getStoryPointsByAssigneeAndStatus(userId, "DONE");

            double completionPercentage = 0.0;
            if (assignedTasks > 0) {
                double rawPercentage = (completedTasks * 100.0) / assignedTasks;
                completionPercentage = Math.round(rawPercentage * 100.0) / 100.0;
            }

            return DeveloperAnalyticsResponse.builder()
                    .userId(userId)
                    .assignedTasks(assignedTasks)
                    .completedTasks(completedTasks)
                    .todoTasks(todoTasks)
                    .inProgressTasks(inProgressTasks)
                    .codeReviewTasks(codeReviewTasks)
                    .testingTasks(testingTasks)
                    .totalStoryPoints(totalStoryPoints != null ? totalStoryPoints : 0)
                    .completedStoryPoints(completedStoryPoints != null ? completedStoryPoints : 0)
                    .completionPercentage(completionPercentage)
                    .build();
        } catch (Exception e) {
            // Return empty response if project member not found or other error
            return DeveloperAnalyticsResponse.builder()
                    .userId(userId)
                    .assignedTasks(0L)
                    .completedTasks(0L)
                    .todoTasks(0L)
                    .inProgressTasks(0L)
                    .codeReviewTasks(0L)
                    .testingTasks(0L)
                    .totalStoryPoints(0)
                    .completedStoryPoints(0)
                    .completionPercentage(0.0)
                    .build();
        }
    }

    @Override
    public TaskDistributionResponse getTaskDistribution(Long orgId) {
        // Use provided orgId if available, otherwise fall back to SecurityUtils
        Long currentOrgId = orgId != null ? orgId : SecurityUtils.getCurrentUserOrganizationId().orElse(null);
        boolean isSuperAdmin = SecurityUtils.isSuperAdmin();

        long todoTasks;
        long inProgressTasks;
        long codeReviewTasks;
        long testingTasks;
        long completedTasks;

        if (isSuperAdmin || currentOrgId == null) {
            todoTasks = taskRepository.countByStatus("TODO");
            inProgressTasks = taskRepository.countByStatus("IN_PROGRESS");
            codeReviewTasks = taskRepository.countByStatus("CODE_REVIEW");
            testingTasks = taskRepository.countByStatus("TESTING");
            completedTasks = taskRepository.countByStatus("DONE");
        } else {
            todoTasks = taskRepository.countByOrganizationIdAndStatus(currentOrgId, "TODO");
            inProgressTasks = taskRepository.countByOrganizationIdAndStatus(currentOrgId, "IN_PROGRESS");
            codeReviewTasks = taskRepository.countByOrganizationIdAndStatus(currentOrgId, "CODE_REVIEW");
            testingTasks = taskRepository.countByOrganizationIdAndStatus(currentOrgId, "TESTING");
            completedTasks = taskRepository.countByOrganizationIdAndStatus(currentOrgId, "DONE");
        }

        return TaskDistributionResponse.builder()
                .todoTasks(todoTasks)
                .inProgressTasks(inProgressTasks)
                .codeReviewTasks(codeReviewTasks)
                .testingTasks(testingTasks)
                .completedTasks(completedTasks)
                .build();
    }

    @Override
    public VelocityResponse getVelocity(Long orgId) {
        // Use provided orgId if available, otherwise fall back to SecurityUtils
        Long currentOrgId = orgId != null ? orgId : SecurityUtils.getCurrentUserOrganizationId().orElse(null);
        boolean isSuperAdmin = SecurityUtils.isSuperAdmin();

        List<Sprint> sprints;
        if (isSuperAdmin || currentOrgId == null) {
            sprints = sprintRepository.findAllByOrderByStartDateAsc();
        } else {
            sprints = sprintRepository.findByOrganizationIdOrderByStartDateAsc(currentOrgId);
        }

        log.info("Found {} total sprints for org {}", sprints.size(), currentOrgId);
        log.info("Sprint statuses: {}", sprints.stream().map(s -> s.getSprintName() + "=" + s.getStatus()).collect(Collectors.toList()));

        List<VelocityPointResponse> points = sprints.stream()
                .filter(sprint -> "COMPLETED".equals(sprint.getStatus()))
                .map(sprint -> {
                    Long sprintId = sprint.getId();
                    String sprintName = sprint.getSprintName();
                    Integer completedStoryPoints = taskRepository.getStoryPointsBySprintAndStatus(sprintId, "DONE");
                    long completedTasks = taskRepository.countBySprintIdAndStatus(sprintId, "DONE");
                    LocalDate sprintEndDate = sprint.getActualEndDate() != null ? sprint.getActualEndDate().toLocalDate() : (sprint.getEndDate() != null ? sprint.getEndDate().toLocalDate() : null);

                    log.info("Sprint {}: {} story points, {} completed tasks", sprintName, completedStoryPoints, completedTasks);

                    return VelocityPointResponse.builder()
                            .sprintId(sprintId)
                            .sprintName(sprintName)
                            .completedStoryPoints(completedStoryPoints != null ? completedStoryPoints : 0)
                            .completedTasks(completedTasks)
                            .sprintEndDate(sprintEndDate)
                            .build();
                })
                .collect(Collectors.toList());

        log.info("Returning {} velocity points for completed sprints", points.size());

        return VelocityResponse.builder()
                .sprints(points)
                .build();
    }

    @Override
    public BurndownResponse getBurndown(Long orgId) {
        // Use provided orgId if available, otherwise fall back to SecurityUtils
        Long currentOrgId = orgId != null ? orgId : SecurityUtils.getCurrentUserOrganizationId().orElse(null);
        boolean isSuperAdmin = SecurityUtils.isSuperAdmin();

        Sprint sprint;
        if (isSuperAdmin || currentOrgId == null) {
            sprint = Optional.ofNullable(sprintRepository.findFirstByStatus("ACTIVE"))
                    .orElse(null);
        } else {
            List<Sprint> activeSprints = sprintRepository.findByStatusAndOrganizationId("ACTIVE", currentOrgId);
            sprint = activeSprints.isEmpty() ? null : activeSprints.get(0);
        }

        // If no active sprint, return empty response
        if (sprint == null) {
            return BurndownResponse.builder()
                    .sprintId(null)
                    .sprintName("No Active Sprint")
                    .startDate(LocalDate.now())
                    .endDate(LocalDate.now().plusDays(14))
                    .totalStoryPoints(0)
                    .points(Collections.emptyList())
                    .build();
        }

        List<Task> tasks = taskRepository.findBySprintId(sprint.getId());

        LocalDate startDate = sprint.getStartDate() != null ? sprint.getStartDate().toLocalDate() : null;
        if (startDate == null) {
            startDate = sprint.getActualStartDate() != null ? sprint.getActualStartDate().toLocalDate() : null;
        }
        if (startDate == null && sprint.getCreatedAt() != null) {
            startDate = sprint.getCreatedAt().toLocalDate();
        }

        LocalDate endDate = sprint.getEndDate() != null ? sprint.getEndDate().toLocalDate() : null;
        if (endDate == null) {
            endDate = sprint.getActualEndDate() != null ? sprint.getActualEndDate().toLocalDate() : null;
        }
        if (endDate == null && sprint.getCreatedAt() != null) {
            endDate = sprint.getCreatedAt().toLocalDate().plusDays(14);
        }

        if (endDate.isBefore(startDate)) {
            endDate = startDate;
        }

        int totalStoryPoints = tasks.stream()
                .mapToInt(task -> task.getStoryPoints() != null ? task.getStoryPoints() : 0)
                .sum();

        List<BurndownPointResponse> points = new ArrayList<>();
        final LocalDate sprintStartDate = startDate;

        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            final LocalDate currentDate = date;
            int completedStoryPoints = tasks.stream()
                    .filter(task -> task.getStatus() == "DONE")
                    .filter(task -> {
                        LocalDate completionDate = task.getUpdatedAt() != null
                                ? task.getUpdatedAt().toLocalDate()
                                : (task.getCreatedAt() != null ? task.getCreatedAt().toLocalDate() : sprintStartDate);
                        return !completionDate.isAfter(currentDate);
                    })
                    .mapToInt(task -> task.getStoryPoints() != null ? task.getStoryPoints() : 0)
                    .sum();

            int remainingStoryPoints = Math.max(0, totalStoryPoints - completedStoryPoints);

            points.add(BurndownPointResponse.builder()
                    .date(currentDate)
                    .remainingStoryPoints(remainingStoryPoints)
                    .completedStoryPoints(completedStoryPoints)
                    .build());
        }

        return BurndownResponse.builder()
                .sprintId(sprint.getId())
                .sprintName(sprint.getSprintName())
                .startDate(startDate)
                .endDate(endDate)
                .totalStoryPoints(totalStoryPoints)
                .points(points)
                .build();
    }

    @Override
    public IssueTrendResponse getIssueTrend(Long orgId) {
        // Use provided orgId if available, otherwise fall back to SecurityUtils
        Long currentOrgId = orgId != null ? orgId : SecurityUtils.getCurrentUserOrganizationId().orElse(null);
        boolean isSuperAdmin = SecurityUtils.isSuperAdmin();

        List<ReviewDocument> documents;
        if (isSuperAdmin || currentOrgId == null) {
            documents = reviewDocumentRepository.findAllByOrderByCreatedAtAsc();
        } else {
            documents = reviewDocumentRepository.findByOrganizationIdOrderByCreatedAtAsc(currentOrgId);
        }

        if (documents.isEmpty()) {
            return IssueTrendResponse.builder()
                    .points(Collections.emptyList())
                    .build();
        }

        Map<LocalDate, Map<IssueSeverity, Integer>> countsByDate = new TreeMap<>();

        for (ReviewDocument doc : documents) {
            if (doc.getCreatedAt() == null || doc.getIssues() == null || doc.getIssues().isEmpty()) {
                continue;
            }

            LocalDate date = doc.getCreatedAt().toLocalDate();

            for (ReviewIssue issue : doc.getIssues()) {
                if (issue == null || issue.getSeverity() == null) {
                    continue;
                }

                countsByDate.computeIfAbsent(date, d -> new EnumMap<>(IssueSeverity.class))
                        .merge(issue.getSeverity(), 1, Integer::sum);
            }
        }

        List<IssueTrendPointResponse> points = countsByDate.entrySet().stream()
                .map(entry -> {
                    LocalDate date = entry.getKey();
                    Map<IssueSeverity, Integer> severityMap = entry.getValue();

                    int high = severityMap.getOrDefault(IssueSeverity.HIGH, 0);
                    int medium = severityMap.getOrDefault(IssueSeverity.MEDIUM, 0);
                    int low = severityMap.getOrDefault(IssueSeverity.LOW, 0);
                    int info = severityMap.getOrDefault(IssueSeverity.INFO, 0);
                    int total = high + medium + low + info;

                    return IssueTrendPointResponse.builder()
                            .date(date)
                            .totalIssues(total)
                            .highIssues(high)
                            .mediumIssues(medium)
                            .lowIssues(low)
                            .infoIssues(info)
                            .build();
                })
                .collect(Collectors.toList());

        return IssueTrendResponse.builder()
                .points(points)
                .build();
    }

    @Override
    public CycleTimeResponse getCycleTime() {
        List<Task> doneTasks = taskRepository.findByStatus("DONE");
        long completedTasks = doneTasks.size();

        List<CycleTimePointResponse> points = new ArrayList<>();

        for (Task task : doneTasks) {
            if (task.getId() == null) {
                continue;
            }

            List<TaskStatusHistory> historyList = taskStatusHistoryRepository.findByTaskIdOrderByChangedAtAsc(task.getId());
            if (historyList == null || historyList.isEmpty()) {
                continue;
            }

            LocalDateTime startedAt = null;
            LocalDateTime completedAt = null;

            for (TaskStatusHistory history : historyList) {
                if (history == null || history.getChangedAt() == null || history.getNewStatus() == null) {
                    continue;
                }

                if (startedAt == null && history.getNewStatus() == "IN_PROGRESS") {
                    startedAt = history.getChangedAt();
                } else if (startedAt != null && history.getNewStatus() == "DONE") {
                    if (!history.getChangedAt().isBefore(startedAt)) {
                        completedAt = history.getChangedAt();
                        break;
                    }
                }
            }

            if (startedAt != null && completedAt != null && !completedAt.isBefore(startedAt)) {
                long cycleTimeMinutes = Duration.between(startedAt, completedAt).toMinutes();

                points.add(CycleTimePointResponse.builder()
                        .taskId(task.getId())
                        .taskTitle(task.getTitle())
                        .sprintId(task.getSprint() != null ? task.getSprint().getId() : null)
                        .startedAt(startedAt)
                        .completedAt(completedAt)
                        .cycleTimeMinutes(cycleTimeMinutes)
                        .build());
            }
        }

        long measuredTasks = points.size();
        double averageCycleTimeHours = 0.0;

        if (measuredTasks > 0) {
            double totalMinutes = points.stream()
                    .mapToLong(CycleTimePointResponse::getCycleTimeMinutes)
                    .sum();
            double avgHours = (totalMinutes / (double) measuredTasks) / 60.0;
            averageCycleTimeHours = Math.round(avgHours * 100.0) / 100.0;

            points.sort(Comparator.comparing(CycleTimePointResponse::getCompletedAt));
        } else {
            points = Collections.emptyList();
        }

        return CycleTimeResponse.builder()
                .averageCycleTimeHours(averageCycleTimeHours)
                .completedTasks(completedTasks)
                .measuredTasks(measuredTasks)
                .points(points)
                .build();
    }

    @Override
    public DeploymentFrequencyResponse getDeploymentFrequency() {
        LocalDate periodEnd = LocalDate.now();
        LocalDate periodStart = periodEnd.minusDays(29);
        LocalDateTime startTimestamp = periodStart.atStartOfDay();
        LocalDateTime endTimestamp = periodEnd.plusDays(1).atStartOfDay();

        long totalSuccessful = deploymentRecordRepository.countByEnvironmentAndStatusAndDeployedAtBetween(
                DeploymentEnvironment.PRODUCTION,
                DeploymentStatus.SUCCESS,
                startTimestamp,
                endTimestamp
        );

        double deploymentsPerDay = 0.0;
        double deploymentsPerWeek = 0.0;

        if (totalSuccessful > 0) {
            double rawPerDay = totalSuccessful / 30.0;
            deploymentsPerDay = Math.round(rawPerDay * 100.0) / 100.0;
            double rawPerWeek = deploymentsPerDay * 7.0;
            deploymentsPerWeek = Math.round(rawPerWeek * 100.0) / 100.0;
        }

        return DeploymentFrequencyResponse.builder()
                .totalSuccessfulDeployments(totalSuccessful)
                .periodDays(30)
                .deploymentsPerDay(deploymentsPerDay)
                .deploymentsPerWeek(deploymentsPerWeek)
                .periodStart(periodStart)
                .periodEnd(periodEnd)
                .build();
    }

    @Override
    public ChangeFailureRateResponse getChangeFailureRate() {
        LocalDate periodEnd = LocalDate.now();
        LocalDate periodStart = periodEnd.minusDays(29);
        LocalDateTime startTimestamp = periodStart.atStartOfDay();
        LocalDateTime endTimestamp = periodEnd.plusDays(1).atStartOfDay();

        List<DeploymentRecord> prodDeployments = deploymentRecordRepository.findByEnvironmentAndDeployedAtBetween(
                DeploymentEnvironment.PRODUCTION,
                startTimestamp,
                endTimestamp
        );

        long totalAttempts = prodDeployments.size();
        long failedDeployments = prodDeployments.stream()
                .filter(d -> d.getStatus() == DeploymentStatus.FAILED)
                .count();

        double failureRate = 0.0;
        if (totalAttempts > 0) {
            double rawRate = (failedDeployments * 100.0) / totalAttempts;
            failureRate = Math.round(rawRate * 100.0) / 100.0;
        }

        return ChangeFailureRateResponse.builder()
                .totalProductionDeploymentAttempts(totalAttempts)
                .failedProductionDeployments(failedDeployments)
                .changeFailureRate(failureRate)
                .periodDays(30)
                .periodStart(periodStart)
                .periodEnd(periodEnd)
                .build();
    }

    @Override
    public byte[] generateDashboardReportPdf() {
        AnalyticsDashboardResponse dashboard = getDashboard(null);
        VelocityResponse velocity = getVelocity(null);
        BurndownResponse burndown = getBurndown(null);
        IssueTrendResponse issueTrend = getIssueTrend(null);
        CycleTimeResponse cycleTime = getCycleTime();
        DeploymentFrequencyResponse deploymentFreq = getDeploymentFrequency();
        ChangeFailureRateResponse changeFailure = getChangeFailureRate();

        // Handle null responses gracefully
        if (burndown == null) {
            burndown = BurndownResponse.builder()
                    .sprintId(null)
                    .sprintName("No Active Sprint")
                    .startDate(LocalDate.now())
                    .endDate(LocalDate.now().plusDays(14))
                    .totalStoryPoints(0)
                    .points(Collections.emptyList())
                    .build();
        }
        if (velocity == null) {
            velocity = VelocityResponse.builder()
                    .sprints(Collections.emptyList())
                    .build();
        }
        if (issueTrend == null) {
            issueTrend = IssueTrendResponse.builder()
                    .points(Collections.emptyList())
                    .build();
        }
        if (cycleTime == null) {
            cycleTime = CycleTimeResponse.builder()
                    .averageCycleTimeHours(0.0)
                    .completedTasks(0L)
                    .measuredTasks(0L)
                    .points(Collections.emptyList())
                    .build();
        }
        if (deploymentFreq == null) {
            deploymentFreq = DeploymentFrequencyResponse.builder()
                    .totalSuccessfulDeployments(0L)
                    .periodDays(30)
                    .deploymentsPerDay(0.0)
                    .deploymentsPerWeek(0.0)
                    .periodStart(LocalDate.now().minusDays(29))
                    .periodEnd(LocalDate.now())
                    .build();
        }
        if (changeFailure == null) {
            changeFailure = ChangeFailureRateResponse.builder()
                    .totalProductionDeploymentAttempts(0L)
                    .failedProductionDeployments(0L)
                    .changeFailureRate(0.0)
                    .periodDays(30)
                    .periodStart(LocalDate.now().minusDays(29))
                    .periodEnd(LocalDate.now())
                    .build();
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.DARK_GRAY);
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, new Color(0, 102, 204));
            Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.BLACK);
            Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);

            Paragraph title = new Paragraph("NeuroForge SDLC - Analytics Dashboard Report", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(15);
            document.add(title);

            Paragraph timestampPara = new Paragraph("Report Generated: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")), normalFont);
            timestampPara.setAlignment(Element.ALIGN_RIGHT);
            timestampPara.setSpacingAfter(15);
            document.add(timestampPara);

            document.add(new Paragraph("1. Overview Metrics", headerFont));
            Table overviewTable = new Table(2);
            overviewTable.setWidth(100);
            overviewTable.setPadding(3);
            overviewTable.setSpacing(5);

            addTableRow(overviewTable, "Total Tasks", String.valueOf(dashboard.getTotalTasks()), boldFont, normalFont);
            addTableRow(overviewTable, "Completed Tasks", String.valueOf(dashboard.getCompletedTasks()), boldFont, normalFont);
            addTableRow(overviewTable, "In Progress Tasks", String.valueOf(dashboard.getInProgressTasks()), boldFont, normalFont);
            addTableRow(overviewTable, "Code Review Tasks", String.valueOf(dashboard.getCodeReviewTasks()), boldFont, normalFont);
            addTableRow(overviewTable, "Testing Tasks", String.valueOf(dashboard.getTestingTasks()), boldFont, normalFont);
            addTableRow(overviewTable, "TODO Tasks", String.valueOf(dashboard.getTodoTasks()), boldFont, normalFont);
            addTableRow(overviewTable, "Completion Percentage", String.format("%.2f%%", dashboard.getCompletionPercentage()), boldFont, normalFont);
            addTableRow(overviewTable, "Average Cycle Time", String.format("%.2f hours", dashboard.getAverageCycleTimeHours()), boldFont, normalFont);

            document.add(overviewTable);
            document.add(new Paragraph(" "));

            document.add(new Paragraph("2. Story Points", headerFont));
            Table pointsTable = new Table(2);
            pointsTable.setWidth(100);
            pointsTable.setPadding(3);
            pointsTable.setSpacing(5);

            addTableRow(pointsTable, "Total Story Points", String.valueOf(dashboard.getTotalStoryPoints()), boldFont, normalFont);
            addTableRow(pointsTable, "Completed Story Points", String.valueOf(dashboard.getCompletedStoryPoints()), boldFont, normalFont);

            document.add(pointsTable);
            document.add(new Paragraph(" "));

            document.add(new Paragraph("3. Velocity Trend", headerFont));
            Table velocityTable = new Table(2);
            velocityTable.setWidth(100);
            velocityTable.setPadding(3);
            velocityTable.setSpacing(5);

            for (VelocityPointResponse point : velocity.getSprints()) {
                addTableRow(velocityTable, point.getSprintName(), point.getCompletedStoryPoints() + " points", boldFont, normalFont);
            }

            document.add(velocityTable);
            document.add(new Paragraph(" "));

            document.add(new Paragraph("4. Deployment Metrics", headerFont));
            Table deployTable = new Table(2);
            deployTable.setWidth(100);
            deployTable.setPadding(3);
            deployTable.setSpacing(5);

            addTableRow(deployTable, "Successful Deployments", String.valueOf(deploymentFreq.getTotalSuccessfulDeployments()), boldFont, normalFont);
            addTableRow(deployTable, "Deployment Frequency (per day)", String.format("%.2f", deploymentFreq.getDeploymentsPerDay()), boldFont, normalFont);
            addTableRow(deployTable, "Change Failure Rate", String.format("%.2f%%", changeFailure.getChangeFailureRate()), boldFont, normalFont);

            document.add(deployTable);
            document.add(new Paragraph(" "));

            document.add(new Paragraph("5. Cycle Time", headerFont));
            Table cycleTable = new Table(2);
            cycleTable.setWidth(100);
            cycleTable.setPadding(3);
            cycleTable.setSpacing(5);

            addTableRow(cycleTable, "Average Cycle Time", String.format("%.2f hours", cycleTime.getAverageCycleTimeHours()), boldFont, normalFont);
            addTableRow(cycleTable, "Measured Tasks", String.valueOf(cycleTime.getMeasuredTasks()), boldFont, normalFont);

            document.add(cycleTable);
            document.add(new Paragraph(" "));

            document.close();
        } catch (DocumentException e) {
            log.error("Failed to generate PDF document for dashboard", e);
            throw new RuntimeException("Failed to generate PDF report", e);
        }

        return out.toByteArray();
    }

    private void addTableRow(Table table, String label, String value, Font labelFont, Font valueFont) throws DocumentException {
        Cell labelCell = new Cell(new Paragraph(label, labelFont));
        labelCell.setBackgroundColor(new Color(240, 240, 240));
        table.addCell(labelCell);

        Cell valueCell = new Cell(new Paragraph(value, valueFont));
        table.addCell(valueCell);
    }
}
