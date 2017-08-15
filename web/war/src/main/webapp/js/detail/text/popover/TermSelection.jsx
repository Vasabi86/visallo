define([
    'create-react-class',
    'prop-types'
], function(createReactClass, PropTypes) {

    const TermSelection = createReactClass({
        propTypes: {
            selection: PropTypes.shape({
                mentionEnd: PropTypes.number.isRequired,
                mentionStart: PropTypes.number.isRequired,
                sign: PropTypes.string.isRequired,
                snippet: PropTypes.string.isRequired
            }).isRequired,
            privileges: PropTypes.object.isRequired,
            actions: PropTypes.object.isRequired
        },
        getInitialState() {
            return {};
        },
        componentDidUpdate() {
            this.props.positionDialog();
        },
        render() {
            const { selection, actions, privileges } = this.props;
            const { sign, mentionStart, mentionEnd } = selection;

            return (
                <div>
                    <h1>{ sign }</h1>
                    <p>{ mentionStart }, { mentionEnd }</p>
                    { privileges.EDIT ? (
                        <div className="buttons">
                            <button onClick={this.onResolve}>Entity</button>
                            <button onClick={this.onProperty}>Property</button>
                            <button onClick={this.onComment}>Comment</button>
                        </div>
                    ) : null
                    }
                </div>
            )
        },
        onResolve() {
            this.props.actions.onResolve(this.props.selection);
        },
        onProperty() {
        },
        onComment() {
        },
    });

    return TermSelection;
});
