package com.neuroforge.backend.ai.service;

import com.neuroforge.backend.ai.dto.CodeReviewResponse;
import com.neuroforge.backend.ai.dto.CreateCodeReviewRequest;
import com.neuroforge.backend.ai.dto.QualityTrendResponse;
import com.neuroforge.backend.ai.dto.UpdateCodeReviewStatusRequest;
import com.neuroforge.backend.ai.enums.CodeReviewStatus;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.project.entity.CodeReview;
import com.neuroforge.backend.project.entity.Task;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.project.repository.CodeReviewRepository;
import com.neuroforge.backend.project.repository.TaskRepository;
import com.neuroforge.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CodeReviewService {

    private final CodeReviewRepository codeReviewRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    @Transactional
    public CodeReviewResponse createCodeReview(CreateCodeReviewRequest request) {
        CodeReview saved = createCodeReviewEntity(request);
        return mapToResponse(saved);
    }

    @Transactional
    protected CodeReview createCodeReviewEntity(CreateCodeReviewRequest request) {
        Task task = taskRepository.findById(request.getTaskId())
                .orElseThrow(() -> AppException.notFound("Task not found with ID: " + request.getTaskId()));

        User requestedBy = userRepository.findById(request.getRequestedBy())
                .orElseThrow(() -> AppException.notFound("User not found with ID: " + request.getRequestedBy()));

        CodeReview codeReview = CodeReview.builder()
                .task(task)
                .requestedBy(requestedBy)
                .status(CodeReviewStatus.REQUESTED)
                .reviewSource(request.getReviewSource())
                .sourceReference(request.getSourceReference())
                .overallScore(null)
                .summary(null)
                .approvedBy(null)
                .build();

        return codeReviewRepository.save(codeReview);
    }

    @Transactional(readOnly = true)
    public List<CodeReviewResponse> getAllCodeReviews() {
        return codeReviewRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CodeReviewResponse getCodeReviewById(Long id) {
        CodeReview review = codeReviewRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Code review not found with ID: " + id));
        return mapToResponse(review);
    }

    @Transactional(readOnly = true)
    public List<CodeReviewResponse> getCodeReviewsByTask(Long taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw AppException.notFound("Task not found with ID: " + taskId);
        }
        return codeReviewRepository.findByTaskId(taskId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CodeReviewResponse> getCodeReviewsByStatus(CodeReviewStatus status) {
        return codeReviewRepository.findByStatus(status).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CodeReviewResponse getLatestReviewForTask(Long taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw AppException.notFound("Task not found with ID: " + taskId);
        }
        CodeReview review = codeReviewRepository.findTopByTaskIdOrderByCreatedAtDesc(taskId)
                .orElseThrow(() -> AppException.notFound("No code review found for task with ID: " + taskId));
        return mapToResponse(review);
    }

    @Transactional
    public CodeReviewResponse updateReviewStatus(Long reviewId, UpdateCodeReviewStatusRequest request) {
        CodeReview review = codeReviewRepository.findById(reviewId)
                .orElseThrow(() -> AppException.notFound("Code review not found with ID: " + reviewId));

        CodeReviewStatus currentStatus = review.getStatus();
        CodeReviewStatus newStatus = request.getStatus();

        if (!isValidStatusTransition(currentStatus, newStatus)) {
            throw AppException.badRequest(
                    "Invalid status transition from " + currentStatus + " to " + newStatus);
        }

        review.setStatus(newStatus);
        if (request.getOverallScore() != null) {
            review.setOverallScore(request.getOverallScore());
        }
        if (request.getSummary() != null) {
            review.setSummary(request.getSummary());
        }

        CodeReview updated = codeReviewRepository.save(review);
        return mapToResponse(updated);
    }

    @Transactional
    public CodeReviewResponse approveReview(Long reviewId) {
        CodeReview review = codeReviewRepository.findById(reviewId)
                .orElseThrow(() -> AppException.notFound("Code review not found with ID: " + reviewId));

        if (review.getStatus() != CodeReviewStatus.COMPLETED) {
            throw AppException.badRequest(
                    "Invalid status transition from " + review.getStatus() + " to " + CodeReviewStatus.ACCEPTED);
        }

        review.setStatus(CodeReviewStatus.ACCEPTED);
        CodeReview updated = codeReviewRepository.save(review);
        return mapToResponse(updated);
    }

    @Transactional
    public CodeReviewResponse rejectReview(Long reviewId) {
        CodeReview review = codeReviewRepository.findById(reviewId)
                .orElseThrow(() -> AppException.notFound("Code review not found with ID: " + reviewId));

        if (review.getStatus() != CodeReviewStatus.COMPLETED) {
            throw AppException.badRequest(
                    "Invalid status transition from " + review.getStatus() + " to " + CodeReviewStatus.REJECTED);
        }

        review.setStatus(CodeReviewStatus.REJECTED);
        CodeReview updated = codeReviewRepository.save(review);
        return mapToResponse(updated);
    }

    @Transactional
    public void deleteCodeReview(Long reviewId) {
        CodeReview review = codeReviewRepository.findById(reviewId)
                .orElseThrow(() -> AppException.notFound("Code review not found with ID: " + reviewId));
        codeReviewRepository.delete(review);
    }

    @Transactional(readOnly = true)
    public QualityTrendResponse getQualityTrendsForDeveloper(Long developerId) {
        User developer = userRepository.findById(developerId)
                .orElseThrow(() -> AppException.notFound("User not found with ID: " + developerId));

        List<CodeReview> reviews = codeReviewRepository.findAll().stream()
                .filter(review -> review.getRequestedBy() != null && review.getRequestedBy().getId().equals(developerId))
                .collect(Collectors.toList());

        if (reviews.isEmpty()) {
            return QualityTrendResponse.builder()
                    .developerId(developerId)
                    .developerName(developer.getUsername())
                    .averageScore(0.0)
                    .totalReviews(0)
                    .acceptedReviews(0)
                    .rejectedReviews(0)
                    .trendData(List.of())
                    .build();
        }

        // Calculate statistics
        double averageScore = reviews.stream()
                .filter(review -> review.getOverallScore() != null)
                .mapToInt(CodeReview::getOverallScore)
                .average()
                .orElse(0.0);

        long acceptedCount = reviews.stream()
                .filter(review -> review.getStatus() == CodeReviewStatus.ACCEPTED)
                .count();

        long rejectedCount = reviews.stream()
                .filter(review -> review.getStatus() == CodeReviewStatus.REJECTED)
                .count();

        // Build trend data points
        List<QualityTrendResponse.TrendDataPoint> trendData = reviews.stream()
                .sorted((r1, r2) -> r1.getCreatedAt().compareTo(r2.getCreatedAt()))
                .map(review -> QualityTrendResponse.TrendDataPoint.builder()
                        .date(review.getCreatedAt())
                        .score(review.getOverallScore())
                        .status(review.getStatus().name())
                        .build())
                .collect(Collectors.toList());

        return QualityTrendResponse.builder()
                .developerId(developerId)
                .developerName(developer.getUsername())
                .averageScore(averageScore)
                .totalReviews(reviews.size())
                .acceptedReviews((int) acceptedCount)
                .rejectedReviews((int) rejectedCount)
                .trendData(trendData)
                .build();
    }

    @Transactional(readOnly = true)
    public List<QualityTrendResponse> getQualityTrendsForAllDevelopers(Long organizationId) {
        Map<Long, List<CodeReview>> reviewsByDeveloper = codeReviewRepository.findAll().stream()
                .filter(review -> review.getRequestedBy() != null)
                .filter(review -> review.getRequestedBy().getRole() != null)
                .filter(review -> review.getRequestedBy().getRole().equals("ROLE_DEVELOPER"))
                .filter(review -> organizationId == null || 
                    (review.getTask() != null && 
                     review.getTask().getProject() != null && 
                     review.getTask().getProject().getOrganization() != null && 
                     review.getTask().getProject().getOrganization().getId().equals(organizationId)))
                .collect(Collectors.groupingBy(review -> review.getRequestedBy().getId()));

        return reviewsByDeveloper.entrySet().stream()
                .map(entry -> getQualityTrendsForDeveloper(entry.getKey()))
                .collect(Collectors.toList());
    }

    private boolean isValidStatusTransition(CodeReviewStatus currentStatus, CodeReviewStatus newStatus) {
        if (currentStatus == null || newStatus == null) {
            return false;
        }
        return (currentStatus == CodeReviewStatus.REQUESTED && newStatus == CodeReviewStatus.IN_PROGRESS)
                || (currentStatus == CodeReviewStatus.IN_PROGRESS && newStatus == CodeReviewStatus.COMPLETED)
                || (currentStatus == CodeReviewStatus.COMPLETED && newStatus == CodeReviewStatus.ACCEPTED)
                || (currentStatus == CodeReviewStatus.COMPLETED && newStatus == CodeReviewStatus.REJECTED);
    }

    private CodeReviewResponse mapToResponse(CodeReview review) {
        return CodeReviewResponse.builder()
                .id(review.getId())
                .taskId(review.getTask() != null ? review.getTask().getId() : null)
                .requestedBy(review.getRequestedBy() != null ? review.getRequestedBy().getId() : null)
                .approvedBy(review.getApprovedBy() != null ? review.getApprovedBy().getId() : null)
                .status(review.getStatus())
                .reviewSource(review.getReviewSource())
                .overallScore(review.getOverallScore())
                .summary(review.getSummary())
                .sourceReference(review.getSourceReference())
                .createdAt(review.getCreatedAt())
                .createdBy(null)
                .updatedAt(review.getUpdatedAt())
                .updatedBy(null)
                .build();
    }
}
