package com.neuroforge.backend.project.service;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.project.dto.*;
import com.neuroforge.backend.project.entity.Milestone;
import com.neuroforge.backend.project.entity.Project;
import com.neuroforge.backend.project.repository.MilestoneRepository;
import com.neuroforge.backend.project.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MilestoneServiceImpl implements MilestoneService {

    private final MilestoneRepository milestoneRepository;
    private final ProjectRepository projectRepository;

    @Override
    @Transactional
    public ApiResponse<MilestoneDto> createMilestone(CreateMilestoneRequest request) {
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> AppException.notFound("Project not found"));

        Milestone milestone = Milestone.builder()
                .project(project)
                .name(request.getName())
                .description(request.getDescription())
                .targetDate(request.getTargetDate())
                .status(request.getStatus() != null ? request.getStatus() : "PENDING")
                .build();

        milestone = milestoneRepository.save(milestone);
        return ApiResponse.ok("Milestone created successfully", MilestoneDto.from(milestone));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<MilestoneDto>> getMilestonesByProject(Long projectId) {
        List<Milestone> milestones = milestoneRepository.findByProjectIdOrderByTargetDateAsc(projectId);
        List<MilestoneDto> milestoneDtos = milestones.stream()
                .map(MilestoneDto::from)
                .collect(Collectors.toList());
        return ApiResponse.ok("Milestones retrieved successfully", milestoneDtos);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<MilestoneDto> getMilestoneById(Long id) {
        Milestone milestone = milestoneRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Milestone not found"));
        return ApiResponse.ok("Milestone found", MilestoneDto.from(milestone));
    }

    @Override
    @Transactional
    public ApiResponse<MilestoneDto> updateMilestone(Long id, UpdateMilestoneRequest request) {
        Milestone milestone = milestoneRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Milestone not found"));

        if (request.getName() != null) milestone.setName(request.getName());
        if (request.getDescription() != null) milestone.setDescription(request.getDescription());
        if (request.getTargetDate() != null) milestone.setTargetDate(request.getTargetDate());
        if (request.getActualDate() != null) milestone.setActualDate(request.getActualDate());
        if (request.getStatus() != null) milestone.setStatus(request.getStatus());

        milestone = milestoneRepository.save(milestone);
        return ApiResponse.ok("Milestone updated successfully", MilestoneDto.from(milestone));
    }

    @Override
    @Transactional
    public ApiResponse<Void> deleteMilestone(Long id) {
        Milestone milestone = milestoneRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Milestone not found"));
        milestoneRepository.deleteById(id);
        return ApiResponse.ok("Milestone deleted successfully");
    }
}
