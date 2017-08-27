define([
    'create-react-class',
    'prop-types',
    'util/vertex/formatters'
], function(createReactClass, PropTypes, F) {

    const Element = createReactClass({
        propTypes: {
            element: PropTypes.shape({
                id: PropTypes.string.isRequired,
                properties: PropTypes.array.isRequired
            })
        },
        render() {
            const { element, ...rest } = this.props;

            if (element) {
                const title = F.vertex.title(element);
                const concept = F.vertex.concept(element);
                return (
                    <span
                        className="element"
                        title={`${title}\nClick and hold to drag`}
                        style={{borderBottomColor: concept.color || '#000'}}
                        draggable
                        {...rest}>{title}</span>
                );
            }

            return (<span className="loading">Loading…</span>)
        }
    });

    return Element;
});
