define([
    'create-react-class',
    'prop-types',
    './Term'
], function(createReactClass, PropTypes, Term) {

    const TermList = createReactClass({
        propTypes: {
            terms: PropTypes.array.isRequired
        },
        render() {
            const { terms, ...rest } = this.props;

            const transformed = terms.map(term => {
                const { termMentionFor, resolvedToEdgeId, resolvedToVertexId } = term;
                const resolved = resolvedToVertexId && resolvedToEdgeId;
                let type;
                if (resolved) type = 'resolved';
                else if (termMentionFor) type = 'justification';
                else type = 'suggestion';
                return { ...term, type };
            })
            const order = ['resolved', 'suggestion', 'justification'];
            const sorted = _.sortBy(transformed, ({ type }) => order.indexOf(type));

            if (terms.length) {
                return (
                    <ul>
                        { sorted.map(term => <Term key={term.id} term={term} {...rest} />) }
                    </ul>
                )
            }

            return (<div>No Terms</div>);
        }
    });

    return TermList;
});
