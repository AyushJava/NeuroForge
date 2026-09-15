package com.neuroforge.backend.organization.repository;

import com.neuroforge.backend.organization.entity.Invite;
import com.neuroforge.backend.organization.entity.InviteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

@Repository
public interface InviteRepository extends JpaRepository<Invite, Long> {
    List<Invite> findByOrganizationId(Long organizationId);
    List<Invite> findByOrganizationIdAndStatus(Long organizationId, InviteStatus status);
    @Query("SELECT i FROM Invite i LEFT JOIN FETCH i.organization LEFT JOIN FETCH i.invitedBy WHERE i.token = :token")
    Optional<Invite> findByToken(@Param("token") String token);
    long countByOrganizationIdAndStatus(Long organizationId, InviteStatus status);

    /** Find all invitations for a given email address and status — used during registration
     *  to materialise TeamMember rows for invitations accepted before the account existed.
     *  Ordered by createdAt DESC to get the most recent invitation first. */
    @Query("SELECT i FROM Invite i LEFT JOIN FETCH i.organization WHERE i.email = :email AND i.status = :status ORDER BY i.createdAt DESC")
    List<Invite> findByEmailAndStatus(@Param("email") String email, @Param("status") InviteStatus status);

    /** Delete all invitations for a given email address.
     *  Called when deleting a user to remove their old invitations. */
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("DELETE FROM Invite i WHERE i.email = :email")
    void deleteByEmail(@Param("email") String email);
}
