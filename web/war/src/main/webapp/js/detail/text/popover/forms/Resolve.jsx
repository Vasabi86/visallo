define([
    'create-react-class',
    'prop-types',
    'components/ElementSelector',
    'components/ontology/ConceptSelector',
    //'components/Attacher',
    'components/justification/JustificationEditor',
    'components/visibility/VisibilityEditor',
    'util/vertex/formatters'
], function(createReactClass, PropTypes, ElementSelector, ConceptSelector, JustificationEditor, VisibilityEditor, F) {

    const Resolve = createReactClass({
        propTypes: {
            artifactId: PropTypes.string.isRequired,
            propertyKey: PropTypes.string.isRequired,
            propertyName: PropTypes.string.isRequired,
            mentionEnd: PropTypes.number.isRequired,
            mentionStart: PropTypes.number.isRequired,
            sign: PropTypes.string.isRequired,
            onCancel: PropTypes.func.isRequired,
            onResolve: PropTypes.func.isRequired,
            resolvedFromTermMention: PropTypes.string,
            conceptType: PropTypes.string
        },
        getInitialState() {
            return {
                visibility: { value: '', valid: true },
                conceptId: this.props.conceptType
            }
        },
        render() {
            const { onCancel, sign, conceptType, ...rest } = this.props;
            const { resolvedVertexId, newElementText, conceptId, justification = {}, visibility } = this.state;
            const { valid: justificationValid, value: justificationValues } = justification

            return (
                <div className="form">
                    <h1>{ resolvedVertexId ? 'Resolve to Existing Entity' :
                        newElementText ? 'Resolve to New Entity' : 'Search for Entities' }</h1>
                    <ElementSelector
                        creatable
                        filterResultsToTitleField
                        searchOptions={{ matchType: 'vertex' }}
                        value={sign}
                        placeholder="Resolve To…"
                        onElementSelected={this.onElementSelected}
                        onCreateNewElement={this.onCreateNewElement}
                        createNewRenderer={value => `Create "${value}" Entity`}
                        createNewValueRenderer={value => value } />
                    { (resolvedVertexId || newElementText) ? (
                        <div>
                            { !resolvedVertexId && newElementText ?
                                (<ConceptSelector
                                    clearable={conceptId !== conceptType}
                                    onSelected={this.onConceptSelected}
                                    value={conceptId || conceptType || ''} />) : null
                            }

                            <JustificationEditor
                                value={justificationValues}
                                onJustificationChanged={this.onJustificationChanged}
                                />


                            <VisibilityEditor
                                value={visibility && visibility.value}
                                onVisibilityChanged={this.onVisibilityChanged} />
                        </div>
                    ) : null }
                    <div className="buttons">
                        <button onClick={onCancel} className="btn btn-link">Cancel</button>
                        <button disabled={!this.isValid()} onClick={this.onResolve} className="btn-primary btn">Resolve</button>
                    </div>
                </div>
            )
        },
        onResolve() {
            const {
                artifactId, propertyName, propertyKey,
                resolvedFromTermMention, sign: initialSign,
                mentionStart, mentionEnd
            } = this.props;

            const {
                resolvedVertexId, newElementText: sign,
                conceptId, justification, visibility
            } = this.state;

            this.props.onResolve({
                visibilitySource: visibility.value,
                artifactId,
                propertyName,
                propertyKey,
                resolvedFromTermMention,
                mentionStart,
                mentionEnd,
                ...justification.value,
                ...(resolvedVertexId ? { resolvedVertexId, sign: initialSign } : { sign, conceptId })
            })
        },
        onElementSelected(element) {
            this.setState({ resolvedVertexId: element ? element.id : null, newElementText: null })
        },
        onCreateNewElement(text) {
            this.setState({ newElementText: text, resolvedVertexId: null })
        },
        onConceptSelected(concept) {
            const { conceptType } = this.props;
            this.setState({ conceptId: concept ? concept.id : conceptType })
        },
        onJustificationChanged(justification) {
            this.setState({ justification })
        },
        onVisibilityChanged(visibility) {
            this.setState({ visibility })
        },
        isValid() {
            const { resolvedVertexId, newElementText, conceptId, justification, visibility } = this.state;
            const entity = resolvedVertexId || (newElementText && conceptId);
            const others = _.all([justification, visibility], o => o && o.valid);
            return entity && others;
        }
    });

    return Resolve;
});
