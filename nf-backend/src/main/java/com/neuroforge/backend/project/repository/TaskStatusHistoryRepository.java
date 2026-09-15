package com.neuroforge.backend.project.repository;

import com.neuroforge.backend.project.entity.TaskStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface TaskStatusHistoryRepository extends JpaRepository<TaskStatusHistory, Long> {
    List<TaskStatusHistory> findByTaskIdOrderByChangedAtAsc(Long taskId);

    @Modifying
    @Transactional
    @Query("DELETE FROM TaskStatusHistory t WHERE t.task.id = :taskId")
    void deleteByTaskId(@Param("taskId") Long taskId);
}
