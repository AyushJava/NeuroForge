package com.neuroforge.backend.specification.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerateTestsResponse {
    
    private String specificationId;
    private List<GeneratedTestCase> testCases;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeneratedTestCase {
        private String title;
        private String description;
        private List<String> preconditions;
        private List<String> testSteps;
        private String expectedResult;
        private String priority;
        private String testType;
        private String linkedAcceptanceCriteria;
    }
}
