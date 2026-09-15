package com.neuroforge.backend.pipeline.repository;

import com.neuroforge.backend.pipeline.entity.Release;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReleaseRepository extends JpaRepository<Release, Long> {
    List<Release> findByOrganizationId(Long organizationId);
}
