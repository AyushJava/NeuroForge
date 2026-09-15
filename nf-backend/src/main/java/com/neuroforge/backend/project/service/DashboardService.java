package com.neuroforge.backend.project.service;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.project.dto.DashboardDto;

public interface DashboardService {

    ApiResponse<DashboardDto> getDashboard(Long orgId);

}