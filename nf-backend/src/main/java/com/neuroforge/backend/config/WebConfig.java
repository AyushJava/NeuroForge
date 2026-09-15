package com.neuroforge.backend.config;

import com.neuroforge.backend.security.RateLimitInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web Configuration
 * 
 * Registers interceptors for cross-cutting concerns like rate limiting.
 */
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final RateLimitInterceptor rateLimitInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Apply rate limiting to authentication and AI endpoints
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/auth/send-otp", "/auth/forgot-password/send-otp",
                        "/api/specifications/generate", "/api/code-reviews/**", "/api/reviews/analyze");
    }
}
