package com.neuroforge.backend.project.dto;

import com.neuroforge.backend.validation.NotSameDay;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@NotSameDay(startDateField = "startDate", endDateField = "endDate", message = "Start Date and End Date cannot be the same")
public class UpdateProjectRequest {

    private String projectName;

    private String description;

    private String status;

    private LocalDateTime startDate;

    private LocalDateTime endDate;

    // Methodology: AGILE, WATERFALL, HYBRID
    private String methodology;

    // Tech stack tags (comma-separated)
    private String techStack;

}