package com.neuroforge.backend.project.repository;

import com.neuroforge.backend.project.entity.Milestone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MilestoneRepository extends JpaRepository<Milestone, Long> {

    List<Milestone> findByProjectIdOrderByTargetDateAsc(Long projectId);

    List<Milestone> findByProjectIdAndStatusOrderByTargetDateAsc(Long projectId, String status);

    List<Milestone> findByTargetDateBeforeAndStatus(LocalDate date, String status);
}
