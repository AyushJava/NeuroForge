package com.neuroforge.backend.project.repository;

import com.neuroforge.backend.project.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByProjectNameContainingIgnoreCase(String keyword);

    long countByStatus(String status);

    /** Count projects belonging to an organisation (for stats). */
    long countByOrganizationId(Long organizationId);

    /** Count projects by status and organization (for dashboard stats). */
    long countByStatusAndOrganizationId(String status, Long organizationId);

    // ── JOIN FETCH queries so ProjectDto.from() can access project.getOrganization()
    // ── safely even when open-in-view is disabled. ────────────────────────────────

    @Query("SELECT p FROM Project p LEFT JOIN FETCH p.organization")
    List<Project> findAllWithOrganization();

    @Query("SELECT p FROM Project p LEFT JOIN FETCH p.organization WHERE p.id = :id")
    Optional<Project> findByIdWithOrganization(@Param("id") Long id);

    @Query("SELECT p FROM Project p LEFT JOIN FETCH p.organization WHERE p.organization.id = :orgId")
    List<Project> findByOrganizationIdWithOrganization(@Param("orgId") Long orgId);

    /** Find active projects (not archived or completed) for health snapshots */
    List<Project> findByStatusNotIn(List<String> statuses);

    /** Find projects assigned to a user (via project membership) */
    @Query("SELECT DISTINCT p FROM Project p " +
           "LEFT JOIN FETCH p.organization " +
           "JOIN p.members pm " +
           "JOIN pm.teamMember tm " +
           "JOIN tm.user u " +
           "WHERE u.id = :userId")
    List<Project> findAssignedProjectsByUserId(@Param("userId") Long userId);
}
