package com.neuroforge.backend.ai.service;

import com.neuroforge.backend.ai.dto.AnalyzeReviewRequest;
import com.neuroforge.backend.ai.dto.AnalyzeReviewResponse;
import com.neuroforge.backend.ai.dto.CreateCodeReviewRequest;
import com.neuroforge.backend.ai.dto.ReviewIssueResponse;
import com.neuroforge.backend.ai.enums.CodeReviewStatus;
import com.neuroforge.backend.ai.enums.ReviewSource;
import com.neuroforge.backend.ai.integration.gemini.GeminiConstants;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.integration.entity.CommitCache;
import com.neuroforge.backend.integration.repository.CommitCacheRepository;
import com.neuroforge.backend.mongodb.document.ReviewDocument;
import com.neuroforge.backend.mongodb.document.ReviewIssue;
import com.neuroforge.backend.mongodb.repository.ReviewDocumentRepository;
import com.neuroforge.backend.project.entity.CodeReview;
import com.neuroforge.backend.project.entity.Task;
import com.neuroforge.backend.project.repository.CodeReviewRepository;
import com.neuroforge.backend.project.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReviewAnalysisService {

    private final PromptBuilderService promptBuilderService;
    private final GeminiService codeReviewGeminiService;
    private final ReviewResponseParser reviewResponseParser;
    private final CodeReviewService codeReviewService;
    private final CodeReviewRepository codeReviewRepository;
    private final ReviewDocumentRepository reviewDocumentRepository;
    private final CommitCacheRepository commitCacheRepository;
    private final CodeChunkingService codeChunkingService;
    private final TaskRepository taskRepository;

    public ReviewAnalysisService(
            PromptBuilderService promptBuilderService,
            @Qualifier("codeReviewGeminiService") GeminiService codeReviewGeminiService,
            ReviewResponseParser reviewResponseParser,
            CodeReviewService codeReviewService,
            CodeReviewRepository codeReviewRepository,
            ReviewDocumentRepository reviewDocumentRepository,
            CommitCacheRepository commitCacheRepository,
            CodeChunkingService codeChunkingService,
            TaskRepository taskRepository) {
        this.promptBuilderService = promptBuilderService;
        this.codeReviewGeminiService = codeReviewGeminiService;
        this.reviewResponseParser = reviewResponseParser;
        this.codeReviewService = codeReviewService;
        this.codeReviewRepository = codeReviewRepository;
        this.reviewDocumentRepository = reviewDocumentRepository;
        this.commitCacheRepository = commitCacheRepository;
        this.codeChunkingService = codeChunkingService;
        this.taskRepository = taskRepository;
    }

    @Transactional
    public AnalyzeReviewResponse analyzeCode(AnalyzeReviewRequest request) {
        String sourceCode = request.getSourceCode();
        String sourceReference = null;

        // Module 7 integration: fetch commit code if source is COMMIT
        if (request.getReviewSource() == ReviewSource.COMMIT && request.getCommitSha() != null) {
            CommitCache commit = commitCacheRepository.findByCommitSha(request.getCommitSha())
                    .orElseThrow(() -> AppException.notFound("Commit not found with SHA: " + request.getCommitSha()));
            
            // In a real implementation, you would fetch the actual code from the commit
            // For now, we'll use the provided sourceCode as a placeholder
            sourceReference = commit.getCommitSha();
        }

        CreateCodeReviewRequest createRequest = CreateCodeReviewRequest.builder()
                .taskId(request.getTaskId())
                .requestedBy(request.getRequestedBy())
                .reviewSource(request.getReviewSource())
                .sourceReference(sourceReference)
                .build();

        CodeReview codeReview = codeReviewService.createCodeReviewEntity(createRequest);

        codeReview.setStatus(CodeReviewStatus.IN_PROGRESS);
        codeReview = codeReviewRepository.save(codeReview);

        // Frontend now handles chunking, backend processes single chunk
        String prompt = promptBuilderService.buildReviewPrompt(request.getLanguage(), sourceCode);
        String jsonResponse = codeReviewGeminiService.analyzeCode(prompt);
        AnalyzeReviewResponse parsedResponse = reviewResponseParser.parse(jsonResponse);

        // Convert 0-100 score to 1-10 range as per blueprint
        Integer normalizedScore = normalizeScore(parsedResponse.getOverallScore());
        codeReview.setOverallScore(normalizedScore);
        codeReview.setSummary(parsedResponse.getSummary());
        codeReview.setStatus(CodeReviewStatus.COMPLETED);
        codeReview = codeReviewRepository.save(codeReview);

        List<ReviewIssue> issues = null;
        if (parsedResponse.getIssues() != null) {
            issues = parsedResponse.getIssues().stream()
                    .map(issue -> ReviewIssue.builder()
                            .line(issue.getLine())
                            .severity(issue.getSeverity())
                            .category(issue.getCategory())
                            .description(issue.getDescription())
                            .suggestion(issue.getSuggestion())
                            .build())
                    .collect(Collectors.toList());
        }

        // Get organization from task for analytics filtering
        Task task = taskRepository.findById(request.getTaskId()).orElse(null);
        Long organizationId = task != null && task.getProject() != null && task.getProject().getOrganization() != null
                ? task.getProject().getOrganization().getId()
                : null;

        ReviewDocument reviewDocument = ReviewDocument.builder()
                .reviewId(codeReview.getId().toString())
                .taskId(request.getTaskId().toString())
                .model(GeminiConstants.MODEL)
                .language(request.getLanguage())
                .sourceCode(request.getSourceCode())
                .overallScore(parsedResponse.getOverallScore())
                .summary(parsedResponse.getSummary())
                .issues(issues)
                .createdAt(LocalDateTime.now())
                .organizationId(organizationId)
                .build();

        reviewDocumentRepository.save(reviewDocument);

        parsedResponse.setReviewId(codeReview.getId());
        parsedResponse.setOverallScore(normalizedScore);

        return parsedResponse;
    }

    private Integer normalizeScore(Integer score) {
        if (score == null) {
            return 5; // Default to middle of 1-10 range
        }
        // Convert 0-100 to 1-10 range
        int normalized = (int) Math.ceil(score / 10.0);
        return Math.max(1, Math.min(10, normalized));
    }

    private AnalyzeReviewResponse processCodeChunks(List<String> chunks, String language) {
        List<ReviewIssueResponse> allIssues = new ArrayList<>();
        int totalScore = 0;
        int chunkCount = chunks.size();
        StringBuilder combinedSummary = new StringBuilder();

        for (int i = 0; i < chunks.size(); i++) {
            String chunk = chunks.get(i);
            String prompt = promptBuilderService.buildReviewPrompt(language, chunk);
            String jsonResponse = codeReviewGeminiService.analyzeCode(prompt);
            AnalyzeReviewResponse chunkResponse = reviewResponseParser.parse(jsonResponse);

            // Aggregate issues
            if (chunkResponse.getIssues() != null) {
                allIssues.addAll(chunkResponse.getIssues());
            }

            // Aggregate scores (average)
            if (chunkResponse.getOverallScore() != null) {
                totalScore += chunkResponse.getOverallScore();
            }

            // Combine summaries
            if (chunkResponse.getSummary() != null) {
                combinedSummary.append("Chunk ").append(i + 1).append(": ").append(chunkResponse.getSummary()).append("\n");
            }
        }

        // Calculate average score
        int averageScore = chunkCount > 0 ? totalScore / chunkCount : 5;

        return AnalyzeReviewResponse.builder()
                .reviewId(null)
                .overallScore(averageScore)
                .summary(combinedSummary.toString())
                .issues(allIssues)
                .build();
    }
}
