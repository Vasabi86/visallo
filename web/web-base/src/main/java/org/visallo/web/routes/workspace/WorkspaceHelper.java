package org.visallo.web.routes.workspace;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import org.json.JSONArray;
import org.json.JSONObject;
import org.vertexium.*;
import org.visallo.core.model.ontology.OntologyRepository;
import org.visallo.core.model.properties.VisalloProperties;
import org.visallo.core.model.termMention.TermMentionRepository;
import org.visallo.core.model.user.UserRepository;
import org.visallo.core.model.workQueue.Priority;
import org.visallo.core.model.workQueue.WorkQueueRepository;
import org.visallo.core.model.workspace.WorkspaceRepository;
import org.visallo.core.user.User;
import org.visallo.core.util.VisalloLogger;
import org.visallo.core.util.VisalloLoggerFactory;
import org.visallo.web.clientapi.model.VisibilityJson;

import java.util.List;

import static org.vertexium.util.IterableUtils.toList;

@Singleton
public class WorkspaceHelper {
    private static final VisalloLogger LOGGER = VisalloLoggerFactory.getLogger(WorkspaceHelper.class);
    private final TermMentionRepository termMentionRepository;
    private final UserRepository userRepository;
    private final WorkQueueRepository workQueueRepository;
    private final Graph graph;
    private String entityHasImageIri;
    private String artifactContainsImageOfEntityIri;
    private final OntologyRepository ontologyRepository;

    @Inject
    public WorkspaceHelper(
            final TermMentionRepository termMentionRepository,
            final UserRepository userRepository,
            final WorkQueueRepository workQueueRepository,
            final Graph graph,
            final OntologyRepository ontologyRepository
    ) {
        this.termMentionRepository = termMentionRepository;
        this.userRepository = userRepository;
        this.workQueueRepository = workQueueRepository;
        this.graph = graph;
        this.ontologyRepository = ontologyRepository;

        this.entityHasImageIri = ontologyRepository.getRelationshipIRIByIntent("entityHasImage");
        if (this.entityHasImageIri == null) {
            LOGGER.warn("'entityHasImage' intent has not been defined. Please update your ontology.");
        }

        this.artifactContainsImageOfEntityIri = ontologyRepository.getRelationshipIRIByIntent("artifactContainsImageOfEntity");
        if (this.artifactContainsImageOfEntityIri == null) {
            LOGGER.warn("'artifactContainsImageOfEntity' intent has not been defined. Please update your ontology.");
        }
    }

    public void unresolveTerm(Vertex termMention, Authorizations authorizations) {
        Vertex sourceVertex = termMentionRepository.findSourceVertex(termMention, authorizations);
        if (sourceVertex == null) {
            return;
        }

        termMentionRepository.delete(termMention, authorizations);
        workQueueRepository.pushTextUpdated(sourceVertex.getId());

        graph.flush();
    }

    public void deleteProperty(Vertex vertex, Property property, boolean propertyIsPublic, String workspaceId, Priority priority, Authorizations authorizations) {
        if (propertyIsPublic) {
            vertex.markPropertyHidden(property, new Visibility(workspaceId), authorizations);
        } else {
            vertex.softDeleteProperty(property.getKey(), property.getName(), property.getVisibility(), authorizations);
        }

        graph.flush();

        workQueueRepository.pushGraphPropertyQueue(vertex, property, priority);
    }

    public void deleteEdge(
            String workspaceId,
            Edge edge,
            Vertex sourceVertex,
            @SuppressWarnings("UnusedParameters") Vertex destVertex,
            boolean isPublicEdge,
            Priority priority,
            Authorizations authorizations
    ) {
        ensureOntologyIrisInitialized();

        if (isPublicEdge) {
            Visibility workspaceVisibility = new Visibility(workspaceId);

            graph.markEdgeHidden(edge, workspaceVisibility, authorizations);

            if (edge.getLabel().equals(entityHasImageIri)) {
                Property entityHasImage = sourceVertex.getProperty(VisalloProperties.ENTITY_IMAGE_VERTEX_ID.getPropertyName());
                if (entityHasImage != null) {
                    sourceVertex.markPropertyHidden(entityHasImage, workspaceVisibility, authorizations);
                    this.workQueueRepository.pushElementImageQueue(sourceVertex, entityHasImage, priority);
                }
            }

            for (Vertex termMention : termMentionRepository.findByEdgeId(sourceVertex.getId(), edge.getId(), authorizations)) {
                termMentionRepository.markHidden(termMention, workspaceVisibility, authorizations);
                workQueueRepository.pushTextUpdated(sourceVertex.getId());
            }

            graph.flush();
            this.workQueueRepository.pushEdgeDeletion(edge);
        } else {
            graph.softDeleteEdge(edge, authorizations);

            if (edge.getLabel().equals(entityHasImageIri)) {
                Property entityHasImage = sourceVertex.getProperty(VisalloProperties.ENTITY_IMAGE_VERTEX_ID.getPropertyName());
                if (entityHasImage != null) {
                    sourceVertex.softDeleteProperty(entityHasImage.getKey(), entityHasImage.getName(), authorizations);
                    this.workQueueRepository.pushElementImageQueue(sourceVertex, entityHasImage, priority);
                }
            }

            for (Vertex termMention : termMentionRepository.findByEdgeId(sourceVertex.getId(), edge.getId(), authorizations)) {
                termMentionRepository.delete(termMention, authorizations);
                workQueueRepository.pushTextUpdated(sourceVertex.getId());
            }

            graph.flush();
            this.workQueueRepository.pushEdgeDeletion(edge);
        }

        graph.flush();
    }

