package com.neuroforge.backend.specification.controller;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.specification.dto.request.CreateSpecificationRequest;
import com.neuroforge.backend.specification.dto.request.GenerateSpecificationRequest;
import com.neuroforge.backend.specification.dto.request.SaveAISpecificationRequest;
import com.neuroforge.backend.specification.dto.request.UpdateSpecificationRequest;
import com.neuroforge.backend.specification.dto.response.GenerateSpecificationResponse;
import com.neuroforge.backend.specification.dto.response.SpecificationResponse;
import com.neuroforge.backend.specification.enums.SpecificationStatus;
import com.neuroforge.backend.specification.service.SpecificationAIService;
import com.neuroforge.backend.specification.service.SpecificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/specifications")
public class SpecificationController {

    private final SpecificationService specificationService;
    private final SpecificationAIService specificationAIService;

    // ── Module 4: AI Generation ─────────────────────────────────────────────

    @GetMapping("/project/{projectId}/approved")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_QA', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_ORG_ADMIN')")
    public ResponseEntity<ApiResponse<Page<SpecificationResponse>>> getApprovedSpecificationsByProject(
            @PathVariable Long projectId,
            @PageableDefault(size = 50) Pageable pageable) {

        log.info("Get approved specifications by project request received | projectId={}", projectId);

        Page<SpecificationResponse> response = specificationService.getApprovedSpecificationsByProject(projectId, pageable);

        return ResponseEntity.ok(ApiResponse.ok("Approved specifications retrieved", response));
    }

    @PostMapping("/generate")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<GenerateSpecificationResponse>> generateSpecification(
            @Valid @RequestBody GenerateSpecificationRequest request) {

        log.info("AI Specification Generation Request received | prompt={}", request.getPrompt());

        GenerateSpecificationResponse response =
                specificationAIService.generateSpecification(request);

        return ResponseEntity.ok(ApiResponse.ok("Specification generated successfully", response));
    }

    @PostMapping("/save-ai")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<SpecificationResponse>> saveAISpecification(
            @Valid @RequestBody SaveAISpecificationRequest request) {

        log.info("Save AI Specification Request received | title={}", request.getTitle());

        SpecificationResponse response =
                specificationService.saveAISpecification(request);

        return ResponseEntity.ok(ApiResponse.ok("AI specification saved successfully", response));
    }

    // ── Existing CRUD Operations ───────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<SpecificationResponse>> createSpecification(
            @Valid @RequestBody CreateSpecificationRequest request) {

        log.info("Create Specification Request received | title={}", request.getTitle());

        SpecificationResponse response =
                specificationService.createSpecification(request);

        return ResponseEntity.ok(ApiResponse.ok("Specification created successfully", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SpecificationResponse>> getSpecification(
            @PathVariable UUID id) {

        log.info("Fetch Specification Request received | id={}", id);

        SpecificationResponse response =
                specificationService.getSpecification(id);

        return ResponseEntity.ok(ApiResponse.ok("Specification fetched successfully", response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<SpecificationResponse>>> getSpecifications(

            @RequestParam(required = false) String title,

            @RequestParam(required = false) SpecificationStatus status,

            @RequestParam(required = false) Long orgId,

            @PageableDefault(
                    page = 0,
                    size = 10,
                    sort = "createdAt"
            )
            Pageable pageable) {

        log.info("Search Specifications Request received | title={} | status={} | orgId={} | page={} | size={}",
                title,
                status,
                orgId,
                pageable.getPageNumber(),
                pageable.getPageSize()
        );

        Page<SpecificationResponse> response =
                specificationService.getAllSpecifications(
                        title,
                        status,
                        orgId,
                        pageable
                );

        return ResponseEntity.ok(ApiResponse.ok("Specifications fetched successfully", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<SpecificationResponse>> updateSpecification(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateSpecificationRequest request) {

        log.info("Update Specification Request received | id={}", id);

        SpecificationResponse response =
                specificationService.updateSpecification(id, request);

        return ResponseEntity.ok(ApiResponse.ok("Specification updated successfully", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<ApiResponse<Void>> deleteSpecification(
            @PathVariable UUID id) {

        log.info("Delete Specification Request received | id={}", id);

        specificationService.deleteSpecification(id);

        return ResponseEntity.ok(ApiResponse.ok("Specification deleted successfully"));
    }

}
