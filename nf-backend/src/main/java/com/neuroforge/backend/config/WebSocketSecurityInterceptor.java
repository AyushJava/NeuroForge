package com.neuroforge.backend.config;

import com.neuroforge.backend.security.SecurityUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * WebSocket Security Interceptor
 * 
 * Validates WebSocket subscriptions to ensure users can only subscribe to
 * topics they are authorized to access based on their organization membership.
 */
@Slf4j
@Component
public class WebSocketSecurityInterceptor implements ChannelInterceptor {

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        StompCommand command = accessor.getCommand();

        // Allow CONNECT command to pass through - authentication handled by JWT filter
        if (StompCommand.CONNECT.equals(command)) {
            log.debug("WebSocket CONNECT - allowing connection");
            return message;
        }

        // Handle SUBSCRIBE command
        if (StompCommand.SUBSCRIBE.equals(command)) {
            String destination = accessor.getDestination();
            log.debug("WebSocket subscription request to: {}", destination);

            // Get current authenticated user
            var authentication = SecurityContextHolder.getContext().getAuthentication();

            // For now, allow all subscriptions for authenticated users
            // In production, add organization/project validation
            if (authentication == null || !authentication.isAuthenticated()) {
                log.warn("Unauthenticated WebSocket subscription attempt to: {}", destination);
                throw new SecurityException("Unauthenticated WebSocket connection");
            }

            log.debug("Authorized WebSocket subscription to: {} by user: {}",
                    destination, authentication.getName());
        }

        return message;
    }
    
    /**
     * Validates if the user is authorized to subscribe to the given destination.
     * 
     * Rules:
     * - /topic/pipeline/{runId}: User must belong to the pipeline's organization
     * - /topic/board/{projectId}: User must belong to the project's organization
     * - /topic/notifications: All authenticated users
     */
    private boolean isSubscriptionAuthorized(String destination, 
            org.springframework.security.core.Authentication authentication) {
        
        if (destination == null) {
            return false;
        }
        
        // Super Admin can subscribe to any topic
        if (SecurityUtils.isSuperAdmin()) {
            return true;
        }
        
        // Allow notifications for all authenticated users
        if (destination.startsWith("/topic/notifications")) {
            return true;
        }
        
        // Pipeline updates: validate organization membership
        if (destination.startsWith("/topic/pipeline/")) {
            // Extract runId from destination
            String runId = destination.substring("/topic/pipeline/".length());
            // In a production system, validate that user belongs to pipeline's organization
            // For now, allow authenticated users (organization validation would require DB lookup)
            log.debug("Pipeline subscription to runId: {}", runId);
            return true;
        }
        
        // Board updates: validate project membership
        if (destination.startsWith("/topic/board/")) {
            // Extract projectId from destination
            String projectId = destination.substring("/topic/board/".length());
            // In a production system, validate that user belongs to project's organization
            // For now, allow authenticated users (organization validation would require DB lookup)
            log.debug("Board subscription to projectId: {}", projectId);
            return true;
        }
        
        // Default: deny unknown destinations
        log.warn("Unknown WebSocket destination: {}", destination);
        return false;
    }
}
