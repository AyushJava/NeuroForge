package com.neuroforge.backend.integration.repository;

import com.neuroforge.backend.integration.entity.CommitCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface CommitCacheRepository extends JpaRepository<CommitCache, Long> {

    boolean existsByCommitSha(String commitSha);

    List<CommitCache> findByRepositoryConnectionId(Long repositoryConnectionId);

    Optional<CommitCache> findByCommitSha(String commitSha);

    @Modifying
    @Transactional
    @Query("DELETE FROM CommitCache c WHERE c.repositoryConnection.id = :repositoryId")
    void deleteByRepositoryConnectionId(@Param("repositoryId") Long repositoryId);
}
