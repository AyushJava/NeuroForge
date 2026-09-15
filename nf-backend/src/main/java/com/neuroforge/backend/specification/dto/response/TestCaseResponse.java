package com.neuroforge.backend.specification.dto.response;

import com.neuroforge.backend.specification.enums.TestStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestCaseResponse {
    private UUID id;
    private String title;
    private String description;
    private String steps;
    private String expectedResult;
    private TestStatus status;
    private String priority;
    private String testType;
    private String linkedAcceptanceCriteria;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Simplified specification info
    private UUID specificationId;
    private String specificationTitle;
    private Integer specificationVersion;
}
