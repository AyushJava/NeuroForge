package com.neuroforge.backend.project.service;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.project.dto.*;

import java.util.List;

public interface MilestoneService {

    ApiResponse<MilestoneDto> createMilestone(CreateMilestoneRequest request);

    ApiResponse<List<MilestoneDto>> getMilestonesByProject(Long projectId);

    ApiResponse<MilestoneDto> getMilestoneById(Long id);

    ApiResponse<MilestoneDto> updateMilestone(Long id, UpdateMilestoneRequest request);

    ApiResponse<Void> deleteMilestone(Long id);
}
