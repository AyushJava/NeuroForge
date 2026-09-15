package com.neuroforge.backend.pipeline.service;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.pipeline.dto.*;
import com.neuroforge.backend.pipeline.entity.Pipeline;
import java.util.List;
import java.util.Optional;

public interface PipelineService {

    ApiResponse<PipelineRunResponse> runPipeline(RunPipelineRequest request);

    ApiResponse<List<PipelineStageResponse>> getPipelineStages(Long runId);

    ApiResponse<ReleaseResponse> createRelease(CreateReleaseRequest request);

    ApiResponse<ReleaseNoteResponse> generateReleaseNotes(Long releaseId);

    ApiResponse<List<PipelineHistoryResponse>> getPipelineHistory(Long orgId);

    ApiResponse<ReleaseNoteResponse> updateReleaseNotes(Long releaseId, UpdateReleaseNotesRequest request);

    ApiResponse<PipelineRunResponse> retryPipeline(Long runId);

    ApiResponse<String> approveProduction(Long runId);

    ApiResponse<PipelineMetricsResponse> getPipelineMetrics(Long orgId);

    ApiResponse<String> cancelPipeline(Long runId);

    ApiResponse<List<ReleaseHistoryResponse>> getReleaseHistory(Long orgId);

    ApiResponse<ReleaseResponse> publishRelease(Long releaseId);

    ApiResponse<Pipeline> getActivePipeline(Long orgId);
}
