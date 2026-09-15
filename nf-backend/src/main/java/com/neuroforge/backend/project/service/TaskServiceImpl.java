package com.neuroforge.backend.project.service;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.project.dto.*;
import com.neuroforge.backend.project.dto.TaskBoardEvent;
import com.neuroforge.backend.project.entity.Project;
import com.neuroforge.backend.project.entity.ProjectMember;
import com.neuroforge.backend.project.entity.Sprint;
import com.neuroforge.backend.project.entity.Task;
import com.neuroforge.backend.project.entity.TaskStatusHistory;
import com.neuroforge.backend.project.entity.CodeReview;
import com.neuroforge.backend.ai.enums.CodeReviewStatus;
import com.neuroforge.backend.project.repository.CodeReviewRepository;
import com.neuroforge.backend.project.repository.ProjectMemberRepository;
import com.neuroforge.backend.project.repository.ProjectRepository;
import com.neuroforge.backend.project.repository.SprintRepository;
import com.neuroforge.backend.project.repository.TaskRepository;
import com.neuroforge.backend.project.repository.TaskStatusHistoryRepository;
import com.neuroforge.backend.security.SecurityUtils;
import com.neuroforge.backend.specification.repository.SpecificationRepository;
import com.neuroforge.backend.specification.repository.SpecificationVersionRepository;
import com.neuroforge.backend.notification.service.NotificationService;
import com.neuroforge.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final SprintRepository sprintRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskStatusHistoryRepository taskStatusHistoryRepository;
    private final CodeReviewRepository codeReviewRepository;
    private final SpecificationRepository specificationRepository;
    private final SpecificationVersionRepository specificationVersionRepository;
    private final BoardEventPublisher boardEventPublisher;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public ApiResponse<TaskDto> createTask(CreateTaskRequest request) {
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> AppException.notFound("Project not found"));
        Sprint sprint = null;
        if (request.getSprintId() != null) {
            sprint = sprintRepository.findById(request.getSprintId())
                    .orElseThrow(() -> AppException.notFound("Sprint not found"));
        }
        ProjectMember member = null;
        if (request.getAssignedToId() != null) {
            member = projectMemberRepository.findById(request.getAssignedToId())
                    .orElseThrow(() -> AppException.notFound("Project Member not found"));
        }
        
        // Generate task key (e.g., NF-123)
        String taskKey = generateTaskKey(project.getId());
        
        Task task = Task.builder()
                .taskKey(taskKey)
                .title(request.getTitle())
                .description(request.getDescription())
                .priority(request.getPriority() == null ? "MEDIUM" : request.getPriority())
                .status(request.getStatus() == null ? "TODO" : request.getStatus())
                .storyPoints(request.getStoryPoints())
                .labels(request.getLabels())
                .specificationId(request.getSpecificationId())
                .specificationVersionId(request.getSpecificationVersionId())
                .project(project).sprint(sprint).assignedTo(member)
                .build();
        task = taskRepository.save(task);
        return ApiResponse.ok("Task created successfully", TaskDto.from(task, specificationRepository, specificationVersionRepository));
    }

    @Override
    public ApiResponse<List<TaskDto>> getAllTasks() {
        List<TaskDto> tasks = taskRepository.findAll()
                .stream().map(t -> TaskDto.from(t, specificationRepository, specificationVersionRepository)).collect(Collectors.toList());
        return ApiResponse.ok("Tasks retrieved successfully", tasks);
    }

    @Override
    public ApiResponse<List<TaskDto>> getTasksByProject(Long projectId) {
        projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Project not found"));
        
        List<Task> tasks;
        
        // Developers only see tasks assigned to them
        if (SecurityUtils.hasRole("ROLE_DEVELOPER")) {
            User currentUser = SecurityUtils.getCurrentUser()
                    .orElseThrow(() -> AppException.forbidden("User not authenticated"));
            tasks = taskRepository.findByProjectIdAndAssignedToUserId(projectId, currentUser.getId());
        } else {
            // PM, QA, Super Admin see all tasks
            tasks = taskRepository.findByProjectId(projectId);
        }
        
        List<TaskDto> taskDtos = tasks.stream()
                .map(t -> TaskDto.from(t, specificationRepository, specificationVersionRepository))
                .collect(Collectors.toList());
        return ApiResponse.ok("Project tasks retrieved", taskDtos);
    }

    @Override
    public ApiResponse<List<TaskDto>> getTasksBySprint(Long sprintId) {
        List<TaskDto> tasks = taskRepository.findBySprintId(sprintId)
                .stream().map(t -> TaskDto.from(t, specificationRepository, specificationVersionRepository)).collect(Collectors.toList());
        return ApiResponse.ok("Sprint tasks retrieved", tasks);
    }

    // ── Module 3: Task Board (grouped by status) ──────────────────────────────

    @Override
    public ApiResponse<TaskBoardDto> getTaskBoard(Long projectId) {
        projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Project not found"));
        
        List<TaskDto> todo;
        List<TaskDto> inProgress;
        List<TaskDto> done;
        
        // Developers only see tasks assigned to them
        if (SecurityUtils.hasRole("ROLE_DEVELOPER")) {
            User currentUser = SecurityUtils.getCurrentUser()
                    .orElseThrow(() -> AppException.forbidden("User not authenticated"));
            
            todo = taskRepository.findByProjectIdAndStatusAndAssignedToUserId(projectId, "TODO", currentUser.getId())
                    .stream().map(t -> TaskDto.from(t, specificationRepository, specificationVersionRepository)).collect(Collectors.toList());
            inProgress = taskRepository.findByProjectIdAndStatusAndAssignedToUserId(projectId, "IN_PROGRESS", currentUser.getId())
                    .stream().map(t -> TaskDto.from(t, specificationRepository, specificationVersionRepository)).collect(Collectors.toList());
            done = taskRepository.findByProjectIdAndStatusAndAssignedToUserId(projectId, "DONE", currentUser.getId())
                    .stream().map(t -> TaskDto.from(t, specificationRepository, specificationVersionRepository)).collect(Collectors.toList());
        } else {
            // PM, QA, Super Admin see all tasks
            todo = taskRepository.findByProjectIdAndStatus(projectId, "TODO")
                    .stream().map(t -> TaskDto.from(t, specificationRepository, specificationVersionRepository)).collect(Collectors.toList());
            inProgress = taskRepository.findByProjectIdAndStatus(projectId, "IN_PROGRESS")
                    .stream().map(t -> TaskDto.from(t, specificationRepository, specificationVersionRepository)).collect(Collectors.toList());
            done = taskRepository.findByProjectIdAndStatus(projectId, "DONE")
                    .stream().map(t -> TaskDto.from(t, specificationRepository, specificationVersionRepository)).collect(Collectors.toList());
        }
        
        TaskBoardDto board = TaskBoardDto.builder()
                .todo(todo).inProgress(inProgress).done(done).build();
        return ApiResponse.ok("Task board retrieved", board);
    }

    @Override
    public ApiResponse<TaskDto> getTaskById(Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Task not found"));
        return ApiResponse.ok("Task found", TaskDto.from(task, specificationRepository, specificationVersionRepository));
    }

    @Override
    @Transactional
    public ApiResponse<TaskDto> updateTask(Long id, UpdateTaskRequest request) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Task not found"));

        // Validate task ownership for non-admin roles
        if (!SecurityUtils.isSuperAdmin() && !SecurityUtils.hasRole("ROLE_PROJECT_MANAGER")) {
            // Developers and QA can only edit their assigned tasks
            if (task.getAssignedTo() != null) {
                User currentUser = SecurityUtils.getCurrentUser()
                        .orElseThrow(() -> AppException.forbidden("User not authenticated"));
                if (!task.getAssignedTo().getTeamMember().getUser().getId().equals(currentUser.getId())) {
                    throw AppException.forbidden("You can only edit tasks assigned to you");
                }
            } else {
                throw AppException.forbidden("You can only edit tasks assigned to you");
            }
        }

        String currentStatus = task.getStatus();
        String newStatus = request.getStatus();

        // Track status change if status is being updated
        if (newStatus != null && !newStatus.equals(currentStatus)) {
            // Module 5: Validate status transition
            if (!isValidStatusTransition(currentStatus, newStatus)) {
                throw AppException.badRequest(
                        "Invalid task status transition from " + currentStatus + " to " + newStatus);
            }

            // Module 5: QA-only restriction for moving tasks to DONE
            if ("DONE".equals(newStatus) && !hasRole("ROLE_QA")) {
                throw AppException.forbidden("Only QA users can move tasks to DONE status");
            }

            task.setStatus(newStatus);

            // Module 5: Track status history
            String currentUser = getCurrentUsername();
            TaskStatusHistory history = TaskStatusHistory.builder()
                    .task(task)
                    .previousStatus(currentStatus)
                    .newStatus(newStatus)
                    .changedBy(currentUser)
                    .changedAt(LocalDateTime.now())
                    .build();
            taskStatusHistoryRepository.save(history);

            // Module 5: Publish WebSocket event for real-time board synchronization
            TaskBoardEvent event = TaskBoardEvent.builder()
                    .taskId(task.getId())
                    .projectId(task.getProject().getId())
                    .previousStatus(currentStatus)
                    .newStatus(newStatus)
                    .changedBy(currentUser)
                    .timestamp(LocalDateTime.now())
                    .build();
            boardEventPublisher.publishTaskUpdate(event);

            // Module 5: Send notifications based on status transitions
            sendTaskStatusNotifications(task, currentStatus, newStatus, currentUser);
        }

        if (request.getTitle() != null)       task.setTitle(request.getTitle());
        if (request.getDescription() != null) task.setDescription(request.getDescription());
        if (request.getPriority() != null)    task.setPriority(request.getPriority());
        if (request.getStoryPoints() != null) task.setStoryPoints(request.getStoryPoints());
        if (request.getLabels() != null)      task.setLabels(request.getLabels());
        if (request.getSpecificationId() != null) task.setSpecificationId(request.getSpecificationId());
        if (request.getSpecificationVersionId() != null) task.setSpecificationVersionId(request.getSpecificationVersionId());
        if (request.getSprintId() != null) {
            Sprint sprint = sprintRepository.findById(request.getSprintId())
                    .orElseThrow(() -> AppException.notFound("Sprint not found"));
            task.setSprint(sprint);
        }
        if (request.getAssignedToId() != null) {
            ProjectMember member = projectMemberRepository.findById(request.getAssignedToId())
                    .orElseThrow(() -> AppException.notFound("Project Member not found"));
            task.setAssignedTo(member);
        }
        task = taskRepository.save(task);
        return ApiResponse.ok("Task updated successfully", TaskDto.from(task, specificationRepository, specificationVersionRepository));
    }

    @Override
    @Transactional
    public ApiResponse<Void> deleteTask(Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Task not found"));

        // Delete task status history records to avoid foreign key constraint issues
        taskStatusHistoryRepository.deleteByTaskId(id);

        // Clear relationships to avoid foreign key constraint issues
        task.setSprint(null);
        task.setAssignedTo(null);
        taskRepository.save(task);

        taskRepository.deleteById(id);
        return ApiResponse.ok("Task deleted successfully");
    }

    @Override
    @Transactional
    public ApiResponse<TaskDto> updateTaskStatus(Long taskId, UpdateTaskStatusRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> AppException.notFound("Task not found"));

        // Developers can only update status of tasks assigned to them
        if (SecurityUtils.hasRole("ROLE_DEVELOPER")) {
            if (task.getAssignedTo() != null) {
                User currentUser = SecurityUtils.getCurrentUser()
                        .orElseThrow(() -> AppException.forbidden("User not authenticated"));
                if (!task.getAssignedTo().getTeamMember().getUser().getId().equals(currentUser.getId())) {
                    throw AppException.forbidden("You can only update status of tasks assigned to you");
                }
            } else {
                throw AppException.forbidden("You can only update status of tasks assigned to you");
            }
        }

        String currentStatus = task.getStatus();
        String newStatus = request.getStatus();

        if (!isValidStatusTransition(currentStatus, newStatus)) {
            throw AppException.badRequest(
                    "Invalid task status transition from " + currentStatus + " to " + newStatus);
        }

        // Module 5: QA can only move tasks that are in TESTING status
        if (SecurityUtils.hasRole("ROLE_QA") && !"TESTING".equals(currentStatus)) {
            throw AppException.forbidden("QA users can only move tasks that are in TESTING status");
        }

        // Module 5: QA-only restriction for moving tasks to DONE
        if ("DONE".equals(newStatus) && !SecurityUtils.hasRole("ROLE_QA")) {
            throw AppException.forbidden("Only QA users can move tasks to DONE status");
        }

        // Module 8: Workflow gate - prevent TESTING transition unless code review is ACCEPTED
        if ("CODE_REVIEW".equals(currentStatus) && "TESTING".equals(newStatus)) {
            CodeReview latestReview = codeReviewRepository.findTopByTaskIdOrderByCreatedAtDesc(task.getId())
                    .orElse(null);
            
            if (latestReview == null || latestReview.getStatus() != CodeReviewStatus.ACCEPTED) {
                String reviewStatus = latestReview != null ? latestReview.getStatus().name() : "NOT_SUBMITTED";
                throw AppException.forbidden(
                        "Cannot move task to TESTING status. Code review must be ACCEPTED. Current review status: " + reviewStatus);
            }
        }

        task.setStatus(newStatus);
        Task updated = taskRepository.save(task);

        // Module 5: Track status history
        String currentUser = getCurrentUsername();
        TaskStatusHistory history = TaskStatusHistory.builder()
                .task(updated)
                .previousStatus(currentStatus)
                .newStatus(newStatus)
                .changedBy(currentUser)
                .changedAt(LocalDateTime.now())
                .build();
        taskStatusHistoryRepository.save(history);

        // Module 5: Publish WebSocket event for real-time board synchronization
        TaskBoardEvent event = TaskBoardEvent.builder()
                .taskId(updated.getId())
                .projectId(updated.getProject().getId())
                .previousStatus(currentStatus)
                .newStatus(newStatus)
                .changedBy(currentUser)
                .timestamp(LocalDateTime.now())
                .build();
        boardEventPublisher.publishTaskUpdate(event);

        // Module 5: Send notifications based on status transitions
        sendTaskStatusNotifications(task, currentStatus, newStatus, currentUser);

        return ApiResponse.ok("Task status updated successfully", TaskDto.from(updated));
    }

    @Override
    public ApiResponse<List<TaskStatusHistoryResponse>> getTaskStatusHistory(Long taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw AppException.notFound("Task not found");
        }
        List<TaskStatusHistory> history = taskStatusHistoryRepository.findByTaskIdOrderByChangedAtAsc(taskId);
        List<TaskStatusHistoryResponse> response = history.stream()
                .map(this::mapToHistoryResponse)
                .collect(Collectors.toList());
        return ApiResponse.ok("Task status history retrieved", response);
    }

    // Module 5: Workflow validation
    // Module 8: Workflow gate - prevent TESTING transition unless code review is ACCEPTED
    private boolean isValidStatusTransition(String currentStatus, String newStatus) {
        if (currentStatus == null || newStatus == null) {
            return false;
        }
        if (currentStatus.equals(newStatus)) {
            return true;
        }
        // Valid transitions: TODO -> IN_PROGRESS -> CODE_REVIEW -> TESTING -> DONE
        boolean validTransition = ("TODO".equals(currentStatus) && "IN_PROGRESS".equals(newStatus))
                || ("IN_PROGRESS".equals(currentStatus) && "CODE_REVIEW".equals(newStatus))
                || ("CODE_REVIEW".equals(currentStatus) && "TESTING".equals(newStatus))
                || ("TESTING".equals(currentStatus) && "DONE".equals(newStatus))
                || ("CODE_REVIEW".equals(currentStatus) && "IN_PROGRESS".equals(newStatus))
                || ("IN_PROGRESS".equals(currentStatus) && "TODO".equals(newStatus));

        // Module 8: Workflow gate - check code review status before allowing TESTING transition
        if (validTransition && "CODE_REVIEW".equals(currentStatus) && "TESTING".equals(newStatus)) {
            // This check will be done in the calling method with task context
            return true;
        }

        return validTransition;
    }

    private TaskStatusHistoryResponse mapToHistoryResponse(TaskStatusHistory history) {
        return TaskStatusHistoryResponse.builder()
                .id(history.getId())
                .taskId(history.getTask() != null ? history.getTask().getId() : null)
                .previousStatus(history.getPreviousStatus())
                .newStatus(history.getNewStatus())
                .changedBy(history.getChangedBy())
                .changedAt(history.getChangedAt())
                .build();
    }

    // Module 5: Helper methods for role-based authorization
    private boolean hasRole(String role) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        Collection<? extends GrantedAuthority> authorities = authentication.getAuthorities();
        return authorities.stream()
                .anyMatch(authority -> authority.getAuthority().equals(role));
    }

    private String getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return "SYSTEM";
        }
        return authentication.getName();
    }

    private String generateTaskKey(Long projectId) {
        // Generate task key in format: NF-{projectId}-{sequenceNumber}
        // For simplicity, we'll use a timestamp-based approach
        long sequence = System.currentTimeMillis() % 10000;
        return String.format("NF-%d-%04d", projectId, sequence);
    }

    // Module 5: Send notifications based on task status transitions
    private void sendTaskStatusNotifications(Task task, String previousStatus, String newStatus, String changedBy) {
        try {
            Long organizationId = task.getProject().getOrganization().getId();
            List<User> orgMembers = userRepository.findByOrganizationId(organizationId);
            
            String taskTitle = task.getTitle();
            String taskKey = task.getTaskKey();
            
            // Define notification routing based on status transitions
            if ("TODO".equals(previousStatus) && "IN_PROGRESS".equals(newStatus)) {
                // Developer moves task to IN_PROGRESS -> Notify PM and QA
                for (User member : orgMembers) {
                    if (hasRole(member, "ROLE_PROJECT_MANAGER") || hasRole(member, "ROLE_QA")) {
                        notificationService.create(member,
                            "Task Started: " + taskKey,
                            "Task \"" + taskTitle + "\" has been moved to IN_PROGRESS by " + changedBy,
                            "TASK_STATUS");
                    }
                }
            } else if ("IN_PROGRESS".equals(previousStatus) && "CODE_REVIEW".equals(newStatus)) {
                // Developer moves task to CODE_REVIEW -> Notify PM and QA
                for (User member : orgMembers) {
                    if (hasRole(member, "ROLE_PROJECT_MANAGER") || hasRole(member, "ROLE_QA")) {
                        notificationService.create(member,
                            "Code Review Requested: " + taskKey,
                            "Task \"" + taskTitle + "\" is ready for code review",
                            "TASK_STATUS");
                    }
                }
            } else if ("CODE_REVIEW".equals(previousStatus) && "TESTING".equals(newStatus)) {
                // Task moves to TESTING -> Notify PM and QA
                for (User member : orgMembers) {
                    if (hasRole(member, "ROLE_PROJECT_MANAGER") || hasRole(member, "ROLE_QA")) {
                        notificationService.create(member,
                            "Ready for Testing: " + taskKey,
                            "Task \"" + taskTitle + "\" has been moved to TESTING",
                            "TASK_STATUS");
                    }
                }
            } else if ("TESTING".equals(previousStatus) && "DONE".equals(newStatus)) {
                // QA moves task to DONE -> Notify PM and Developer
                for (User member : orgMembers) {
                    if (hasRole(member, "ROLE_PROJECT_MANAGER") || hasRole(member, "ROLE_DEVELOPER")) {
                        notificationService.create(member,
                            "Task Completed: " + taskKey,
                            "Task \"" + taskTitle + "\" has been marked as DONE by " + changedBy,
                            "TASK_STATUS");
                    }
                }
            } else if ("CODE_REVIEW".equals(previousStatus) && "IN_PROGRESS".equals(newStatus)) {
                // Task sent back from code review -> Notify Developer
                for (User member : orgMembers) {
                    if (hasRole(member, "ROLE_DEVELOPER")) {
                        notificationService.create(member,
                            "Code Review Feedback: " + taskKey,
                            "Task \"" + taskTitle + "\" has been sent back to IN_PROGRESS for changes",
                            "TASK_STATUS");
                    }
                }
            } else if ("IN_PROGRESS".equals(previousStatus) && "TODO".equals(newStatus)) {
                // Task sent back to TODO -> Notify PM
                for (User member : orgMembers) {
                    if (hasRole(member, "ROLE_PROJECT_MANAGER")) {
                        notificationService.create(member,
                            "Task Returned: " + taskKey,
                            "Task \"" + taskTitle + "\" has been moved back to TODO",
                            "TASK_STATUS");
                    }
                }
            }
        } catch (Exception e) {
            // Log error but don't fail the status update
            System.err.println("Failed to send task status notifications: " + e.getMessage());
        }
    }

    // Helper method to check if a user has a specific role
    private boolean hasRole(User user, String role) {
        return user.getAuthorities() != null && 
               user.getAuthorities().stream()
                   .anyMatch(auth -> auth.getAuthority().equals(role));
    }
}
