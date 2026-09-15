package com.neuroforge.backend.project.service;

import com.neuroforge.backend.project.entity.Project;
import com.neuroforge.backend.project.entity.ProjectHealthSnapshot;
import com.neuroforge.backend.project.entity.Task;
import com.neuroforge.backend.project.repository.ProjectHealthSnapshotRepository;
import com.neuroforge.backend.project.repository.ProjectRepository;
import com.neuroforge.backend.project.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Project Health Scheduler
 * 
 * Scheduled task that creates daily health snapshots for all active projects.
 * Runs at midnight every day to calculate health based on:
 * - Task completion rate (% tasks done)
 * - Timeline elapsed rate (% timeline elapsed)
 * 
 * Health status determination:
 * - HEALTHY: Task completion >= timeline elapsed
 * - AT_RISK: Task completion >= timeline elapsed - 20%
 * - CRITICAL: Task completion < timeline elapsed - 20%
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ProjectHealthScheduler {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final ProjectHealthSnapshotRepository snapshotRepository;

    /**
     * Scheduled task to create health snapshots for all active projects.
     * Runs at midnight (00:00) every day.
     */
    @Scheduled(cron = "0 0 0 * * ?")
    @Transactional
    public void createDailyHealthSnapshots() {
        log.info("Starting daily project health snapshot creation");
        
        // Find all active projects (not archived or completed)
        List<Project> activeProjects = projectRepository.findByStatusNotIn(List.of("ARCHIVED", "COMPLETED"));
        
        if (activeProjects.isEmpty()) {
            log.info("No active projects found for health snapshot creation");
            return;
        }
        
        LocalDate today = LocalDate.now();
        int snapshotsCreated = 0;
        
        for (Project project : activeProjects) {
            try {
                // Skip if snapshot already exists for today
                if (snapshotRepository.existsByProjectIdAndSnapshotDate(project.getId(), today)) {
                    log.debug("Health snapshot already exists for project {} on {}", project.getId(), today);
                    continue;
                }
                
                // Calculate health metrics
                ProjectHealthMetrics metrics = calculateHealthMetrics(project);
                
                // Determine health status
                String healthStatus = determineHealthStatus(metrics);
                
                // Create and save snapshot
                ProjectHealthSnapshot snapshot = ProjectHealthSnapshot.builder()
                        .project(project)
                        .snapshotDate(today)
                        .healthStatus(healthStatus)
                        .taskCompletionRate(metrics.taskCompletionRate)
                        .timelineElapsedRate(metrics.timelineElapsedRate)
                        .totalTasks(metrics.totalTasks)
                        .completedTasks(metrics.completedTasks)
                        .daysElapsed(metrics.daysElapsed)
                        .totalDays(metrics.totalDays)
                        .build();
                
                snapshotRepository.save(snapshot);
                snapshotsCreated++;
                
                log.info("Created health snapshot for project {}: status={}, taskCompletion={}%, timelineElapsed={}%", 
                        project.getId(), healthStatus, metrics.taskCompletionRate, metrics.timelineElapsedRate);
                        
            } catch (Exception e) {
                log.error("Failed to create health snapshot for project {}", project.getId(), e);
            }
        }
        
        log.info("Daily health snapshot creation completed. Created {} snapshots for {} active projects", 
                snapshotsCreated, activeProjects.size());
    }

    /**
     * Calculate health metrics for a project.
     */
    private ProjectHealthMetrics calculateHealthMetrics(Project project) {
        // Get all tasks for the project
        List<Task> tasks = taskRepository.findByProjectId(project.getId());
        
        int totalTasks = tasks.size();
        int completedTasks = (int) tasks.stream()
                .filter(task -> "DONE".equals(task.getStatus()))
                .count();
        
        // Calculate task completion rate
        double taskCompletionRate = totalTasks > 0 
                ? (completedTasks * 100.0 / totalTasks) 
                : 0.0;
        
        // Calculate timeline elapsed rate
        int daysElapsed = 0;
        int totalDays = 0;
        double timelineElapsedRate = 0.0;
        
        if (project.getStartDate() != null && project.getEndDate() != null) {
            LocalDate startDate = project.getStartDate().toLocalDate();
            LocalDate endDate = project.getEndDate().toLocalDate();
            LocalDate today = LocalDate.now();
            
            totalDays = (int) ChronoUnit.DAYS.between(startDate, endDate);
            
            if (today.isBefore(startDate)) {
                // Project hasn't started yet
                daysElapsed = 0;
                timelineElapsedRate = 0.0;
            } else if (today.isAfter(endDate)) {
                // Project has ended
                daysElapsed = totalDays;
                timelineElapsedRate = 100.0;
            } else {
                // Project is in progress
                daysElapsed = (int) ChronoUnit.DAYS.between(startDate, today);
                timelineElapsedRate = totalDays > 0 ? (daysElapsed * 100.0 / totalDays) : 0.0;
            }
        }
        
        return new ProjectHealthMetrics(
                taskCompletionRate,
                timelineElapsedRate,
                totalTasks,
                completedTasks,
                daysElapsed,
                totalDays
        );
    }

    /**
     * Determine health status based on task completion vs timeline elapsed.
     * 
     * Logic:
     * - HEALTHY: Task completion >= timeline elapsed (on track or ahead)
     * - AT_RISK: Task completion >= timeline elapsed - 20% (slightly behind)
     * - CRITICAL: Task completion < timeline elapsed - 20% (significantly behind)
     */
    private String determineHealthStatus(ProjectHealthMetrics metrics) {
        double taskCompletion = metrics.taskCompletionRate;
        double timelineElapsed = metrics.timelineElapsedRate;
        
        // If no timeline data, use task completion only
        if (metrics.totalDays == 0) {
            if (taskCompletion >= 70) return "HEALTHY";
            if (taskCompletion >= 40) return "AT_RISK";
            return "CRITICAL";
        }
        
        // Calculate the gap between timeline and task completion
        double gap = timelineElapsed - taskCompletion;
        
        if (gap <= 0) {
            return "HEALTHY"; // On track or ahead
        } else if (gap <= 20) {
            return "AT_RISK"; // Slightly behind (within 20%)
        } else {
            return "CRITICAL"; // Significantly behind (more than 20%)
        }
    }

    /**
     * Inner class to hold health metrics.
     */
    private static class ProjectHealthMetrics {
        double taskCompletionRate;
        double timelineElapsedRate;
        int totalTasks;
        int completedTasks;
        int daysElapsed;
        int totalDays;

        ProjectHealthMetrics(double taskCompletionRate, double timelineElapsedRate, 
                           int totalTasks, int completedTasks, int daysElapsed, int totalDays) {
            this.taskCompletionRate = taskCompletionRate;
            this.timelineElapsedRate = timelineElapsedRate;
            this.totalTasks = totalTasks;
            this.completedTasks = completedTasks;
            this.daysElapsed = daysElapsed;
            this.totalDays = totalDays;
        }
    }

    /**
     * Manual trigger for creating health snapshots (useful for testing or on-demand creation).
     */
    @Transactional
    public void createHealthSnapshotForProject(Long projectId) {
        log.info("Creating manual health snapshot for project {}", projectId);
        
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));
        
        LocalDate today = LocalDate.now();
        
        // Skip if snapshot already exists for today
        if (snapshotRepository.existsByProjectIdAndSnapshotDate(projectId, today)) {
            log.info("Health snapshot already exists for project {} on {}", projectId, today);
            return;
        }
        
        // Calculate health metrics
        ProjectHealthMetrics metrics = calculateHealthMetrics(project);
        
        // Determine health status
        String healthStatus = determineHealthStatus(metrics);
        
        // Create and save snapshot
        ProjectHealthSnapshot snapshot = ProjectHealthSnapshot.builder()
                .project(project)
                .snapshotDate(today)
                .healthStatus(healthStatus)
                .taskCompletionRate(metrics.taskCompletionRate)
                .timelineElapsedRate(metrics.timelineElapsedRate)
                .totalTasks(metrics.totalTasks)
                .completedTasks(metrics.completedTasks)
                .daysElapsed(metrics.daysElapsed)
                .totalDays(metrics.totalDays)
                .build();
        
        snapshotRepository.save(snapshot);
        
        log.info("Manual health snapshot created for project {}: status={}, taskCompletion={}%, timelineElapsed={}%", 
                projectId, healthStatus, metrics.taskCompletionRate, metrics.timelineElapsedRate);
    }
}
