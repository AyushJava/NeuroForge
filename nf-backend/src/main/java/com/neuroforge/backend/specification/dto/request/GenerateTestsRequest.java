package com.neuroforge.backend.specification.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerateTestsRequest {
    
    @NotBlank(message = "Specification ID is required")
    private String specificationId;
    
    private String testType; // UNIT, INTEGRATION, E2E
}
