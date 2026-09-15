package com.neuroforge.backend.project.repository;

import com.neuroforge.backend.project.entity.Sprint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SprintRepository extends JpaRepository<Sprint, Long> {

    List<Sprint> findByProjectId(Long projectId);

    long countByProjectId(Long projectId);

    // Module 5: Sprint lifecycle and analytics query methods
    Sprint findFirstByStatus(String status);
    boolean existsByStatus(String status);
    List<Sprint> findByStatus(String status);

    // Module 14: Analytics query methods
    List<Sprint> findAllByOrderByStartDateAsc();

    // Organization-scoped queries for analytics
    @Query("SELECT s FROM Sprint s WHERE s.project.organization.id = :orgId ORDER BY s.startDate ASC")
    List<Sprint> findByOrganizationIdOrderByStartDateAsc(@Param("orgId") Long orgId);

    @Query("SELECT s FROM Sprint s WHERE s.status = :status AND s.project.organization.id = :orgId")
    List<Sprint> findByStatusAndOrganizationId(@Param("status") String status, @Param("orgId") Long orgId);

    @Query("SELECT s FROM Sprint s WHERE s.status = :status AND s.project.organization.id = :orgId ORDER BY s.startDate ASC")
    List<Sprint> findByStatusAndOrganizationIdOrderByStartDateAsc(@Param("status") String status, @Param("orgId") Long orgId);

    /** Count sprints belonging to an organisation (for dashboard stats). */
    @Query("SELECT COUNT(s) FROM Sprint s WHERE s.project.organization.id = :orgId")
    long countByOrganizationId(@Param("orgId") Long orgId);
}
