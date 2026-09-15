package com.neuroforge.backend.project.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateMilestoneRequest {

    private String name;
    private String description;
    private LocalDate targetDate;
    private LocalDate actualDate;
    private String status;
}
