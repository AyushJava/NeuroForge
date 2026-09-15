package com.neuroforge.backend.specification.service;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.security.SecurityUtils;
import com.neuroforge.backend.specification.dto.request.GenerateTestsRequest;
import com.neuroforge.backend.specification.dto.response.GenerateTestsResponse;
import com.neuroforge.backend.specification.dto.response.TestCaseResponse;
import com.neuroforge.backend.specification.entity.TestCase;
import com.neuroforge.backend.specification.entity.Specification;
import com.neuroforge.backend.specification.entity.SpecificationVersion;
import com.neuroforge.backend.specification.repository.SpecificationRepository;
import com.neuroforge.backend.specification.repository.SpecificationVersionRepository;
import com.neuroforge.backend.specification.repository.TestCaseRepository;
import com.neuroforge.backend.specification.service.GeminiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TestCaseService {

    private final TestCaseRepository testCaseRepository;
    private final SpecificationRepository specificationRepository;
    private final SpecificationVersionRepository specificationVersionRepository;
    private final GeminiService geminiService;

    /**
     * Generate test cases from an approved specification using AI
     * Module 4: QA Generates tests from specs
     */
    @Transactional
    public ApiResponse<GenerateTestsResponse> generateTests(GenerateTestsRequest request) {
        // Verify user is QA or Super Admin
        if (!SecurityUtils.isSuperAdmin() && !SecurityUtils.hasRole("ROLE_QA")) {
            throw AppException.forbidden("Only QA users can generate test cases");
        }

        UUID specificationId = UUID.fromString(request.getSpecificationId());
        
        Specification specification = specificationRepository.findById(specificationId)
                .orElseThrow(() -> AppException.badRequest("Specification not found"));

        // Verify specification is approved
        if (!"APPROVED".equals(specification.getStatus().name())) {
            throw AppException.badRequest("Test cases can only be generated from approved specifications");
        }

        // Organization isolation: Verify user has access to this specification
        if (!SecurityUtils.isSuperAdmin() && specification.getOrganizationId() != null) {
            Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                    .orElseThrow(() -> AppException.forbidden("User has no organization"));
            if (!specification.getOrganizationId().equals(userOrgId)) {
                throw AppException.forbidden("Access denied: specification belongs to a different organization");
            }
        }

        SpecificationVersion latestVersion = specificationVersionRepository
                .findBySpecificationIdAndVersionNumber(specificationId, specification.getCurrentVersion())
                .orElseThrow(() -> AppException.badRequest("Latest version not found"));

        // Generate test cases using AI (Gemini)
        try {
            GenerateTestsResponse aiResponse = geminiService.generateTestCases(
                specification.getTitle(),
                latestVersion.getDescription(),
                parseStringToList(latestVersion.getUserStories()),
                parseStringToList(latestVersion.getAcceptanceCriteria()),
                parseStringToList(latestVersion.getFunctionalRequirements()),
                parseStringToList(latestVersion.getNonFunctionalRequirements())
            );
            
            aiResponse.setSpecificationId(specificationId.toString());
            
            log.info("AI test cases generated | specificationId={} | testCount={}",
                specificationId, aiResponse.getTestCases() != null ? aiResponse.getTestCases().size() : 0);
            
            return ApiResponse.ok("Test cases generated successfully", aiResponse);
            
        } catch (RuntimeException e) {
            log.error("AI test case generation failed", e);
            throw AppException.badRequest("Failed to generate test cases using AI: " + e.getMessage());
        }
    }

    private List<String> parseStringToList(String value) {
        if (value == null || value.isEmpty()) {
            return new ArrayList<>();
        }
        // Split by newlines and trim
        List<String> list = new ArrayList<>();
        String[] lines = value.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                list.add(trimmed);
            }
        }
        return list;
    }

    /**
     * Save generated test cases
     */
    @Transactional
    public ApiResponse<Void> saveTests(UUID specificationId, List<GenerateTestsResponse.GeneratedTestCase> testCases, String createdBy) {
        // Verify user is QA or Super Admin
        if (!SecurityUtils.isSuperAdmin() && !SecurityUtils.hasRole("ROLE_QA")) {
            throw AppException.forbidden("Only QA users can save test cases");
        }

        Specification specification = specificationRepository.findById(specificationId)
                .orElseThrow(() -> AppException.badRequest("Specification not found"));

        // Organization isolation
        if (!SecurityUtils.isSuperAdmin() && specification.getOrganizationId() != null) {
            Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                    .orElseThrow(() -> AppException.forbidden("User has no organization"));
            if (!specification.getOrganizationId().equals(userOrgId)) {
                throw AppException.forbidden("Access denied: specification belongs to a different organization");
            }
        }

        for (GenerateTestsResponse.GeneratedTestCase testDto : testCases) {
            // Convert testSteps list to string for storage
            String stepsString = testDto.getTestSteps() != null ? String.join("\n", testDto.getTestSteps()) : "";
            String preconditionsString = testDto.getPreconditions() != null ? String.join("\n", testDto.getPreconditions()) : "";
            
            TestCase testCase = TestCase.builder()
                    .specification(specification)
                    .title(testDto.getTitle())
                    .description(testDto.getDescription())
                    .steps(stepsString)
                    .expectedResult(testDto.getExpectedResult())
                    .status(com.neuroforge.backend.specification.enums.TestStatus.DRAFT)
                    .priority(testDto.getPriority())
                    .testType(testDto.getTestType())
                    .linkedAcceptanceCriteria(testDto.getLinkedAcceptanceCriteria())
                    .createdBy(createdBy)
                    .build();
            testCaseRepository.save(testCase);
        }

        log.info("Test cases saved | specificationId={} | testCount={}",
                specificationId, testCases.size());

        return ApiResponse.ok("Test cases saved successfully");
    }

    /**
     * Get test cases for a specification
     */
    public ApiResponse<List<TestCase>> getTestsBySpecification(UUID specificationId) {
        Specification specification = specificationRepository.findById(specificationId)
                .orElseThrow(() -> AppException.badRequest("Specification not found"));

        // Organization isolation
        if (!SecurityUtils.isSuperAdmin() && specification.getOrganizationId() != null) {
            Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                    .orElseThrow(() -> AppException.forbidden("User has no organization"));
            if (!specification.getOrganizationId().equals(userOrgId)) {
                throw AppException.forbidden("Access denied: specification belongs to a different organization");
            }
        }

        List<TestCase> testCases = testCaseRepository.findBySpecificationIdOrderByCreatedAtDesc(specificationId);
        return ApiResponse.ok("Test cases retrieved", testCases);
    }

    /**
     * Get test cases for a project (by organization ID due to schema mismatch)
     * 
     * Note: Specification.projectId is UUID while Project.id is Long, so we cannot
     * directly join by project ID. We filter by organization ID as a workaround.
     * The frontend can further filter by project if needed.
     */
    @Transactional(readOnly = true)
    public ApiResponse<List<TestCaseResponse>> getTestsByProject(Long projectId) {
        Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                .orElseThrow(() -> AppException.forbidden("User has no organization"));
        
        // Get all test cases for specifications in the user's organization
        List<TestCase> orgTestCases = testCaseRepository.findBySpecificationOrganizationIdOrderByCreatedAtDesc(userOrgId);
        
        // Convert to DTOs to avoid LazyInitializationException
        List<TestCaseResponse> responses = orgTestCases.stream()
            .map(tc -> TestCaseResponse.builder()
                .id(tc.getId())
                .title(tc.getTitle())
                .description(tc.getDescription())
                .steps(tc.getSteps())
                .expectedResult(tc.getExpectedResult())
                .status(tc.getStatus())
                .priority(tc.getPriority())
                .testType(tc.getTestType())
                .linkedAcceptanceCriteria(tc.getLinkedAcceptanceCriteria())
                .createdBy(tc.getCreatedBy())
                .createdAt(tc.getCreatedAt())
                .updatedAt(tc.getUpdatedAt())
                .specificationId(tc.getSpecification() != null ? tc.getSpecification().getId() : null)
                .specificationTitle(tc.getSpecification() != null ? tc.getSpecification().getTitle() : null)
                .specificationVersion(tc.getSpecification() != null ? tc.getSpecification().getCurrentVersion() : null)
                .build())
            .collect(java.util.stream.Collectors.toList());
        
        return ApiResponse.ok("Test cases retrieved", responses);
    }
}
