package com.neuroforge.backend.project.repository;

import com.neuroforge.backend.project.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByProjectId(Long projectId);

    List<Task> findBySprintId(Long sprintId);

    List<Task> findByAssignedToId(Long projectMemberId);

    // Find tasks by project and assigned user (for developer filtering)
    @Query("SELECT t FROM Task t WHERE t.project.id = :projectId AND t.assignedTo IS NOT NULL AND t.assignedTo.teamMember.user.id = :userId")
    List<Task> findByProjectIdAndAssignedToUserId(@Param("projectId") Long projectId, @Param("userId") Long userId);

    List<Task> findByProjectIdAndSprintId(Long projectId, Long sprintId);

    // Module 7: Task key for commit linking
    java.util.Optional<Task> findByTaskKey(String taskKey);

    // Dashboard
    long countByStatus(String status);

    long countByProjectId(Long projectId);

    long countByProjectIdAndStatus(Long projectId, String status);

    // Task Board
    List<Task> findByProjectIdAndStatus(Long projectId, String status);

    // Task Board for specific user (developers only see their assigned tasks)
    @Query("SELECT t FROM Task t WHERE t.project.id = :projectId AND t.status = :status AND t.assignedTo IS NOT NULL AND t.assignedTo.teamMember.user.id = :userId")
    List<Task> findByProjectIdAndStatusAndAssignedToUserId(@Param("projectId") Long projectId, @Param("status") String status, @Param("userId") Long userId);

    // Module 5: Additional query methods
    List<Task> findByStatus(String status);
    List<Task> findByPriority(String priority);
    List<Task> findByTitleContainingIgnoreCaseOrDescriptionContainingIgnoreCase(String keyword, String keyword2);

    // Module 14: Analytics query methods
    long countBySprintId(Long sprintId);

    long countBySprintIdAndStatus(Long sprintId, String status);

    @Query("SELECT SUM(t.storyPoints) FROM Task t WHERE t.sprint.id = :sprintId")
    Integer getTotalStoryPointsBySprint(@Param("sprintId") Long sprintId);

    @Query("SELECT SUM(t.storyPoints) FROM Task t WHERE t.sprint.id = :sprintId AND t.status = :status")
    Integer getStoryPointsBySprintAndStatus(@Param("sprintId") Long sprintId, @Param("status") String status);

    @Query("SELECT SUM(t.storyPoints) FROM Task t")
    Integer getTotalStoryPoints();

    @Query("SELECT SUM(t.storyPoints) FROM Task t WHERE t.status = :status")
    Integer getStoryPointsByStatus(@Param("status") String status);

    long countByAssignedToId(Long assignedToId);

    long countByAssignedToIdAndStatus(Long assignedToId, String status);

    @Query("SELECT SUM(t.storyPoints) FROM Task t WHERE t.assignedTo.id = :assignedToId")
    Integer getTotalStoryPointsByAssignee(@Param("assignedToId") Long assignedToId);

    @Query("SELECT SUM(t.storyPoints) FROM Task t WHERE t.assignedTo.id = :assignedToId AND t.status = :status")
    Integer getStoryPointsByAssigneeAndStatus(@Param("assignedToId") Long assignedToId, @Param("status") String status);

    // Module 14: Organization-based analytics query methods
    @Query("SELECT COUNT(t) FROM Task t WHERE t.project.organization.id = :organizationId")
    long countByOrganizationId(@Param("organizationId") Long organizationId);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.project.organization.id = :organizationId AND t.status = :status")
    long countByOrganizationIdAndStatus(@Param("organizationId") Long organizationId, @Param("status") String status);

    @Query("SELECT t FROM Task t WHERE t.project.organization.id = :organizationId AND t.status = :status")
    List<Task> findByOrganizationIdAndStatus(@Param("organizationId") Long organizationId, @Param("status") String status);

    @Query("SELECT SUM(t.storyPoints) FROM Task t WHERE t.project.organization.id = :organizationId")
    Integer getTotalStoryPointsByOrganization(@Param("organizationId") Long organizationId);

    @Query("SELECT SUM(t.storyPoints) FROM Task t WHERE t.project.organization.id = :organizationId AND t.status = :status")
    Integer getStoryPointsByOrganizationAndStatus(@Param("organizationId") Long organizationId, @Param("status") String status);

    /**
     * Unassign all tasks assigned to a specific user by setting assignedTo to null.
     * Called when deleting a user to remove their task assignments.
     * The query joins through ProjectMember -> TeamMember -> User to find tasks assigned to the user.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Task t SET t.assignedTo = NULL WHERE t.assignedTo.teamMember.user.id = :userId")
    void unassignTasksByUserId(@Param("userId") Long userId);
}
