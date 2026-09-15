package com.neuroforge.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate Limiting Interceptor
 * 
 * Implements rate limiting for sensitive endpoints to prevent abuse.
 * Uses a simple in-memory sliding window approach.
 */
@Slf4j
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    // Store request counts per IP address
    private final Map<String, RateLimitInfo> rateLimitMap = new ConcurrentHashMap<>();
    
    // Rate limit configurations
    private static final int OTP_MAX_REQUESTS = 5; // Max 5 OTP requests per hour
    private static final int AI_MAX_REQUESTS = 20; // Max 20 AI requests per hour
    private static final long OTP_WINDOW_MINUTES = 60; // 1 hour window
    private static final long AI_WINDOW_MINUTES = 60; // 1 hour window
    
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String path = request.getRequestURI();
        String clientIp = getClientIp(request);
        
        // Check if this endpoint requires rate limiting
        if (isOtpEndpoint(path)) {
            if (!checkRateLimit(clientIp, path, OTP_MAX_REQUESTS, OTP_WINDOW_MINUTES)) {
                log.warn("Rate limit exceeded for OTP endpoint from IP: {}", clientIp);
                response.setStatus(429); // Too Many Requests
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"Too many OTP requests. Please try again later.\"}");
                return false;
            }
        }
        
        if (isAiEndpoint(path)) {
            if (!checkRateLimit(clientIp, path, AI_MAX_REQUESTS, AI_WINDOW_MINUTES)) {
                log.warn("Rate limit exceeded for AI endpoint from IP: {}", clientIp);
                response.setStatus(429); // Too Many Requests
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"Too many AI requests. Please try again later.\"}");
                return false;
            }
        }
        
        return true;
    }
    
    private boolean isOtpEndpoint(String path) {
        return path.contains("/auth/send-otp") || path.contains("/auth/forgot-password/send-otp");
    }
    
    private boolean isAiEndpoint(String path) {
        return path.contains("/specifications/generate") || 
               path.contains("/code-reviews") || 
               path.contains("/reviews/analyze");
    }
    
    private boolean checkRateLimit(String clientIp, String endpoint, int maxRequests, long windowMinutes) {
        String key = clientIp + ":" + endpoint;
        RateLimitInfo info = rateLimitMap.computeIfAbsent(key, k -> new RateLimitInfo());
        
        long currentTime = System.currentTimeMillis();
        long windowMillis = windowMinutes * 60 * 1000;
        
        // Clean up old entries
        if (currentTime - info.getResetTime() > windowMillis) {
            info.reset(currentTime, windowMillis);
        }
        
        // Check if limit exceeded
        if (info.getCount() >= maxRequests) {
            return false;
        }
        
        // Increment counter
        info.increment();
        log.debug("Rate limit check: IP={}, Endpoint={}, Count={}/{}", clientIp, endpoint, info.getCount(), maxRequests);
        
        return true;
    }
    
    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty()) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty()) {
            ip = request.getRemoteAddr();
        }
        // Handle multiple IPs in X-Forwarded-For
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip != null ? ip : "unknown";
    }
    
    /**
     * Inner class to track rate limit information per endpoint per IP
     */
    private static class RateLimitInfo {
        private final AtomicInteger count = new AtomicInteger(0);
        private long resetTime;
        
        public RateLimitInfo() {
            this.resetTime = System.currentTimeMillis();
        }
        
        public int getCount() {
            return count.get();
        }
        
        public long getResetTime() {
            return resetTime;
        }
        
        public void increment() {
            count.incrementAndGet();
        }
        
        public void reset(long currentTime, long windowMillis) {
            count.set(0);
            resetTime = currentTime + windowMillis;
        }
    }
}
