package com.neuroforge.backend.project.dto;

import com.neuroforge.backend.project.entity.Task;
import com.neuroforge.backend.specification.entity.Specification;
import com.neuroforge.backend.specification.entity.SpecificationVersion;
import com.neuroforge.backend.specification.repository.SpecificationRepository;
import com.neuroforge.backend.specification.repository.SpecificationVersionRepository;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.Optional;

@Data
@Builder
public class TaskDto {

    private Long id;

    // Module 7: Task key for commit linking (e.g., NF-123)
    private String taskKey;

    private String title;

    private String description;

    private String priority;

    private String status;

    // Module 5: Story Points
    private Integer storyPoints;

    // Module 5: Labels
    private String labels;

    // Module 4: Specification Traceability
    private UUID specificationId;
    private UUID specificationVersionId;
    private String specificationTitle;
    private Integer specificationVersionNumber;

    private Long projectId;

    private Long sprintId;

    private Long assignedToId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public static TaskDto from(Task task) {
        return from(task, null, null);
    }

    public static TaskDto from(Task task, SpecificationRepository specRepo, SpecificationVersionRepository specVersionRepo) {
        String specTitle = null;
        Integer specVersionNumber = null;

        if (task.getSpecificationId() != null && specRepo != null) {
            Optional<Specification> spec = specRepo.findById(task.getSpecificationId());
            if (spec.isPresent()) {
                specTitle = spec.get().getTitle();
            }
        }

        if (task.getSpecificationVersionId() != null && specVersionRepo != null) {
            Optional<SpecificationVersion> specVersion = specVersionRepo.findById(task.getSpecificationVersionId());
            if (specVersion.isPresent()) {
                specVersionNumber = specVersion.get().getVersionNumber();
            }
        }

        return TaskDto.builder()
                .id(task.getId())
                .taskKey(task.getTaskKey())
                .title(task.getTitle())
                .description(task.getDescription())
                .priority(task.getPriority())
                .status(task.getStatus())
                .storyPoints(task.getStoryPoints())
                .labels(task.getLabels())
                .specificationId(task.getSpecificationId())
                .specificationVersionId(task.getSpecificationVersionId())
                .specificationTitle(specTitle)
                .specificationVersionNumber(specVersionNumber)
                .projectId(task.getProject().getId())
                .sprintId(task.getSprint() != null ? task.getSprint().getId() : null)
                .assignedToId(task.getAssignedTo() != null ? task.getAssignedTo().getId() : null)
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .build();
    }
}