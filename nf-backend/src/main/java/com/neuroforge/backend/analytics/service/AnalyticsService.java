package com.neuroforge.backend.analytics.service;

import com.neuroforge.backend.analytics.dto.AnalyticsDashboardResponse;
import com.neuroforge.backend.analytics.dto.BurndownResponse;
import com.neuroforge.backend.analytics.dto.ChangeFailureRateResponse;
import com.neuroforge.backend.analytics.dto.CycleTimeResponse;
import com.neuroforge.backend.analytics.dto.DeveloperAnalyticsResponse;
import com.neuroforge.backend.analytics.dto.DeploymentFrequencyResponse;
import com.neuroforge.backend.analytics.dto.IssueTrendResponse;
import com.neuroforge.backend.analytics.dto.SprintAnalyticsResponse;
import com.neuroforge.backend.analytics.dto.TaskDistributionResponse;
import com.neuroforge.backend.analytics.dto.VelocityResponse;

public interface AnalyticsService {

    AnalyticsDashboardResponse getDashboard(Long orgId);

    SprintAnalyticsResponse getSprintAnalytics(Long sprintId);

    DeveloperAnalyticsResponse getDeveloperAnalytics(Long userId);

    TaskDistributionResponse getTaskDistribution(Long orgId);

    VelocityResponse getVelocity(Long orgId);

    BurndownResponse getBurndown(Long orgId);

    IssueTrendResponse getIssueTrend(Long orgId);

    CycleTimeResponse getCycleTime();

    DeploymentFrequencyResponse getDeploymentFrequency();

    ChangeFailureRateResponse getChangeFailureRate();

    byte[] generateDashboardReportPdf();
}
