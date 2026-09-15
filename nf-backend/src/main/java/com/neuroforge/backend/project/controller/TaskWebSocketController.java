package com.neuroforge.backend.project.controller;

import com.neuroforge.backend.project.dto.TaskBoardEvent;
import com.neuroforge.backend.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * Module 5: Task WebSocket Controller
 * 
 * Handles real-time task board updates via WebSocket.
 * When a task status changes, broadcasts the event to all subscribed clients.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class TaskWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Handle task status update events and broadcast to project board subscribers.
     * 
     * @param event Task board event containing task ID, project ID, status change, and user info
     */
    @MessageMapping("/task/status")
    public void handleTaskStatusUpdate(@Payload TaskBoardEvent event) {
        log.info("Received task status update event: taskId={}, projectId={}, status={} -> {}, changedBy={}",
                event.getTaskId(), event.getProjectId(), event.getPreviousStatus(), event.getNewStatus(), event.getChangedBy());

        // Broadcast to all subscribers of the project's board topic
        String destination = "/topic/project/" + event.getProjectId() + "/board";
        messagingTemplate.convertAndSend(destination, event);
        
        log.info("Broadcasted task status update to {}", destination);
    }
}
