package com.neuroforge.backend.specification.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaveAISpecificationRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String projectId;

    private String description;

    private String[] userStories;

    private String[] acceptanceCriteria;

    private String[] functionalRequirements;

    private String[] nonFunctionalRequirements;

    private String aiSpecificationId; // MongoDB reference

    private Long organizationId;
}
