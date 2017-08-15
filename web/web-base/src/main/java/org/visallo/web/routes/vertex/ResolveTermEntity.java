package org.visallo.web.routes.vertex;

import com.google.inject.Inject;
import com.v5analytics.webster.ParameterizedHandler;
import com.v5analytics.webster.annotations.Handle;
import com.v5analytics.webster.annotations.Optional;
import com.v5analytics.webster.annotations.Required;
import org.vertexium.*;
import org.vertexium.mutation.ElementMutation;
import org.visallo.core.exception.VisalloException;
import org.visallo.core.model.Name;
import org.visallo.core.model.PropertyJustificationMetadata;
import org.visallo.core.model.graph.ElementUpdateContext;
import org.visallo.core.model.graph.GraphRepository;
import org.visallo.core.model.graph.GraphUpdateContext;
import org.visallo.core.model.ontology.Concept;
import org.visallo.core.model.ontology.OntologyRepository;
import org.visallo.core.model.properties.VisalloProperties;
import org.visallo.core.model.termMention.TermMentionBuilder;
import org.visallo.core.model.workQueue.Priority;
import org.visallo.core.model.workQueue.WorkQueueRepository;
import org.visallo.core.model.workspace.Workspace;
import org.visallo.core.model.workspace.WorkspaceRepository;
import org.visallo.core.security.VisalloVisibility;
import org.visallo.core.security.VisibilityTranslator;
import org.visallo.core.user.User;
import org.visallo.web.VisalloResponse;
import org.visallo.web.clientapi.model.ClientApiSourceInfo;
import org.visallo.web.clientapi.model.ClientApiSuccess;
import org.visallo.web.clientapi.model.VisibilityJson;
import org.visallo.web.parameterProviders.ActiveWorkspaceId;
import org.visallo.web.parameterProviders.JustificationText;
import org.visallo.web.util.VisibilityValidator;

import java.util.Date;
import java.util.ResourceBundle;

@Name("Resolve Term Endpoint")
public class ResolveTermEntity implements ParameterizedHandler {
    private static final String MULTI_VALUE_KEY = ResolveTermEntity.class.getName();
    private final Graph graph;
    private final GraphRepository graphRepository;
    private final OntologyRepository ontologyRepository;
    private final VisibilityTranslator visibilityTranslator;
    private final WorkspaceRepository workspaceRepository;
    private final WorkQueueRepository workQueueRepository;

    @Inject
    public ResolveTermEntity(
            final Graph graph,
            final GraphRepository graphRepository,
            final OntologyRepository ontologyRepository,
            final VisibilityTranslator visibilityTranslator,
            final WorkspaceRepository workspaceRepository,
            final WorkQueueRepository workQueueRepository
    ) {
        this.graph = graph;
        this.graphRepository = graphRepository;
        this.ontologyRepository = ontologyRepository;
        this.visibilityTranslator = visibilityTranslator;
        this.workspaceRepository = workspaceRepository;
        this.workQueueRepository = workQueueRepository;
    }

    @Handle
    public ClientApiSuccess handle(
            @Required(name = "artifactId") String artifactId,
            @Required(name = "propertyKey") String propertyKey,
            @Required(name = "propertyName") String propertyName,
            @Required(name = "mentionStart") long mentionStart,
            @Required(name = "mentionEnd") long mentionEnd,
            @Required(name = "sign") String title,
            @Required(name = "visibilitySource") String visibilitySource,
            @Optional(name = "resolvedVertexId") String resolvedVertexId,
            @Optional(name = "sourceInfo") String sourceInfoString,
            @Optional(name = "conceptId") String conceptId,
            @Optional(name = "resolvedFromTermMention") String resolvedFromTermMention,
            @JustificationText String justificationText,
            @ActiveWorkspaceId String workspaceId,
            ResourceBundle resourceBundle,
            User user,
            Authorizations authorizations
    ) throws Exception {
        String artifactHasEntityIri = ontologyRepository.getRequiredRelationshipIRIByIntent("artifactHasEntity", workspaceId);

        Workspace workspace = workspaceRepository.findById(workspaceId, user);

        VisibilityJson visibilityJson = VisibilityJson.updateVisibilitySourceAndAddWorkspaceId(null, visibilitySource, workspaceId);
        VisibilityValidator.validate(graph, visibilityTranslator, resourceBundle, visibilityJson, user, authorizations);

        String id = resolvedVertexId == null ? graph.getIdGenerator().nextId() : resolvedVertexId;

        final Vertex artifactVertex = graph.getVertex(artifactId, authorizations);
        VisalloVisibility visalloVisibility = visibilityTranslator.toVisibility(visibilityJson);
        Metadata metadata = new Metadata();
        Visibility defaultVisibility = visibilityTranslator.getDefaultVisibility();
        VisalloProperties.VISIBILITY_JSON_METADATA.setMetadata(metadata, visibilityJson, defaultVisibility);

        Vertex vertex;
        Edge edge;

        try (GraphUpdateContext ctx = graphRepository.beginGraphUpdate(Priority.NORMAL, user, authorizations)) {

            Date modifiedDate = new Date();

            if (resolvedVertexId != null) {
                vertex = graph.getVertex(id, authorizations);
                conceptId = VisalloProperties.CONCEPT_TYPE.getPropertyValue(vertex);
            } else {
                if (conceptId == null) {
                    throw new VisalloException("conceptId required when creating entity");
                }


                VertexBuilder builder = graph.prepareVertex(id, visalloVisibility.getVisibility());


                vertex = ctx.update(builder, modifiedDate, visibilityJson, conceptId, elementCtx -> {
                    VisalloProperties.TITLE.updateProperty(elementCtx, MULTI_VALUE_KEY, title, metadata, visalloVisibility.getVisibility());

                    if (justificationText != null && sourceInfoString == null) {
                        PropertyJustificationMetadata propertyJustificationMetadata = new PropertyJustificationMetadata(justificationText);
                        VisalloProperties.JUSTIFICATION.updateProperty(elementCtx, propertyJustificationMetadata, visalloVisibility.getVisibility());
                    }
                }).get();

                workspaceRepository.updateEntityOnWorkspace(workspace, vertex.getId(), user);
            }

            EdgeBuilder edgeBuilder = graph.prepareEdge(artifactVertex, vertex, artifactHasEntityIri, visalloVisibility.getVisibility());
            edge = ctx.update(edgeBuilder, modifiedDate, visibilityJson, edgeCtx -> {}).get();
        }


        ClientApiSourceInfo sourceInfo = ClientApiSourceInfo.fromString(sourceInfoString);
        new TermMentionBuilder()
                .outVertex(artifactVertex)
                .propertyKey(propertyKey)
                .propertyName(propertyName)
                .start(mentionStart)
                .end(mentionEnd)
                .title(title)
                .snippet(sourceInfo == null ? null : sourceInfo.snippet)
                .conceptIri(conceptId)
                .visibilityJson(visibilityJson)
                .resolvedTo(vertex, edge)
                .resolvedFromTermMention(resolvedFromTermMention)
                .process(getClass().getName())
                .save(this.graph, visibilityTranslator, user, authorizations);

        this.graph.flush();
        workQueueRepository.pushTextUpdated(artifactId);
        workQueueRepository.pushElement(edge, Priority.NORMAL);

        return VisalloResponse.SUCCESS;
    }
}
