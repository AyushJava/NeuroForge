package com.neuroforge.backend.integration.repository;

import com.neuroforge.backend.integration.entity.TaskCommitLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface TaskCommitLinkRepository extends JpaRepository<TaskCommitLink, Long> {

    List<TaskCommitLink> findByTaskKey(String taskKey);

    List<TaskCommitLink> findByTaskId(Long taskId);

    java.util.Optional<TaskCommitLink> findByCommitIdAndTaskId(Long commitId, Long taskId);

    @Modifying
    @Transactional
    @Query("DELETE FROM TaskCommitLink t WHERE t.commit.repositoryConnection.id = :repositoryId")
    void deleteByRepositoryConnectionId(@Param("repositoryId") Long repositoryId);

}
