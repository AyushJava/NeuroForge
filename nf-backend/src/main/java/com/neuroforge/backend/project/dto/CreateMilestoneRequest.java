package com.neuroforge.backend.project.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateMilestoneRequest {

    private Long projectId;
    private String name;
    private String description;
    private LocalDate targetDate;
    private String status;
}
