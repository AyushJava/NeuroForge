package com.neuroforge.backend.project.dto;

import com.neuroforge.backend.project.entity.Project;
import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PortfolioProjectDto {

    private Long id;
    private String projectName;
    private String description;
    private String status;
    private String health; // HEALTHY, AT_RISK, CRITICAL
    private String organizationName;
    private LocalDateTime startDate;
    private LocalDateTime endDate;

    public static PortfolioProjectDto from(Project project, String health) {

        return PortfolioProjectDto.builder()
                .id(project.getId())
                .projectName(project.getProjectName())
                .description(project.getDescription())
                .status(project.getStatus())
                .health(health)
                .organizationName(
                        project.getOrganization() != null
                                ? project.getOrganization().getName()
                                : null)
                .startDate(project.getStartDate())
                .endDate(project.getEndDate())
                .build();
    }
}