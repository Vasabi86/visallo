
define([
    'flight/lib/component',
    'util/component/attacher',
    'components/justification/JustificationEditor'
], function(
    defineComponent,
    Attacher,
    JustificationEditor
) {
    'use strict';

    return defineComponent(Justification);

    function Justification() {

        //this.defaultAttrs({
            //justificationOverride: false
        //});

        this.after('teardown', function() {
            this.attacher.teardown();
        })

        this.after('initialize', function() {
            this.attacher = Attacher()
                .component(JustificationEditor)
                .behavior({
                    onJustificationChanged: (attacher, justification) => {
                        const params = attacher._params;
                        const { valid, value } = justification;
                        attacher.params({ ...params, value }).attach();
                        this.trigger('justificationchange', justification);
                    }
                })
                .node(this.node)

            this.attacher.attach();
        });
    }
});
