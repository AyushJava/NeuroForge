package com.neuroforge.backend.organization.repository;

import com.neuroforge.backend.organization.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    List<Team> findByOrganizationId(Long organizationId);

    /**
     * Clear lead reference for teams led by a specific user.
     * Called when deleting a user to avoid foreign key constraint violations.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Team t SET t.lead = null WHERE t.lead.id = :userId")
    void clearTeamLead(@Param("userId") Long userId);
}
