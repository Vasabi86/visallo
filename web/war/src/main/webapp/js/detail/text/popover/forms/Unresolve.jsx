define([
    'create-react-class',
    'prop-types',
    'classnames',
    '../Element'
], function(createReactClass, PropTypes, classNames, Element) {

    const Unresolve = createReactClass({
        render() {
            const { error, onCancel, loading, conceptType, getConceptOrDefault, vertices, resolvedToVertexId, title } = this.props;

            const concept = getConceptOrDefault(conceptType);
            const element = vertices[resolvedToVertexId];

            return (
                <div className="form">
                    { error ? (<Alert error={error} />) : null }

                    <h1>Unresolve Entity</h1>

                    <p>
                        Remove this resolved reference
                        to the <em>{concept.displayName}</em>
                        , <Element element={element} />?
                    </p>
                    <p style={{fontStyle: 'italic', color: '#999', fontSize: '90%'}}>Removes only the relationship, not the entity</p>

                    <div className="buttons">
                        <button onClick={onCancel} className="btn btn-link btn-small">Cancel</button>
                        <button onClick={this.onUnresolve} className={classNames('btn btn-danger btn-small', { loading })}>Unresolve</button>
                    </div>
                </div>
            )
        },
        onUnresolve() {
            this.props.onUnresolve(this.props.id);
        }
    });

    return Unresolve;
});
