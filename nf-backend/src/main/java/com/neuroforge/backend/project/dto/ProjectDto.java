package com.neuroforge.backend.project.dto;

import com.neuroforge.backend.project.entity.Project;
import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectDto {

    private Long id;
    private String projectName;
    private String description;
    private String status;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    // Methodology: AGILE, WATERFALL, HYBRID
    private String methodology;
    // Tech stack tags (comma-separated)
    private String techStack;
    private Long organizationId;
    private String organizationName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Double progress;

    public static ProjectDto from(Project project) {

        return ProjectDto.builder()
                .id(project.getId())
                .projectName(project.getProjectName())
                .description(project.getDescription())
                .status(project.getStatus())
                .startDate(project.getStartDate())
                .endDate(project.getEndDate())
                .methodology(project.getMethodology())
                .techStack(project.getTechStack())
                .organizationId(
                        project.getOrganization() != null
                                ? project.getOrganization().getId()
                                : null)
                .organizationName(
                        project.getOrganization() != null
                                ? project.getOrganization().getName()
                                : null)
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .progress(0.0)
                .build();
    }
}
