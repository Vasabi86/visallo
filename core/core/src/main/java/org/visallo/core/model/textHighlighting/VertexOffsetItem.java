package org.visallo.core.model.textHighlighting;

import com.google.common.hash.Hashing;
import org.json.JSONException;
import org.json.JSONObject;
import org.vertexium.Authorizations;
import org.vertexium.Direction;
import org.vertexium.Vertex;
import org.visallo.core.model.properties.VisalloProperties;
import org.visallo.core.model.termMention.TermMentionFor;
import org.visallo.core.model.termMention.TermMentionRepository;
import org.visallo.core.status.StatusServer;
import org.visallo.core.util.SourceInfoSnippetSanitizer;
import org.visallo.web.clientapi.model.SandboxStatus;

import static com.google.common.base.Preconditions.checkArgument;
import static org.vertexium.util.IterableUtils.singleOrDefault;

public class VertexOffsetItem extends OffsetItem {
    private final Vertex termMention;
    private final SandboxStatus sandboxStatus;
    private final Authorizations authorizations;
    private final String classIdentifier;

    public VertexOffsetItem(Vertex termMention, SandboxStatus sandboxStatus, Authorizations authorizations) {
        this.termMention = termMention;
        this.sandboxStatus = sandboxStatus;
        this.authorizations = authorizations;
        this.classIdentifier = "tm-" + Hashing.sha1().hashString(termMention.getId()).toString();

        String[] authArray = this.authorizations.getAuthorizations();
        boolean hasTermMentionAuth = false;
        for (String auth : authArray) {
            if (TermMentionRepository.VISIBILITY_STRING.equals(auth)) {
                hasTermMentionAuth = true;
            }
        }
        checkArgument(hasTermMentionAuth, TermMentionRepository.VISIBILITY_STRING + " is a required auth");
    }

    @Override
    public long getStart() {
        return VisalloProperties.TERM_MENTION_START_OFFSET.getPropertyValue(termMention, 0);
    }

    @Override
    public long getEnd() {
        return VisalloProperties.TERM_MENTION_END_OFFSET.getPropertyValue(termMention, 0);
    }

    public String getConceptIri() {
        return VisalloProperties.TERM_MENTION_CONCEPT_TYPE.getPropertyValue(termMention);
    }

    public String getSnippet() {
        return SourceInfoSnippetSanitizer.sanitizeSnippet(
                VisalloProperties.TERM_MENTION_SNIPPET.getPropertyValue(termMention, null)
        );
    }

    @Override
    public String getId() {
        return termMention.getId();
    }

    @Override
    public String getProcess() {
        String process = VisalloProperties.TERM_MENTION_PROCESS.getPropertyValue(termMention);
        if (process == null) {
            return null;
        }
        JSONObject status = new JSONObject();
        try {
            Class cls = Class.forName(process);
            StatusServer.getGeneralInfo(status, cls);
            return status.optString("name", cls.getSimpleName());
        } catch (ClassNotFoundException cnf) {
            return process;
        }
    }

    @Override
    public String getOutVertexId() {
        return singleOrDefault(termMention.getVertexIds(Direction.IN, VisalloProperties.TERM_MENTION_LABEL_HAS_TERM_MENTION, this.authorizations), null);
    }

    @Override
    public String getResolvedToVertexId() {
        return singleOrDefault(termMention.getVertexIds(Direction.OUT, VisalloProperties.TERM_MENTION_LABEL_RESOLVED_TO, this.authorizations), null);
    }

    @Override
    public String getResolvedFromTermMentionId() {
        return singleOrDefault(termMention.getVertexIds(Direction.OUT, VisalloProperties.TERM_MENTION_RESOLVED_FROM, this.authorizations), null);
    }

    @Override
    public String getResolvedToTermMentionId() {
        return singleOrDefault(termMention.getVertexIds(Direction.IN, VisalloProperties.TERM_MENTION_RESOLVED_FROM, this.authorizations), null);
    }

    @Override
    public String getResolvedToEdgeId() {
        return VisalloProperties.TERM_MENTION_RESOLVED_EDGE_ID.getPropertyValue(termMention);
    }

    @Override
    public TermMentionFor getTermMentionFor() {
        return VisalloProperties.TERM_MENTION_FOR_TYPE.getPropertyValue(termMention);
    }

    @Override
    public SandboxStatus getSandboxStatus() {
        return sandboxStatus;
    }

    @Override
    public String getClassIdentifier() {
        return classIdentifier;
    }

    public String getTitle() {
        return VisalloProperties.TERM_MENTION_TITLE.getPropertyValue(termMention);
    }

    @Override
    public boolean shouldHighlight() {
        if (!super.shouldHighlight()) {
            return false;
        }
        return true;
    }

    @Override
    public JSONObject getInfoJson() {
        try {
            JSONObject infoJson = super.getInfoJson();
            infoJson.put("title", getTitle());
            infoJson.putOpt("conceptType", getConceptIri());
            infoJson.putOpt("snippet", getSnippet());
            return infoJson;
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
}
