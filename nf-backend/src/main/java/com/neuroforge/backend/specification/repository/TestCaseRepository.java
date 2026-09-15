package com.neuroforge.backend.specification.repository;

import com.neuroforge.backend.specification.entity.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCase, UUID> {
    List<TestCase> findBySpecificationId(UUID specificationId);
    List<TestCase> findBySpecificationIdOrderByCreatedAtDesc(UUID specificationId);
    
    @Query("SELECT t FROM TestCase t JOIN FETCH t.specification s LEFT JOIN FETCH s.organization o WHERE s.organizationId = :orgId ORDER BY t.createdAt DESC")
    List<TestCase> findBySpecificationOrganizationIdOrderByCreatedAtDesc(@Param("orgId") Long orgId);
    
    @Query("SELECT t FROM TestCase t JOIN FETCH t.specification s LEFT JOIN FETCH s.organization o WHERE s.projectId = :projectId ORDER BY t.createdAt DESC")
    List<TestCase> findBySpecificationProjectIdOrderByCreatedAtDesc(@Param("projectId") UUID projectId);
}
