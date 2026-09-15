package com.neuroforge.backend.integration.repository;

import com.neuroforge.backend.integration.entity.PullRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface PullRequestRepository extends JpaRepository<PullRequest, Long> {

    Optional<PullRequest> findByPrNumberAndRepositoryConnectionId(Integer prNumber, Long repositoryId);

    @Modifying
    @Transactional
    @Query("DELETE FROM PullRequest p WHERE p.repositoryConnection.id = :repositoryId")
    void deleteByRepositoryConnectionId(@Param("repositoryId") Long repositoryId);

}
