package com.neuroforge.backend.pipeline.repository;

import com.neuroforge.backend.pipeline.entity.Pipeline;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PipelineRepository extends JpaRepository<Pipeline, Long> {
    List<Pipeline> findByOrganizationId(Long organizationId);
    Optional<Pipeline> findByOrganizationIdAndActiveTrue(Long organizationId);
}
