package com.neuroforge.backend.migration;

import com.neuroforge.backend.organization.entity.Organization;
import com.neuroforge.backend.organization.repository.OrganizationRepository;
import com.neuroforge.backend.pipeline.entity.Pipeline;
import com.neuroforge.backend.pipeline.entity.Release;
import com.neuroforge.backend.pipeline.repository.PipelineRepository;
import com.neuroforge.backend.pipeline.repository.ReleaseRepository;
import com.neuroforge.backend.specification.entity.Specification;
import com.neuroforge.backend.specification.repository.SpecificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataMigrationService implements CommandLineRunner {

    private final SpecificationRepository specificationRepository;
    private final PipelineRepository pipelineRepository;
    private final ReleaseRepository releaseRepository;
    private final OrganizationRepository organizationRepository;

    @Override
    @Transactional
    public void run(String... args) {
        migrateSpecifications();
        migratePipelines();
        migrateReleases();
    }

    private void migrateSpecifications() {
        List<Specification> specsWithoutOrg = specificationRepository.findAll().stream()
                .filter(spec -> spec.getOrganization() == null)
                .toList();

        if (!specsWithoutOrg.isEmpty()) {
            log.info("Found {} specifications without organization. Migrating...", specsWithoutOrg.size());
            
            // Get the first organization (or you could use a specific logic)
            Organization org = organizationRepository.findAll().stream()
                    .findFirst()
                    .orElse(null);

            if (org != null) {
                for (Specification spec : specsWithoutOrg) {
                    spec.setOrganization(org);
                    specificationRepository.save(spec);
                }
                log.info("Successfully migrated {} specifications to organization {}", 
                        specsWithoutOrg.size(), org.getName());
            } else {
                log.warn("No organizations found. Cannot migrate specifications.");
            }
        } else {
            log.info("No specifications need migration.");
        }
    }

    private void migratePipelines() {
        List<Pipeline> pipelinesWithoutOrg = pipelineRepository.findAll().stream()
                .filter(pipeline -> pipeline.getOrganization() == null)
                .toList();

        if (!pipelinesWithoutOrg.isEmpty()) {
            log.info("Found {} pipelines without organization. Migrating...", pipelinesWithoutOrg.size());
            
            // Get the first organization (or you could use a specific logic)
            Organization org = organizationRepository.findAll().stream()
                    .findFirst()
                    .orElse(null);

            if (org != null) {
                for (Pipeline pipeline : pipelinesWithoutOrg) {
                    pipeline.setOrganization(org);
                    pipelineRepository.save(pipeline);
                }
                log.info("Successfully migrated {} pipelines to organization {}", 
                        pipelinesWithoutOrg.size(), org.getName());
            } else {
                log.warn("No organizations found. Cannot migrate pipelines.");
            }
        } else {
            log.info("No pipelines need migration.");
        }
    }

    private void migrateReleases() {
        List<Release> releasesWithoutOrg = releaseRepository.findAll().stream()
                .filter(release -> release.getOrganization() == null)
                .toList();

        if (!releasesWithoutOrg.isEmpty()) {
            log.info("Found {} releases without organization. Migrating...", releasesWithoutOrg.size());
            
            // Get the first organization (or you could use a specific logic)
            Organization org = organizationRepository.findAll().stream()
                    .findFirst()
                    .orElse(null);

            if (org != null) {
                for (Release release : releasesWithoutOrg) {
                    release.setOrganization(org);
                    releaseRepository.save(release);
                }
                log.info("Successfully migrated {} releases to organization {}", 
                        releasesWithoutOrg.size(), org.getName());
            } else {
                log.warn("No organizations found. Cannot migrate releases.");
            }
        } else {
            log.info("No releases need migration.");
        }
    }
}
