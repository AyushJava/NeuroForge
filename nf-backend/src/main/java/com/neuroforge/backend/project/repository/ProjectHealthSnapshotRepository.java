package com.neuroforge.backend.project.repository;

import com.neuroforge.backend.project.entity.ProjectHealthSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectHealthSnapshotRepository extends JpaRepository<ProjectHealthSnapshot, Long> {

    Optional<ProjectHealthSnapshot> findByProjectIdAndSnapshotDate(Long projectId, LocalDate snapshotDate);

    Optional<ProjectHealthSnapshot> findFirstByProjectIdOrderBySnapshotDateDesc(Long projectId);

    List<ProjectHealthSnapshot> findByProjectIdOrderBySnapshotDateDesc(Long projectId);

    List<ProjectHealthSnapshot> findBySnapshotDate(LocalDate snapshotDate);

    boolean existsByProjectIdAndSnapshotDate(Long projectId, LocalDate snapshotDate);
}
