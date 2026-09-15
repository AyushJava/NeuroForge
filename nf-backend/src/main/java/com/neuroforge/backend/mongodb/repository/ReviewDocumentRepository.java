package com.neuroforge.backend.mongodb.repository;

import com.neuroforge.backend.mongodb.document.ReviewDocument;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ReviewDocumentRepository extends MongoRepository<ReviewDocument, String> {

    Optional<ReviewDocument> findByReviewId(String reviewId);

    List<ReviewDocument> findByTaskId(String taskId);

    List<ReviewDocument> findAllByOrderByCreatedAtAsc();

    List<ReviewDocument> findByOrganizationIdOrderByCreatedAtAsc(Long organizationId);
}
