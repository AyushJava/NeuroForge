package com.neuroforge.backend.specification.controller;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.specification.dto.request.GenerateTestsRequest;
import com.neuroforge.backend.specification.dto.response.GenerateTestsResponse;
import com.neuroforge.backend.specification.dto.response.TestCaseResponse;
import com.neuroforge.backend.specification.entity.TestCase;
import com.neuroforge.backend.specification.service.TestCaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/test-cases")
@Tag(name = "Test Case Management")
@SecurityRequirement(name = "bearerAuth")
public class TestCaseController {

    private final TestCaseService testCaseService;

    /**
     * Generate test cases from an approved specification
     * Module 4: QA Generates tests from specs
     */
    @PostMapping("/generate")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_QA')")
    @Operation(summary = "Generate test cases from specification")
    public ResponseEntity<ApiResponse<GenerateTestsResponse>> generateTests(
            @Valid @RequestBody GenerateTestsRequest request) {

        log.info("Generate test cases request received | specificationId={}", request.getSpecificationId());

        ApiResponse<GenerateTestsResponse> response = testCaseService.generateTests(request);

        return ResponseEntity.ok(response);
    }

    /**
     * Save generated test cases
     */
    @PostMapping("/save")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_QA')")
    @Operation(summary = "Save generated test cases")
    public ResponseEntity<ApiResponse<Void>> saveTests(
            @RequestParam UUID specificationId,
            @RequestBody List<GenerateTestsResponse.GeneratedTestCase> testCases) {

        log.info("Save test cases request received | specificationId={}", specificationId);

        // Get current user from security context
        String createdBy = "QA_USER"; // In production, get from SecurityContext

        testCaseService.saveTests(specificationId, testCases, createdBy);

        return ResponseEntity.ok(ApiResponse.ok("Test cases saved successfully"));
    }

    /**
     * Get test cases for a specification
     */
    @GetMapping("/specification/{specificationId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_QA', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER')")
    @Operation(summary = "Get test cases by specification")
    public ResponseEntity<ApiResponse<List<TestCase>>> getTestsBySpecification(
            @PathVariable UUID specificationId) {

        log.info("Get test cases request received | specificationId={}", specificationId);

        ApiResponse<List<TestCase>> response = testCaseService.getTestsBySpecification(specificationId);

        return ResponseEntity.ok(response);
    }

    /**
     * Get test cases for a project
     */
    @GetMapping("/project/{projectId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_QA', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_ORG_ADMIN')")
    @Operation(summary = "Get test cases by project")
    public ResponseEntity<ApiResponse<List<TestCaseResponse>>> getTestsByProject(
            @PathVariable Long projectId) {

        log.info("Get test cases by project request received | projectId={}", projectId);

        ApiResponse<List<TestCaseResponse>> response = testCaseService.getTestsByProject(projectId);

        return ResponseEntity.ok(response);
    }
}
