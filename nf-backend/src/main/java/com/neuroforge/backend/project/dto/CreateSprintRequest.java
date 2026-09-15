package com.neuroforge.backend.project.dto;

import com.neuroforge.backend.validation.NotSameDay;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@NotSameDay(startDateField = "startDate", endDateField = "endDate", message = "Start Date and End Date cannot be the same")
public class CreateSprintRequest {

    @NotBlank
    private String sprintName;

    private String goal;

    private String status;

    @NotNull
    private Long projectId;

    private LocalDateTime startDate;

    private LocalDateTime endDate;

}