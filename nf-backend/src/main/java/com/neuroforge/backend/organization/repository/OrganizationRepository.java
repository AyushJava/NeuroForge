package com.neuroforge.backend.organization.repository;

import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.organization.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    Optional<Organization> findBySlug(String slug);
    List<Organization> findByCreatedBy(User createdBy);
    boolean existsBySlug(String slug);

    /**
     * Clear createdBy reference for organizations created by a specific user.
     * Called when deleting a user to avoid foreign key constraint violations.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Organization o SET o.createdBy = null WHERE o.createdBy.id = :userId")
    void clearCreatedBy(@Param("userId") Long userId);
}
