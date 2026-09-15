package com.neuroforge.backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Module 5: WebSocket Configuration for Real-Time Board Synchronization
 * Module 5: Real-Time Notifications
 * Module 9: CI/CD Pipeline Real-Time Updates
 *
 * Enables STOMP messaging over WebSocket for real-time task board updates,
 * notifications, and pipeline stage updates.
 *
 * Endpoints:
 * - /ws/board - WebSocket endpoint for client connections (Module 5)
 * - /pipeline-ws - WebSocket endpoint for pipeline updates (Module 9)
 * - /topic - Message broker for broadcasting updates
 * - /topic/notifications - Notification channel for real-time notifications
 * - /topic/pipeline/{runId} - Pipeline stage update channel (Module 9)
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketSecurityInterceptor webSocketSecurityInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable a simple memory-based message broker to send messages to clients
        // on destinations prefixed with "/topic"
        config.enableSimpleBroker("/topic");

        // Designate the "/app" prefix for messages bound for @MessageMapping methods
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Register the "/ws/board" endpoint, enabling SockJS fallback options
        // for browsers that don't support WebSocket (Module 5)
        registry.addEndpoint("/ws/board")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // Register the "/pipeline-ws" endpoint for pipeline stage updates (Module 9)
        registry.addEndpoint("/pipeline-ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Disable security interceptor for now to allow WebSocket connections
        // JWT authentication is handled at the endpoint level via SecurityConfig
        // registration.interceptors(webSocketSecurityInterceptor);
    }
}
