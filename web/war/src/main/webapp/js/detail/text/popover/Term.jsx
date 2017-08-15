define([
    'create-react-class',
    'prop-types'
], function(createReactClass, PropTypes) {
    const sharedProps = {
        id: PropTypes.string.isRequired,
        start: PropTypes.number.isRequired,
        end: PropTypes.number.isRequired,
        sandboxStatus: PropTypes.string.isRequired,
        outVertexId: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired
    };

    const Actions = function(props) {
        const { actions } = props;
        if (actions.length) {
            return (
                <div className="buttons">
                    {actions.map(({ label, handler }) =>
                        (<button key={label} onClick={handler}>{label}</button>)
                    )}
                </div>
            )
        }
        return null;
    };
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
            const { snippet, onOpen, onFullscreen, termMentionFor, resolvedToEdgeId, resolvedToVertexId } = this.props;
            const actions = [
                { label: 'Open', handler: onOpen },
                { label: 'Fullscreen', handler: onFullscreen }
            ]
            // TODO: Check snippet for xss issues
            return (
                <li>
                    <h1 dangerouslySetInnerHTML={{ __html: snippet }} />
                    <h2>{ termMentionFor }</h2>
                    <h3>{ resolvedToVertexId || resolvedToEdgeId }</h3>
                    <Actions actions={actions} />
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
        render() {
            const {
                title,
                onOpen,
                onFullscreen,
                onUnresolve,
                canEdit,
                termMentionFor,
                sandboxStatus
            } = this.props;
            const actions = [
                { label: 'Open', handler: onOpen },
                { label: 'Fullscreen', handler: onFullscreen }
            ]
            const canUnresolve = canEdit && termMentionFor === 'VERTEX' && sandboxStatus !== 'PUBLIC';
            if (canUnresolve) {
                actions.push({ label: 'Unresolve', handler: onUnresolve })
            }
            return (
                <li>
                    <h1>{ title }</h1>
                    <Actions actions={actions} />
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
            const { title, process, conceptType, onResolve, onProperty, canEdit } = this.props;
            const actions = [
                { label: 'Property', handler: onProperty }
            ];
            if (canEdit) {
                actions.push({ label: 'Resolve', handler: this.onResolve });
            }
            return (
                <li>
                    <h1>{ title }</h1>
                    <h2>{ conceptType } { process }</h2>
                    <Actions actions={actions} />
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
            })
        }
    })

    const Term = createReactClass({
        propTypes: {
            term: PropTypes.shape(sharedProps).isRequired,
            privileges: PropTypes.object.isRequired,
            actions: PropTypes.object.isRequired
        },
        render() {
            const { term, privileges, actions, ...rest } = this.props;
            const { type } = term;
            const itemProps = {
                ...term,
                ...actions,
                canEdit: privileges.EDIT,
            };

            switch (type) {
                case 'resolved': return (<Resolved {...itemProps} />);
                case 'suggestion': return (<Suggestion {...itemProps} />);
                case 'justification': return (<Justification {...itemProps} />);
            }

            return null;
        }
    });

    return Term;
});

