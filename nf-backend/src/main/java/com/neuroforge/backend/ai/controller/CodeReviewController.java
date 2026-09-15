package com.neuroforge.backend.ai.controller;

import com.neuroforge.backend.ai.dto.CodeReviewResponse;
import com.neuroforge.backend.ai.dto.CreateCodeReviewRequest;
import com.neuroforge.backend.ai.dto.QualityTrendResponse;
import com.neuroforge.backend.ai.dto.UpdateCodeReviewStatusRequest;
import com.neuroforge.backend.ai.enums.CodeReviewStatus;
import com.neuroforge.backend.ai.service.CodeReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/code-reviews")
@RequiredArgsConstructor
public class CodeReviewController {

    private final CodeReviewService codeReviewService;

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_DEVELOPER')")
    public ResponseEntity<CodeReviewResponse> createCodeReview(@Valid @RequestBody CreateCodeReviewRequest request) {
        CodeReviewResponse response = codeReviewService.createCodeReview(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_DEVELOPER', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<List<CodeReviewResponse>> getAllCodeReviews() {
        List<CodeReviewResponse> reviews = codeReviewService.getAllCodeReviews();
        return ResponseEntity.ok(reviews);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_DEVELOPER', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<CodeReviewResponse> getCodeReviewById(@PathVariable Long id) {
        CodeReviewResponse review = codeReviewService.getCodeReviewById(id);
        return ResponseEntity.ok(review);
    }

    @GetMapping("/task/{taskId}")
    @PreAuthorize("hasAnyAuthority('ROLE_DEVELOPER', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<List<CodeReviewResponse>> getCodeReviewsByTask(@PathVariable Long taskId) {
        List<CodeReviewResponse> reviews = codeReviewService.getCodeReviewsByTask(taskId);
        return ResponseEntity.ok(reviews);
    }

    @GetMapping("/status/{status}")
    @PreAuthorize("hasAnyAuthority('ROLE_DEVELOPER', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<List<CodeReviewResponse>> getCodeReviewsByStatus(@PathVariable CodeReviewStatus status) {
        List<CodeReviewResponse> reviews = codeReviewService.getCodeReviewsByStatus(status);
        return ResponseEntity.ok(reviews);
    }

    @GetMapping("/task/{taskId}/latest")
    @PreAuthorize("hasAnyAuthority('ROLE_DEVELOPER', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<CodeReviewResponse> getLatestReviewForTask(@PathVariable Long taskId) {
        CodeReviewResponse review = codeReviewService.getLatestReviewForTask(taskId);
        return ResponseEntity.ok(review);
    }

    @PatchMapping("/{reviewId}/status")
    @PreAuthorize("hasAnyAuthority('ROLE_PROJECT_MANAGER')")
    public ResponseEntity<CodeReviewResponse> updateReviewStatus(
            @PathVariable Long reviewId,
            @Valid @RequestBody UpdateCodeReviewStatusRequest request) {
        CodeReviewResponse response = codeReviewService.updateReviewStatus(reviewId, request);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{reviewId}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_PROJECT_MANAGER')")
    public ResponseEntity<CodeReviewResponse> approveReview(@PathVariable Long reviewId) {
        CodeReviewResponse response = codeReviewService.approveReview(reviewId);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{reviewId}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_PROJECT_MANAGER')")
    public ResponseEntity<CodeReviewResponse> rejectReview(@PathVariable Long reviewId) {
        CodeReviewResponse response = codeReviewService.rejectReview(reviewId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{reviewId}")
    @PreAuthorize("hasAnyAuthority('ROLE_DEVELOPER', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<Void> deleteCodeReview(@PathVariable Long reviewId) {
        codeReviewService.deleteCodeReview(reviewId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/trends/developer/{developerId}")
    @PreAuthorize("hasAnyAuthority('ROLE_PROJECT_MANAGER')")
    public ResponseEntity<QualityTrendResponse> getQualityTrendsForDeveloper(@PathVariable Long developerId) {
        QualityTrendResponse trends = codeReviewService.getQualityTrendsForDeveloper(developerId);
        return ResponseEntity.ok(trends);
    }

    @GetMapping("/trends/all")
    @PreAuthorize("hasAnyAuthority('ROLE_PROJECT_MANAGER')")
    public ResponseEntity<List<QualityTrendResponse>> getQualityTrendsForAllDevelopers(@RequestParam(required = false) Long orgId) {
        List<QualityTrendResponse> trends = codeReviewService.getQualityTrendsForAllDevelopers(orgId);
        return ResponseEntity.ok(trends);
    }
}
