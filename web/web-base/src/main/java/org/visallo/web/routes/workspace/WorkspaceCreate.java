package org.visallo.web.routes.workspace;

import com.google.inject.Inject;
import com.v5analytics.webster.ParameterizedHandler;
import com.v5analytics.webster.annotations.Handle;
import com.v5analytics.webster.annotations.Optional;
import org.vertexium.Authorizations;
import org.visallo.core.model.user.AuthorizationRepository;
import org.visallo.core.model.workQueue.WorkQueueRepository;
import org.visallo.core.model.workspace.Workspace;
import org.visallo.core.model.workspace.WorkspaceRepository;
import org.visallo.core.user.User;
import org.visallo.core.util.VisalloLogger;
import org.visallo.core.util.VisalloLoggerFactory;
import org.visallo.web.clientapi.model.ClientApiWorkspace;

public class WorkspaceCreate implements ParameterizedHandler {
    private static final VisalloLogger LOGGER = VisalloLoggerFactory.getLogger(WorkspaceCreate.class);

    private final WorkspaceRepository workspaceRepository;
    private final WorkQueueRepository workQueueRepository;
    private final AuthorizationRepository authorizationRepository;

    @Inject
    public WorkspaceCreate(
            final WorkspaceRepository workspaceRepository,
            final WorkQueueRepository workQueueRepository,
            AuthorizationRepository authorizationRepository
    ) {
        this.workspaceRepository = workspaceRepository;
        this.workQueueRepository = workQueueRepository;
        this.authorizationRepository = authorizationRepository;
    }

    @Handle
    public ClientApiWorkspace handle(
            @Optional(name = "title") String title,
            User user
    ) throws Exception {
        Workspace workspace;

        workspace = workspaceRepository.add(title, user);

        LOGGER.info("Created workspace: %s, title: %s", workspace.getWorkspaceId(), workspace.getDisplayTitle());
        Authorizations authorizations = authorizationRepository.getGraphAuthorizations(user);
        ClientApiWorkspace clientApiWorkspace = workspaceRepository.toClientApi(workspace, user, authorizations);

        workQueueRepository.pushWorkspaceChange(clientApiWorkspace, clientApiWorkspace.getUsers(), user.getUserId(), null);

        return clientApiWorkspace;
    }
}
