define([
    'create-react-class',
    'prop-types',
    'react-redux',
    'data/web-worker/store/user/selectors',
    'data/web-worker/store/selection/actions',
    'data/web-worker/store/element/actions',
    'data/web-worker/store/ontology/selectors',
    'data/web-worker/store/element/selectors',
    './TermList',
    './TermSelection',
    './forms/Resolve',
    './forms/Unresolve',
    './forms/Property'
], function(
    createReactClass,
    PropTypes,
    redux,
    userSelectors,
    selectionActions,
    elementActions,
    ontologySelectors,
    elementSelectors,
    TermList,
    TermSelection,
    Resolve,
    Unresolve,
    Property) {

    const THING = 'http://www.w3.org/2002/07/owl#Thing';
    const TermContainer = createReactClass({
        propTypes: {
            onOpen: PropTypes.func.isRequired,
            onFullscreen: PropTypes.func.isRequired,
            onComment: PropTypes.func.isRequired,
            artifactId: PropTypes.string.isRequired,
            propertyKey: PropTypes.string.isRequired,
            propertyName: PropTypes.string.isRequired,
            terms: PropTypes.array,
            selection: PropTypes.object
        },
        getInitialState() {
            return { viewing: { type: 'list' } };
        },
        componentDidMount() {
            this._checkForElementsNeeded(this.props);
        },
        componentWillReceiveProps(nextProps) {
            this._checkForElementsNeeded(nextProps);
        },
        render() {
            return (
                <div>
                    {this.getContent()}
                </div>
            )
        },
        getContent() {
            const { terms, selection, onOpen, onComment, onFullscreen, concepts, ...rest } = this.props;
            const { viewing, error, loading } = this.state;
            const formState = { error, loading };
            const actions = {
                onOpen,
                onFullscreen,
                onComment,
                onUnresolve: this.onUnresolve,
                onResolve: this.onResolve,
                onProperty: this.onProperty
            };

            rest.getConceptOrDefault = function(iri = THING) {
                return concepts[iri] || concepts[THING];
            }

            switch (viewing.type) {

                case 'list':
                    return (
                        <TermList actions={actions} selection={selection} terms={terms} {...rest} />
                    );

                case 'resolve':
                    return (
                        <Resolve
                            onResolve={this.doResolve}
                            onCancel={this.onViewList}
                            {...viewing.data}
                            {...rest}
                            {...formState} />
                    );

                case 'unresolve':
                    return (
                        <Unresolve
                            onUnresolve={this.doUnresolve}
                            onCancel={this.onViewList}
                            {...viewing.data}
                            {...rest}
                            {...formState} />
                    )

                case 'property':
                    return (
                        <Property
                            onSave={this.doProperty}
                            onCancel={this.onViewList}
                            {...viewing.data}
                            {...rest}
                            {...formState} />
                    )
            }
        },
        onViewList() {
            this.setState({ error: null, viewing: { type: 'list' } });
        },
        _dataForTerm(term) {
            const { artifactId, propertyName, propertyKey } = this.props;
            const data = {
                ...term,
                artifactId,
                propertyName,
                propertyKey
            };
            return data;
        },
        onUnresolve(term) {
            this.setState({
                viewing: { type: 'unresolve', data: this._dataForTerm(term) }
            })
        },
        onResolve(term) {
            this.setState({
                viewing: { type: 'resolve', data: this._dataForTerm(term) }
            });
        },
        onProperty(term) {
            const { artifactId, propertyName, propertyKey } = this.props;
            const { snippet, mentionEnd, mentionStart, sign } = term;
            this.setState({
                viewing: {
                    type: 'property',
                    data: {
                        attemptToCoerceValue: sign,
                        sourceInfo: {
                            startOffset: mentionStart,
                            endOffset: mentionEnd,
                            snippet,
                            vertexId: artifactId,
                            textPropertyKey: propertyKey,
                            textPropertyName: propertyName
                        }
                    }
                }
            })
        },
        doResolve(data) {
            this._do('vertex', 'resolveTerm', data)
        },
        doUnresolve(termMentionId) {
            this._do('vertex', 'unresolveTerm', { termMentionId })
        },
        doProperty(data) {
            const { type, elementId, property } = data;
            this._do(type, 'setProperty', elementId, property);
        },
        _do(...params) {
            this.setState({ error: null, loading: true })
            this.props.visalloApi.v1.dataRequest(...params)
                .then(result => {
                    this.props.reloadText();
                    this.props.closeDialog();
                })
                .catch(error => {
                    console.error(error)
                    this.setState({ error, loading: false })
                })
        },
        _checkForElementsNeeded(props) {
            if (props.terms) {
                if (!this._requestingIds) {
                    this._requestingIds = {};
                }

                const types = { vertices: [], edges: [] };
                const { vertices, edges } = types;
                const add = (type, id) => {
                    if (!(id in props[type]) && !(id in this._requestingIds)) {
                        this._requestingIds[id] = true;
                        types[type].push(id);
                    }
                }
                props.terms.forEach(term => {
                    if (term.resolvedToVertexId) add('vertices', term.resolvedToVertexId)
                    else if (term.resolvedToEdgeId) add('edges', term.resolvedToEdgeId)
                });

                if (vertices.length || edges.length) {
                    props.requestElements({ vertices, edges })
                }
            }
        }
    });

    return redux.connect(
        (state, props) => {
            const extra = {};
            if (props.terms) {
                const vertices = elementSelectors.getVertices(state);
                const edges = elementSelectors.getEdges(state);
                const vertexIds = [], edgeIds = [];
                props.terms.forEach(term => {
                    if (term.resolvedToVertexId) vertexIds.push(term.resolvedToVertexId)
                    if (term.resolvedToEdgeId) edgeIds.push(term.resolvedToEdgeId)
                });
                extra.vertices = _.pick(vertices, vertexIds);
                extra.edges = _.pick(edges, edgeIds);
            }

            return {
                privileges: userSelectors.getPrivileges(state),
                concepts: ontologySelectors.getConcepts(state),
                ...extra,
                ...props
            }
        },

        (dispatch, {
            closeDialog,
            comment,
            openFullscreen,
            artifactId,
            propertyKey,
            propertyName
        }) => ({
            requestElements({ vertices, edges }) {
                dispatch(elementActions.get({ vertexIds: vertices, edgeIds: edges }));
            },
            onComment({ mentionStart, mentionEnd, snippet }) {
                closeDialog();
                comment({
                    startOffset: mentionStart,
                    endOffset: mentionEnd,
                    snippet,
                    vertexId: artifactId,
                    textPropertyKey: propertyKey,
                    textPropertyName: propertyName
                });
            },
            onFullscreen(term) {
                closeDialog();
                openFullscreen(term.resolvedToVertexId)
            },
            onOpen(term) {
                closeDialog();
                dispatch(selectionActions.set({ vertices: [term.resolvedToVertexId] }));
            }
        })
    )(TermContainer);
});
