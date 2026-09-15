package com.neuroforge.backend.analytics.controller;

import com.neuroforge.backend.analytics.dto.AnalyticsDashboardResponse;
import com.neuroforge.backend.analytics.dto.BurndownResponse;
import com.neuroforge.backend.analytics.dto.ChangeFailureRateResponse;
import com.neuroforge.backend.analytics.dto.CycleTimeResponse;
import com.neuroforge.backend.analytics.dto.DeveloperAnalyticsResponse;
import com.neuroforge.backend.analytics.dto.DeploymentFrequencyResponse;
import com.neuroforge.backend.analytics.dto.IssueTrendResponse;
import com.neuroforge.backend.analytics.dto.MetricsSnapshotResponse;
import com.neuroforge.backend.analytics.dto.PortfolioHealthResponse;
import com.neuroforge.backend.analytics.dto.SprintAnalyticsResponse;
import com.neuroforge.backend.analytics.dto.SprintHealthSummaryResponse;
import com.neuroforge.backend.analytics.dto.TaskDistributionResponse;
import com.neuroforge.backend.analytics.dto.VelocityHistoryResponse;
import com.neuroforge.backend.analytics.dto.VelocityResponse;
import com.neuroforge.backend.analytics.service.AnalyticsService;
import com.neuroforge.backend.analytics.service.MetricsSnapshotService;
import com.neuroforge.backend.analytics.service.PortfolioHealthService;
import com.neuroforge.backend.analytics.service.SprintHealthSummaryService;
import com.neuroforge.backend.analytics.service.SprintReportPdfService;
import com.neuroforge.backend.analytics.service.VelocityHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final MetricsSnapshotService metricsSnapshotService;
    private final VelocityHistoryService velocityHistoryService;
    private final SprintHealthSummaryService sprintHealthSummaryService;
    private final SprintReportPdfService sprintReportPdfService;
    private final PortfolioHealthService portfolioHealthService;

    @GetMapping("/dashboard")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnalyticsDashboardResponse> getDashboard(@RequestParam(required = false) Long orgId) {
        return ResponseEntity.ok(analyticsService.getDashboard(orgId));
    }

    @GetMapping("/portfolio/organization/{orgId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PortfolioHealthResponse> getPortfolioHealth(@PathVariable Long orgId) {
        return ResponseEntity.ok(portfolioHealthService.getPortfolioHealth(orgId));
    }

    @GetMapping("/sprint/{sprintId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_QA', 'ROLE_CLIENT')")
    public ResponseEntity<SprintAnalyticsResponse> getSprintAnalytics(@PathVariable Long sprintId) {
        return ResponseEntity.ok(analyticsService.getSprintAnalytics(sprintId));
    }

    @GetMapping("/sprint/{sprintId}/health-summary")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_QA', 'ROLE_CLIENT')")
    public ResponseEntity<SprintHealthSummaryResponse> getSprintHealthSummary(@PathVariable Long sprintId) {
        return ResponseEntity.ok(sprintHealthSummaryService.generateSummary(sprintId));
    }

    @GetMapping(value = "/reports/sprint/{sprintId}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_QA', 'ROLE_CLIENT')")
    public ResponseEntity<byte[]> getSprintReportPdf(@PathVariable Long sprintId) {
        byte[] pdfBytes = sprintReportPdfService.generateSprintReportPdf(sprintId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("sprint-analytics-" + sprintId + ".pdf")
                .build());
        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    @GetMapping("/developer/{userId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER')")
    public ResponseEntity<DeveloperAnalyticsResponse> getDeveloperAnalytics(@PathVariable Long userId) {
        return ResponseEntity.ok(analyticsService.getDeveloperAnalytics(userId));
    }

    @GetMapping("/task-distribution")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_QA', 'ROLE_CLIENT')")
    public ResponseEntity<TaskDistributionResponse> getTaskDistribution(@RequestParam(required = false) Long orgId) {
        return ResponseEntity.ok(analyticsService.getTaskDistribution(orgId));
    }

    @GetMapping("/velocity")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<VelocityResponse> getVelocity(@RequestParam(required = false) Long orgId) {
        return ResponseEntity.ok(analyticsService.getVelocity(orgId));
    }

    @GetMapping("/burndown")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BurndownResponse> getBurndown(@RequestParam(required = false) Long orgId) {
        return ResponseEntity.ok(analyticsService.getBurndown(orgId));
    }

    @GetMapping("/issue-trend")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<IssueTrendResponse> getIssueTrend(@RequestParam(required = false) Long orgId) {
        return ResponseEntity.ok(analyticsService.getIssueTrend(orgId));
    }

    @GetMapping("/cycle-time")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_QA', 'ROLE_CLIENT')")
    public ResponseEntity<CycleTimeResponse> getCycleTime() {
        return ResponseEntity.ok(analyticsService.getCycleTime());
    }

    @GetMapping("/deployment-frequency")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_QA', 'ROLE_CLIENT')")
    public ResponseEntity<DeploymentFrequencyResponse> getDeploymentFrequency() {
        return ResponseEntity.ok(analyticsService.getDeploymentFrequency());
    }

    @GetMapping("/change-failure-rate")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_QA', 'ROLE_CLIENT')")
    public ResponseEntity<ChangeFailureRateResponse> getChangeFailureRate() {
        return ResponseEntity.ok(analyticsService.getChangeFailureRate());
    }

    @GetMapping("/snapshots/{date}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<MetricsSnapshotResponse> getSnapshot(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(metricsSnapshotService.getSnapshot(date));
    }

    @GetMapping("/snapshots")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<List<MetricsSnapshotResponse>> getSnapshots(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(metricsSnapshotService.getSnapshots(startDate, endDate));
    }

    @GetMapping("/velocity-history")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_QA', 'ROLE_CLIENT')")
    public ResponseEntity<VelocityHistoryResponse> getVelocityHistory() {
        return ResponseEntity.ok(velocityHistoryService.getVelocityHistory());
    }

    @PostMapping("/aggregate")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ORG_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<String> triggerAggregation() {
        velocityHistoryService.refreshVelocityHistory();
        return ResponseEntity.ok("Analytics aggregation triggered successfully");
    }

    @GetMapping(value = "/reports/dashboard/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> getDashboardReportPdf() {
        byte[] pdfBytes = analyticsService.generateDashboardReportPdf();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("analytics-dashboard-" + LocalDate.now() + ".pdf")
                .build());
        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }
}
