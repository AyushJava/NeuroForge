package com.neuroforge.backend.project.repository;

import com.neuroforge.backend.ai.enums.CodeReviewStatus;
import com.neuroforge.backend.project.entity.CodeReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface CodeReviewRepository extends JpaRepository<CodeReview, Long> {

    List<CodeReview> findByTaskId(Long taskId);

    List<CodeReview> findByStatus(CodeReviewStatus status);

    Optional<CodeReview> findTopByTaskIdOrderByCreatedAtDesc(Long taskId);

    @Modifying
    @Transactional
    @Query("DELETE FROM CodeReview c WHERE c.requestedBy.id = :userId")
    void deleteByRequestedBy(@Param("userId") Long userId);

    @Modifying
    @Transactional
    @Query("UPDATE CodeReview c SET c.approvedBy = NULL WHERE c.approvedBy.id = :userId")
    void clearApprovedBy(@Param("userId") Long userId);
}
