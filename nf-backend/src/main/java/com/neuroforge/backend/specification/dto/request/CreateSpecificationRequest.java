package com.neuroforge.backend.specification.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSpecificationRequest {

    @NotBlank(message = "Title is required.")
    private String title;

    private String description;

    private String userStories;

    private String acceptanceCriteria;

    private String functionalRequirements;

    private String nonFunctionalRequirements;

    private Long organizationId;

    private String projectId;

}
