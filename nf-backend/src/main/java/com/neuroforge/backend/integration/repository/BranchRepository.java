package com.neuroforge.backend.integration.repository;

import com.neuroforge.backend.integration.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface BranchRepository extends JpaRepository<Branch, Long> {

    Optional<Branch> findByBranchNameAndRepositoryConnectionId(String branchName, Long repositoryId);

    @Modifying
    @Transactional
    @Query("DELETE FROM Branch b WHERE b.repositoryConnection.id = :repositoryId")
    void deleteByRepositoryConnectionId(@Param("repositoryId") Long repositoryId);

}