    private void ensureOntologyIrisInitialized() {
        if (this.entityHasImageIri == null) {
            this.entityHasImageIri = ontologyRepository.getRelationshipIRIByIntent("entityHasImage");
        }
        if (this.artifactContainsImageOfEntityIri == null) {
            this.artifactContainsImageOfEntityIri = ontologyRepository.getRelationshipIRIByIntent("artifactContainsImageOfEntity");
        }
    }

    public void deleteVertex(Vertex vertex, String workspaceId, boolean isPublicVertex, Priority priority, Authorizations authorizations, User user) {
        ensureOntologyIrisInitialized();

        if (isPublicVertex) {
            Visibility workspaceVisibility = new Visibility(workspaceId);

            graph.markVertexHidden(vertex, workspaceVisibility, authorizations);
            graph.flush();
            workQueueRepository.pushVertexDeletion(vertex);
        } else {
            JSONArray unresolved = new JSONArray();
            VisibilityJson visibilityJson = VisalloProperties.VISIBILITY_JSON.getPropertyValue(vertex);
            visibilityJson = VisibilityJson.removeFromAllWorkspace(visibilityJson);

            // because we store the current vertex image in a property we need to possibly find that property and change it
            //  if we are deleting the current image.
            for (Edge edge : vertex.getEdges(Direction.BOTH, entityHasImageIri, authorizations)) {
                if (edge.getVertexId(Direction.IN).equals(vertex.getId())) {
                    Vertex outVertex = edge.getVertex(Direction.OUT, authorizations);
                    Property entityHasImage = outVertex.getProperty(VisalloProperties.ENTITY_IMAGE_VERTEX_ID.getPropertyName());
                    outVertex.softDeleteProperty(entityHasImage.getKey(), entityHasImage.getName(), authorizations);
                    workQueueRepository.pushElementImageQueue(outVertex, entityHasImage, priority);
                }
            }

            // because detected objects are currently stored as properties on the artifact that reference the entity
            //   that they are resolved to we need to delete that property
            for (Edge edge : vertex.getEdges(Direction.BOTH, artifactContainsImageOfEntityIri, authorizations)) {
                for (Property rowKeyProperty : vertex.getProperties(VisalloProperties.ROW_KEY.getPropertyName())) {
                    String multiValueKey = rowKeyProperty.getValue().toString();
                    if (edge.getVertexId(Direction.IN).equals(vertex.getId())) {
                        Vertex outVertex = edge.getVertex(Direction.OUT, authorizations);
                        // remove property
                        VisalloProperties.DETECTED_OBJECT.removeProperty(outVertex, multiValueKey, authorizations);
                        graph.softDeleteEdge(edge, authorizations);
                        workQueueRepository.pushEdgeDeletion(edge);
                        workQueueRepository.pushGraphPropertyQueue(
                                outVertex,
                                multiValueKey,
                                VisalloProperties.DETECTED_OBJECT.getPropertyName(),
                                workspaceId,
                                visibilityJson.getSource(),
                                priority
                        );
                    }
                }
            }

            // because we store term mentions with an added visibility we need to delete them with that added authorizations.
            //  we also need to notify the front-end of changes as well as audit the changes
            for (Vertex termMention : termMentionRepository.findResolvedTo(vertex.getId(), authorizations)) {
                unresolveTerm(termMention, authorizations);
                JSONObject result = new JSONObject();
                result.put("success", true);
                unresolved.put(result);
            }

            // because we store workspaces with an added visibility we need to delete them with that added authorizations.
            Authorizations systemAuthorization = userRepository.getAuthorizations(user, WorkspaceRepository.VISIBILITY_STRING, workspaceId);
            Vertex workspaceVertex = graph.getVertex(workspaceId, systemAuthorization);
            for (Edge edge : workspaceVertex.getEdges(vertex, Direction.BOTH, systemAuthorization)) {
                graph.softDeleteEdge(edge, systemAuthorization);
            }

            graph.softDeleteVertex(vertex, authorizations);
            graph.flush();
            this.workQueueRepository.pushVertexDeletion(vertex);
        }

        graph.flush();
    }
}
