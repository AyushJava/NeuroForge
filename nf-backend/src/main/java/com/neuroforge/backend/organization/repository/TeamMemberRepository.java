package com.neuroforge.backend.organization.repository;

import com.neuroforge.backend.organization.entity.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
    List<TeamMember> findByOrganizationId(Long organizationId);
    List<TeamMember> findByUserId(Long userId);
    Optional<TeamMember> findByUserIdAndOrganizationId(Long userId, Long organizationId);
    long countByOrganizationId(Long organizationId);

    /** Find all TeamMember records assigned to a specific team. */
    List<TeamMember> findByTeamId(Long teamId);

    /**
     * Set team_id = NULL for every member of the given team without deleting the
     * TeamMember records.  Using clearAutomatically so the session cache is
     * refreshed after the bulk UPDATE.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE TeamMember tm SET tm.team = null WHERE tm.team.id = :teamId")
    void detachFromTeam(@Param("teamId") Long teamId);

    /**
     * Delete all TeamMember records for a given user ID.
     * Called when deleting a user to remove them from teams and organizations.
     */
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM TeamMember tm WHERE tm.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
