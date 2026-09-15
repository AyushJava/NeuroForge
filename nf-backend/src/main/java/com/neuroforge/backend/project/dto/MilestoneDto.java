package com.neuroforge.backend.project.dto;

import com.neuroforge.backend.project.entity.Milestone;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MilestoneDto {

    private Long id;
    private Long projectId;
    private String name;
    private String description;
    private LocalDate targetDate;
    private LocalDate actualDate;
    private String status;

    public static MilestoneDto from(Milestone milestone) {
        return MilestoneDto.builder()
                .id(milestone.getId())
                .projectId(milestone.getProject() != null ? milestone.getProject().getId() : null)
                .name(milestone.getName())
                .description(milestone.getDescription())
                .targetDate(milestone.getTargetDate())
                .actualDate(milestone.getActualDate())
                .status(milestone.getStatus())
                .build();
    }
}
