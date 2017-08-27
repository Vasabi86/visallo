define([
    'create-react-class',
    'prop-types',
    'components/Attacher',
    'components/Alert'
], function(
    createReactClass,
    PropTypes,
    Attacher,
    Alert) {

    const Property = createReactClass({
        propTypes: {
            onCancel: PropTypes.func.isRequired,
            onSave: PropTypes.func.isRequired,
            attemptToCoerceValue: PropTypes.string,
            sourceInfo: PropTypes.object
        },
        render() {
            const { onCancel, onSave, attemptToCoerceValue, sourceInfo } = this.props;

            return (
                <div className="form" style={{padding: 0}}>
                    { this.props.error ? (<Alert error={this.props.error} />) : null }

                    <h1 style={{marginBottom: '-0.3em', padding: '0.5em 1em 0'}}>Set Property with Justification</h1>

                    <Attacher
                        componentPath="detail/dropdowns/propertyForm/propForm"
                        behavior={{
                            addProperty: (inst, { node, ...data }) => {
                                const { vertexId: elementId, isEdge, property } = data;
                                onSave({
                                    elementId,
                                    type: isEdge ? 'edge' : 'vertex',
                                    property
                                })
                            },
                            closeDropdown: () => {
                                onCancel();
                            }
                        }}
                        allowDeleteProperty={false}
                        allowEditProperty={false}
                        disableDropdownFeatures={true}
                        attemptToCoerceValue={attemptToCoerceValue}
                        sourceInfo={sourceInfo} />
                </div>
            )
        }
    });

    return Property;
});
