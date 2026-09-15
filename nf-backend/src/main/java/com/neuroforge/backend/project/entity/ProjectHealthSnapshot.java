package com.neuroforge.backend.project.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * Project Health Snapshot
 * 
 * Stores daily health snapshots for projects to track health trends over time.
 * Created by ProjectHealthScheduler running nightly.
 */
@Entity
@Table(name = "project_health_snapshots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectHealthSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "health_status", nullable = false)
    private String healthStatus; // HEALTHY, AT_RISK, CRITICAL

    @Column(name = "task_completion_rate")
    private Double taskCompletionRate; // Percentage (0-100)

    @Column(name = "timeline_elapsed_rate")
    private Double timelineElapsedRate; // Percentage (0-100)

    @Column(name = "total_tasks")
    private Integer totalTasks;

    @Column(name = "completed_tasks")
    private Integer completedTasks;

    @Column(name = "days_elapsed")
    private Integer daysElapsed;

    @Column(name = "total_days")
    private Integer totalDays;

    @Column(name = "created_at")
    private java.time.LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        createdAt = java.time.LocalDateTime.now();
    }
}
