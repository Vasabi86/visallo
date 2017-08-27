define([
    'flight/lib/component',
    'util/popovers/withPopover',
    'util/component/attacher'
], function(
    defineComponent,
    withPopover,
    Attacher) {

    return defineComponent(TextPopover, withPopover);

    function TextPopover() {

        this.before('teardown', function() {
            this.attacher.teardown();
        })

        this.before('initialize', function(node, config) {
            config.hideDialog = true;
            config.template = '/detail/text/popover/popover.hbs';
            this.after('setupWithTemplate', () => {
                const { selection, terms, artifactId, propertyName, propertyKey } = this.attr;

                this.attacher = Attacher()
                    .node(this.popover.find('.popover-content'))
                    .path('detail/text/popover/TermContainer')
                    .params({ selection, terms, artifactId, propertyName, propertyKey })
                    .behavior({
                        hoverTerm: (attacher, id) => {
                            this.trigger('hoverTerm', { id });
                        },
                        comment: (attacher, sourceInfo) => {
                            this.trigger('commentOnSelection', sourceInfo);
                        },
                        openFullscreen: (attacher, vertexId) => {
                            this.trigger(document, 'openFullscreen', { vertexIds: [vertexId] });
                        },
                        reloadText: () => {
                            this.trigger(document, 'textUpdated', { vertexId: artifactId });
                        },
                        closeDialog: () => {
                            this.teardown();
                        }
                    });

                this.attacher.attach().then(() => {
                    this.dialog.show();
                    this.positionDialog();
                })
            })
        })
    }
});
