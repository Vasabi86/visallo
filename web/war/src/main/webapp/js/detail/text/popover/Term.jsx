define([
    'create-react-class',
    'prop-types',
    'classnames',
    './Element',
    'util/dnd',
    'util/vertex/formatters'
], function(createReactClass, PropTypes, classNames, Element, dnd, F) {

    const sharedProps = {
        refId: PropTypes.string.isRequired,
        id: PropTypes.string.isRequired,
        start: PropTypes.number.isRequired,
        end: PropTypes.number.isRequired,
        sandboxStatus: PropTypes.string.isRequired,
        outVertexId: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired
    };
    const selectionProps = {
        mentionStart: PropTypes.number.isRequired,
        mentionEnd: PropTypes.number.isRequired,
        type: PropTypes.string.isRequired,
        snippet: PropTypes.string.isRequired
    };

    const url = src => `url(${src})`;
    const getSelectionText = snippet => {
        const el = document.createElement('div');
        el.innerHTML = snippet;
        return el.textContent;
    }

    const Actions = function(props) {
        const { actions } = props;
        if (actions.length) {
            return (
                <div className="buttons">
                    {actions.map(({ label, handler, classes = {} }) =>
                        (<button className={classNames('btn btn-mini', classes)} key={label} onClick={handler}>{label}</button>)
                    )}
                </div>
            )
        }
        return null;
    };
    const TermSelection = createReactClass({
        propTypes: {
            ...selectionProps
        },
        render() {
            const { onHoverTerm, onResolve, onProperty, onComment, canEdit, snippet } = this.props;
            const actions = canEdit ? [
                { label: 'Resolve', handler: this.onResolve, classes: { 'btn-success': true } },
                { label: 'Property', handler: onProperty },
                { label: 'Comment', handler: onComment }
            ] : [];

            return (
                <li className="termselection" onMouseEnter={onHoverTerm}>
                    <div className="icon" style={{ backgroundImage: url('../img/glyphicons_custom/selection.png') }} />
                    <section>
                        <Actions actions={actions} />
                        <h1><strong>Selection</strong></h1>
                        <article
                            title={getSelectionText(snippet)}
                            dangerouslySetInnerHTML={{ __html: snippet }} />
                    </section>
                </li>
            )
        },
        onResolve() {
            const { sign, mentionStart, mentionEnd, snippet } = this.props;
            this.props.onResolve({ sign, mentionStart, mentionEnd, snippet });
        }
    });
    const Justification = createReactClass({
        propTypes: {
            ...sharedProps,
            sandboxStatus: PropTypes.string.isRequired,
            termMentionFor: PropTypes.string.isRequired,
            snippet: PropTypes.string.isRequired,
            resolvedToVertexId: PropTypes.string,
            resolvedToEdgeId: PropTypes.string
        },
        render() {
            const { snippet, onHoverTerm, onOpen, onFullscreen, termMentionFor, resolvedToEdgeId, resolvedToVertexId, vertices, edges } = this.props;
            const actions = [
                { label: 'Open', handler: onOpen }
            ]
            const what = termMentionFor === 'PROPERTY' ? 'property' : 'creation';
            let element;
            if (termMentionFor === 'EDGE') {
                element = edges[resolvedToEdgeId]
            } else if (termMentionFor === 'VERTEX') {
                element = vertices[resolvedToVertexId]
            } else if (resolvedToVertexId) {
                element = vertices[resolvedToVertexId]
            } else if (resolvedToEdgeId) {
                element = edges[resolvedToEdgeId]
            }

            // Server sanitizes snippets so be dangerous
            return (
                <li className="justification" onMouseEnter={onHoverTerm}>
                    <div className="icon" style={{ backgroundImage: url('../img/glyphicons_custom/justification.png') }} />
                    <section>
                        <Actions actions={actions} />
                        <h1><strong>Justification</strong> on {what} of <Element element={element}/></h1>
                        <article
                            title={getSelectionText(snippet)}
                            dangerouslySetInnerHTML={{ __html: snippet }} />
                    </section>
                </li>
            )
        }
    })
    const Resolved = createReactClass({
        propTypes: {
            ...sharedProps,
            title: PropTypes.string.isRequired,
            termMentionFor: PropTypes.string.isRequired,
            resolvedToVertexId: PropTypes.string.isRequired,
            resolvedToEdgeId: PropTypes.string.isRequired,
            conceptType: PropTypes.string,
            process: PropTypes.string
        },
        onDragStart(event) {
            const { resolvedToVertexId, vertices } = this.props;
            const element = vertices[resolvedToVertexId];
            const data = element ? { elements: [element] } : { vertexIds: [resolvedToVertexId] }
            dnd.setDataTransferWithElements(event.dataTransfer, data);
        },
        render() {
            const {
                title,
                onOpen,
                onFullscreen,
                onUnresolve,
                onHoverTerm,
                canEdit,
                termMentionFor,
                sandboxStatus,
                conceptType,
                getConceptOrDefault,
                resolvedToVertexId,
                vertices
            } = this.props;
            const actions = [
                { label: 'Open', handler: onOpen }
            ]
            const canUnresolve = canEdit && termMentionFor === 'VERTEX' && sandboxStatus !== 'PUBLIC';
            if (canUnresolve) {
                actions.push({ label: 'Unresolve', handler: onUnresolve, classes: { 'btn-danger': true }})
            }
            const concept = getConceptOrDefault(conceptType);
            const element = vertices[resolvedToVertexId]

            return (
                <li className="resolved" onMouseEnter={onHoverTerm}>
                    {element && !F.vertex.imageIsFromConcept(element) ? (
                        <div className="icon image" style={{ backgroundImage: url(F.vertex.image(element, null, 30)) }} />
                    ) : (
                        <div className="icon" style={{ backgroundImage: url(concept.glyphIconHref) }} />
                    )}
                    <section>
                            <Actions actions={actions} />
                            <h1><strong>Resolved</strong> to <em>{concept.displayName}</em> <Element element={element} onDragStart={this.onDragStart}/></h1>
                        <article>
                            <span className="selection">{title}</span>
                        </article>
                    </section>
                </li>
            )
        }
    })
    const Suggestion = createReactClass({
        propTypes: {
            ...sharedProps,
            title: PropTypes.string.isRequired,
            process: PropTypes.string,
            conceptType: PropTypes.string
        },
        render() {
            const { title, process, conceptType, getConceptOrDefault, onHoverTerm, onProperty, canEdit } = this.props;
            const actions = [];
            const concept = getConceptOrDefault(conceptType);
            if (canEdit) {
                actions.push({ label: 'Resolve', handler: this.onResolve, classes: { 'btn-success': true } });
            }
            return (
                <li className="suggestion" onMouseEnter={onHoverTerm}>
                    <div className="icon" style={{ backgroundImage: url('../img/glyphicons/glyphicons_194_circle_question_mark@2x.png') }} />
                    <section>
                        <Actions actions={actions} />
                        <h1>
                            <strong>Probable</strong> <em>{concept.displayName}</em> found by <strong>{process}</strong>
                        </h1>
                        <article>
                            <span className="selection">{title}</span>
                        </article>
                    </section>
                </li>
            )
        },
        onResolve() {
            const {
                conceptType,
                start: mentionStart,
                end: mentionEnd,
                title: sign,
                id: resolvedFromTermMention
            } = this.props;
            this.props.onResolve({
                conceptType,
                mentionStart,
                mentionEnd,
                sign,
                resolvedFromTermMention
            });
        }
    })


    const Term = createReactClass({
        propTypes: {
            term: PropTypes.oneOfType([
                PropTypes.shape(sharedProps),
                PropTypes.shape(selectionProps)
            ]).isRequired,
            privileges: PropTypes.object.isRequired,
            actions: PropTypes.object.isRequired,
            getConceptOrDefault: PropTypes.func.isRequired
        },
        render() {
            const { term, privileges, actions, getConceptOrDefault, vertices, edges, ...rest } = this.props;
            const { type } = term;
            const addTermToActions = (func, name) => {
                if (name === 'onResolve') return func;
                return (event) => func(term, event);
            };
            const itemProps = {
                ...term,
                ..._.mapObject(actions, addTermToActions),
                getConceptOrDefault,
                vertices,
                edges,
                onHoverTerm: this.onHoverTerm,
                canEdit: privileges.EDIT,
            };

            switch (type) {
                case 'resolved': return (<Resolved {...itemProps} />);
                case 'suggestion': return (<Suggestion {...itemProps} />);
                case 'justification': return (<Justification {...itemProps} />);
                case 'selection': return (<TermSelection {...itemProps} />);
            }

            return null;
        },
        onHoverTerm(event) {
            this.props.onHoverTerm(this.props.term.refId);
        }
    });

    return Term;
});

