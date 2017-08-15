define([
    'create-react-class',
    'prop-types',
    'react-redux',
    'data/web-worker/store/user/selectors',
    'components/Attacher',
    './TermList',
    './TermSelection',
    './forms/Resolve'
], function(
    createReactClass,
    PropTypes,
    redux,
    userSelectors,
    Attacher,
    TermList,
    TermSelection,
    Resolve) {

    const TermContainer = createReactClass({
        propTypes: {
            artifactId: PropTypes.string.isRequired,
            propertyKey: PropTypes.string.isRequired,
            propertyName: PropTypes.string.isRequired,
            terms: PropTypes.array,
            selection: PropTypes.object
        },
        getInitialState() {
            return { viewing: { type: 'list' } };
        },
        render() {

            return (
                <div className="detail-text-terms-popover">
                    {this.getContent()}
                </div>
            )
        },
        getContent() {
            const { terms, selection, ...rest } = this.props;
            const { viewing } = this.state;
            const actions = {
                onOpen: this.onOpen,
                onFullscreen: this.onFullscreen,
                onUnresolve: this.onUnresolve,
                onResolve: this.onResolve,
                onProperty: this.onProperty,
                onComment: this.onComment
            };

            switch (viewing.type) {

                case 'list':
                    return terms ?
                        (<TermList actions={actions} terms={terms} {...rest} />) :
                        selection ?
                        (<TermSelection actions={actions} selection={selection} {...rest} />) :
                        null

                case 'resolve':
                    return (<Resolve onResolve={this.doResolve} onCancel={this.onViewList} {...viewing.data} />);
            }
        },
        onViewList() {
            this.setState({ viewing: { type: 'list' } });
        },
        onOpen() { console.log('Open')},
        onFullscreen() { console.log('Fullscreen')},
        onUnresolve() { console.log('Unresolve')},
        onResolve(params) {
            const { artifactId, propertyName, propertyKey } = this.props;
            const data = {...params, artifactId, propertyName, propertyKey };
            this.setState({
                viewing: { type: 'resolve', data }
            });
        },
        onProperty() { console.log('Property')},
        onComment() { console.log('Comment')},

        doResolve(info) {
            console.log('info', info)

            this.props.visalloApi.v1.dataRequest('vertex', 'resolveTerm', info)
            .then(result => {
                this.props.closeDialog();
            })
            .catch(error => {
                console.error(error)
            })
        }
    });

    return redux.connect(
        (state, props) => {
            return {
                privileges: userSelectors.getPrivileges(state),
                ...props
            };
        },

        (dispatch, props) => ({
        })
    )(TermContainer);
});
