package com.neuroforge.backend.ai.service;

import com.neuroforge.backend.ai.dto.ReleaseNotesRequest;
import com.neuroforge.backend.ai.dto.ReleaseNotesResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GroqServiceImpl implements GroqService {

    private static final Logger logger = LoggerFactory.getLogger(GroqServiceImpl.class);

    @Value("${groq.api.key}")
    private String apiKey;

    @Value("${groq.model}")
    private String model;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public ReleaseNotesResponse generateReleaseNotes(ReleaseNotesRequest request) {
        logger.info("Starting release notes generation with {} tasks", request.getTasks().size());
        logger.debug("API Key configured: {}", apiKey != null && !apiKey.isEmpty());
        logger.debug("Model: {}", model);

        if (apiKey == null || apiKey.isEmpty()) {
            logger.warn("Groq API key is not configured, using fallback release notes");
            String notes = generateFallbackReleaseNotes(request.getTasks());
            return ReleaseNotesResponse.builder()
                    .releaseNotes(notes)
                    .build();
        }

        String currentDate = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        String prompt = """
                Generate professional release notes for the following completed tasks.
                Use the actual current date: %s instead of placeholder text like [Current Date].

                Tasks:
                %s
                """.formatted(currentDate, String.join("\n", request.getTasks()));

        logger.debug("Prompt prepared for Groq API");

        try {
            String notes = callGroq(prompt);
            logger.info("Successfully generated release notes using Groq API");
            return ReleaseNotesResponse.builder()
                    .releaseNotes(notes)
                    .build();
        } catch (Exception e) {
            logger.error("Failed to generate release notes using Groq API: {}", e.getMessage(), e);
            logger.warn("Using fallback release notes due to API failure");
            String notes = generateFallbackReleaseNotes(request.getTasks());
            return ReleaseNotesResponse.builder()
                    .releaseNotes(notes)
                    .build();
        }
    }

    private String generateFallbackReleaseNotes(List<String> tasks) {
        StringBuilder notes = new StringBuilder();
        notes.append("Release Notes - ").append(LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)).append("\n\n");
        notes.append("Overview:\n");
        notes.append("This release includes ").append(tasks.size()).append(" completed task(s).\n\n");
        notes.append("Completed Tasks:\n");
        for (String task : tasks) {
            notes.append("- ").append(task).append("\n");
        }
        return notes.toString();
    }

    @Override
    public String chat(String prompt) {
        String url = "https://api.groq.com/openai/v1/chat/completions";

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);

        body.put("messages", List.of(
                Map.of(
                        "role", "user",
                        "content", prompt)));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                Map.class);

        List<?> choices = (List<?>) response.getBody().get("choices");

        Map<?, ?> choice = (Map<?, ?>) choices.get(0);

        Map<?, ?> message = (Map<?, ?>) choice.get("message");

        return message.get("content").toString();
    }

    private String callGroq(String prompt) {
        String url = "https://api.groq.com/openai/v1/chat/completions";

        logger.info("Calling Groq API with model: {}", model);
        logger.debug("API URL: {}", url);
        logger.debug("API Key prefix: {}", apiKey != null ? apiKey.substring(0, Math.min(10, apiKey.length())) + "..." : "null");

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);

        body.put("messages", List.of(
                Map.of(
                        "role", "user",
                        "content", prompt)));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        logger.debug("Request body: {}", body);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    Map.class);

            logger.info("Groq API response status: {}", response.getStatusCode());
            logger.debug("Response body: {}", response.getBody());

            Map choice = (Map) ((List<?>) response.getBody().get("choices")).get(0);
            Map message = (Map) choice.get("message");

            return message.get("content").toString();
        } catch (Exception e) {
            logger.error("Groq API call failed: {}", e.getMessage(), e);
            throw e;
        }
    }
}
