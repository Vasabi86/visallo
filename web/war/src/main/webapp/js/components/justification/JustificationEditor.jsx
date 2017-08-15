define([
    'create-react-class',
    'prop-types',
    'react-redux',
    'react-transition-group'
], function(createReactClass, PropTypes, redux, ReactTransitionGroup) {

    const { Transition, TransitionGroup } = ReactTransitionGroup;
    const getHeight = elem => {
        return elem.offsetHeight;
    }
    const forceLayout = node => {
        node.offsetHeight; // eslint-disable-line no-unused-expressions
    }
    const DEFAULT = { justificationText: '', sourceInfo: null };
    const JustificationEditor = createReactClass({
        propTypes: {
            validation: PropTypes.string.isRequired,
            value: PropTypes.shape({
                justificationText: PropTypes.string,
                sourceInfo: PropTypes.object
            }),
            onJustificationChanged: PropTypes.func.isRequired
        },
        getInitialState() {
            return { height: 'auto' };
        },
        componentDidMount() {
            const { value = DEFAULT } = this.props;
            const valid = this.checkValid(value);
            this.props.onJustificationChanged({ value, valid })
        },
        render() {
            const { value = DEFAULT, validation } = this.props;
            const { height } = this.state;
            const { justificationText, sourceInfo } = value;

            if (validation === 'NONE') {
                return null;
            }

            const duration = 250;
            const showJustification = _.isEmpty(value.sourceInfo);
            const showSourceInfo = !showJustification

            return (
                <div className="justification">
                    <Transition in={showSourceInfo} timeout={duration}
                        onEnter={this.onEnter}
                        onEntering={this.onEntering}
                        onEntered={this.onEntered}
                        onExit={this.onExit}
                        onExiting={this.onExiting}
                        onExited={this.onExited}>
                            {(state) => (
                                <div className="animationwrap" style={{
                                    overflow: ['entering', 'exiting'].includes(state) ? 'hidden' : '',
                                    position: 'relative',
                                    transition: `height ${duration}ms ease-in-out`
                                }}>
                                    <div ref={r => {this.textRef = r;}} style={{
                                        display: state === 'entered' ? 'none' : '',
                                        visibility: state === 'entering' ? 'hidden' : ''}}>
                                        {this.renderJustificationInput(justificationText)}
                                    </div>
                                    {sourceInfo ? (
                                    <div ref={r => {this.sourceInfoRef = r;}} style={{
                                        ...(state === 'entered' ? {} : { position: 'absolute', top: '0', left: '0' })
                                    }}>{this.renderSourceInfo(sourceInfo)}</div>
                                    ) : null }
                                </div>
                            )}
                    </Transition>
                </div>
            )
        },
        onEnter(node) {
            node.style.overflow = 'hidden';
            this._justificationHeight = getHeight(node) + 'px';
            this._sourceInfoHeight = getHeight(this.sourceInfoRef) + 'px';
            node.style.overflow = null;
            node.style.height = this._justificationHeight;
            forceLayout(node);
        },
        onEntering(node) {
            node.style.height = this._sourceInfoHeight;
        },
        onEntered(node) {
            this.resetHeight(node);
            $(node).animatePop();
        },
        resetHeight(node) {
            node.style.height = null;
        },
        onExit(node) {
            node.style.height = this._sourceInfoHeight;
            forceLayout(node);
        },
        onExited(node) {
            this.resetHeight(node);
            this._justificationTextInput.focus()
        },
        onEndTransition(node) {
            this._justificationTextInput.focus()
        },
        onExiting(node) {
            node.style.height = this._justificationHeight;
        },
        renderSourceInfo(sourceInfo) {
            const { snippet } = sourceInfo;
            const title = 'TODO'
            return (
                <div className="viewing">
                    <span className="text" dangerouslySetInnerHTML={{ __html: snippet }} />
                    <span className="source"><strong>Reference:</strong> {title}</span>
                    <button className="remove" onClick={this.onRemoveSourceInfo}>Remove</button>
                </div>
            );
        },
        renderJustificationInput(justificationText) {
            const { validation } = this.props;
            return (
                <input
                    ref={r => {this._justificationTextInput = r;}}
                    data-title="<strong>Include a Reference</strong><br>Paste snippet from document text"
                    data-placement="left"
                    data-trigger="focus"
                    data-html="true"
                    className="editing"
                    onChange={this.onChange}
                    onPaste={this.onPaste}
                    placeholder={validation === 'OPTIONAL' ?
                        'Justification is optional' :
                        'Justification is required'}
                    type="text"
                    value={justificationText || ''} />
            )
        },
        onPaste(event) {
            const target = event.target;
            _.defer(() => {
                const sourceInfo = this.sourceInfoForText(target.value);
                if (sourceInfo) {
                    this.setSourceInfo(sourceInfo);
                } else {
                    this.setJustificationText(target.value);
                }
            });
        },
        onChange(event) {
            this.setJustificationText(event.target.value);
        },
        onRemoveSourceInfo() {
            this.setSourceInfo(null);
        },
        setJustificationText(justificationText) {
            const value = { justificationText }
            const valid = this.checkValid(value);
            this.props.onJustificationChanged({ value, valid })
        },
        setSourceInfo(sourceInfo) {
            const value = { sourceInfo }
            const valid = this.checkValid(value);
            this.props.onJustificationChanged({ value, valid })
        },
        sourceInfoForText(text) {
            var clipboard = visalloData.copiedDocumentText,
                normalizeWhiteSpace = function(str) {
                    return str.replace(/\s+/g, ' ');
                };

            if (clipboard && normalizeWhiteSpace(clipboard.text) === normalizeWhiteSpace(text)) {
                return clipboard;
            }
        },
        checkValid(value) {
            const { validation } = this.props;
            if (validation === 'NONE' || validation === 'OPTIONAL') {
                return true;
            }
            const { justificationText = '', sourceInfo } = value;

            if (!_.isEmpty(sourceInfo)) {
                return true;
            }

            if (justificationText.trim().length) {
                return true;
            }

            return false;
        }
    });

    return redux.connect(
        (state, props) => {
            const { properties } = state.configuration;
            return {
                validation: properties['field.justification.validation'],
                ...props
            };
        },

        (dispatch, props) => ({})
    )(JustificationEditor);
});
