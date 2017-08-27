define([
    'flight/lib/component',
    'util/component/attacher'
], function(
    defineComponent,
    attacher) {
    'use strict';

    return defineComponent(VertexSelector);

    function VertexSelector() {

        this.before('teardown', function() {
            this._attacher.teardown();
            this._attacher = null;
        });

        this.after('initialize', function() {
            const { value = '', placeholder, focus } = this.attr;

            this._attacher = attacher()
                .node(this.node)
                .path('components/ElementSelector')
                .params({ value, placeholder, autofocus: focus === true })
                .behavior({
                    onElementSelected: (attacher, element) => {
                         this.trigger('elementSelected', { element })
                    }
                });

            this._attacher.attach()
        });

    }
});
