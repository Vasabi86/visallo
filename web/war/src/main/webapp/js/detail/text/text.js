define([
    'flight/lib/component',
    'util/vertex/formatters',
    'configuration/plugins/registry',
    'util/css-stylesheet',
    'util/withDataRequest',
    'util/privileges',
    'util/jquery.withinScrollable',
    'util/withCollapsibleSections',
    'util/popovers/propertyInfo/withPropertyInfo',
    'util/popovers/withElementScrollingPositionUpdates',
    'util/dnd',
    'util/service/propertiesPromise',
    'colorjs',
    './transcriptEntries.hbs',
    'tpl!util/alert',
    'require',
    'sf'
], function(
    defineComponent,
    F,
    registry,
    stylesheet,
    withDataRequest,
    Privileges,
    jqueryWithinScrollable,
    withCollapsibleSections,
    withPropertyInfo,
    withElementScrollingPositionUpdates,
    dnd,
    config,
    colorjs,
    transcriptEntriesTemplate,
    alertTemplate,
    require,
    sf) {
    'use strict';

    const STYLE_STATES = { NORMAL: 0, HOVER: 1 };
    const CONFIG_MAX_SELECTION_PARAGRAPHS =
        config['detail.text.max.selection.paragraphs'] ?
        parseInt(config['detail.text.max.selection.paragraphs'], 10) : 5;
    const TEXT_PROPERTIES = [
        'http://visallo.org#videoTranscript',
        'http://visallo.org#text'
    ];
    const PREVIEW_SELECTORS = {
        audio: 'div .audio-preview',
        video: '.org-visallo-video'
    };

    const hasValidOffsets = data => {
        return _.isObject(data) &&
            _.isFinite(data.startOffset) &&
            _.isFinite(data.endOffset) &&
            data.startOffset >= 0 &&
            data.endOffset > data.startOffset;
    }

    var rangeUtils, d3, textStylesheet;

    /**
     * Replaces the content of a collapsible text section in the element
     * inspector.
     *
     * Only one extension can replace a given text section, the first one will
     * win.
     *
     * @param {string} componentPath The component to render instead of the text
     * @param {org.visallo.detail.text~shouldReplaceTextSectionForVertex} shouldReplaceTextSectionForVertex Whether the component should be rendered instead of the default
     */
    registry.documentExtensionPoint('org.visallo.detail.text', 'Replace Extracted Text with custom component', function(e) {
        return _.isFunction(e.shouldReplaceTextSectionForVertex) && _.isString(e.componentPath);
    }, 'http://docs.visallo.org/extension-points/front-end/detailText')

    return defineComponent(
        Text,
        withDataRequest,
        withCollapsibleSections,
        withPropertyInfo,
        withElementScrollingPositionUpdates
    );

    function descriptionProperty(p) {
        var textDescription = 'http://visallo.org#textDescription';
        return p[textDescription] || p.metadata[textDescription] || p.key || p.name;
    }

    function textPropertySort(p) {
        if (p.key === '') {
            return '1' + descriptionProperty(p);
        }
        return '0' + descriptionProperty(p);
    }

    function textPropertyId(p) {
        return p.name + (p.key || '')
    }

    function Text() {

        this.attributes({
            termsSelector: '.jref,.resolved,.resolvable',
            resolvedSelector: '.resolved',
            textSelector: '.text',
            avLinkSelector: '.av-link',
            detailSectionContainerSelector: '.org-visallo-layout-body',
            model: null
        });

        this.after('teardown', function() {
            if (this.scrollNode) {
                this.scrollNode.off('scrollstop scroll');
            }
            if (this.textExtension) {
                this.textExtension.teardown();
            }
            this.$node.off('mouseleave', this.attr.termsSelector);
        });

        this.after('initialize', function() {
            var self = this;
            if (textStylesheet) {
                textStylesheet.remove();
            }
            textStylesheet = stylesheet.addSheet();


            this.loadRule = _.memoize(this.loadRule.bind(this), function(color, selector, state) {
                return color + '|' + selector + '|' + state;
            });

            this.dataRequest('ontology', 'concepts').then(concepts => {
                this.concepts = concepts;
            })
            this.on(document, 'ontologyUpdated', this.updateEntityAndArtifactDraggables);

            this.on('mousedown mouseup click dblclick contextmenu', this.trackMouse);
            this.on(document, 'keyup', this.handleKeyup);

            this.updateEntityAndArtifactDraggablesNoDelay = this.updateEntityAndArtifactDraggables;
            this.updateEntityAndArtifactDraggables = _.throttle(this.updateEntityAndArtifactDraggables.bind(this), 250);

            this.around('onToggleCollapsibleSection', function(fn, event) {
                var args = _.rest(arguments, 1),
                    $section = $(event.target).closest('.text-section'),
                    key = $section.attr('data-key'),
                    propertyName = $section.attr('data-name');

                event.stopPropagation();
                if ($section.hasClass('expanded') || !$section.find('.text').is(':empty')) {
                    fn.apply(this, args);
                } else {
                    return this.openText(key, propertyName);
                }
            });

            this.model = this.attr.model;
            this.on('updateModel', function(event, data) {
                this.model = data.model;
                this.updateText();
            });
            this.on('click', {
                termsSelector: this.onTermClick,
                avLinkSelector: this.onAVLinkClick
            });
            this.on('focusOnSnippet', this.onFocusOnSnippet);
            this.on('editProperty', this.onEditProperty);
            this.on('copy cut', {
                textSelector: this.onCopyText
            });
            this.on('dropdownClosed', this.onDropdownClosed);
            this.on(document, 'textUpdated', this.onTextUpdated);

            this.on('mouseover', { termsSelector: this.onHoverOver });
            this.$node.on('mouseleave', this.attr.termsSelector, this.onHoverLeave.bind(this));

            this.scrollNode = self.$node.scrollParent()
                .css('position', 'relative')
                .on('scrollstop', self.updateEntityAndArtifactDraggables)
                .on('scroll', self.updateEntityAndArtifactDraggables);
            this.updateText();
            this.updateEntityAndArtifactDraggables();
        });

        this.onEditProperty = function(evt, data) {
            var self = this,
                root = $('<div class="underneath">'),
                section = $(evt.target).closest('.text-section'),
                text = section.find('.text'),
                property = data && data.property;

            evt.stopPropagation();

            Promise.all([
                Promise.require('detail/dropdowns/propertyForm/propForm'),
                // Wait for expansion
                section.hasClass('expanded') ? Promise.resolve() : self.onToggleCollapsibleSection(evt)
            ]).spread(function(PropertyForm) {
                if (text.length) {
                    root.prependTo(text);
                }

                PropertyForm.teardownAll();
                PropertyForm.attachTo(root, {
                    data: self.model,
                    property: property
                });
            });
        };

        this.onFocusOnSnippet = function(event, data) {
            var self = this;
            Promise.resolve(this.updatingPromise)
                .then(function() {
                    return self.openText(data.textPropertyKey, data.textPropertyName)
                })
                .then(function() {
                    var $text = self.$node.find('.ts-' +
                            F.className.to(data.textPropertyKey + data.textPropertyName) + ' .text'),
                        $transcript = $text.find('.av-times'),
                        focusOffsets = data.offsets;

                    if ($transcript.length) {
                        var start = F.number.offsetValues(focusOffsets[0]),
                            end = F.number.offsetValues(focusOffsets[1]),
                            $container = $transcript.find('dd').eq(start.index);

                        rangeUtils.highlightOffsets($container.get(0), [start.offset, end.offset]);
                    } else {
                        rangeUtils.highlightOffsets($text.get(0), focusOffsets);
                    }
                })
                .done();
        };

        this.onCopyText = function(event) {
            var selection = getSelection(),
                target = event.target;

            if (!selection.isCollapsed && selection.rangeCount === 1) {

                var data = this.transformSelection(selection);
                if (hasValidOffsets(data)) {
                    this.trigger('copydocumenttext', data);
                }
            }
        };

        this.onTextUpdated = function(event, data) {
            if (data.vertexId === this.attr.model.id) {
                this.updateText();
            }
        };

        this.formatTimeOffset = function(time) {
            return sf('{0:h:mm:ss}', new sf.TimeSpan(time));
        };

        this.trackMouse = function(event) {
            var $target = $(event.target);

            if ($target.is('.resolved,.resolvable')) {
                if (event.type === 'mousedown') {
                    rangeUtils.clearSelection();
                }
            }

            if (event.type === 'contextmenu') {
                event.preventDefault();
            }

            if (~'mouseup click dblclick contextmenu'.split(' ').indexOf(event.type)) {
                this.mouseDown = false;
            } else {
                this.mouseDown = true;
            }

            if (isTextSelectable(event) && (event.type === 'mouseup' || event.type === 'dblclick')) {
                this.handleSelectionChange();
            }
        };

        this.handleKeyup = function(event) {
            if (event.shiftKey && isTextSelectable(event)) {
                this.handleSelectionChange();
            }
        };

        this.updateText = function() {
            var self = this;

            this.updatingPromise = Promise.resolve(this.internalUpdateText())
                .then(function() {
                    self.updateEntityAndArtifactDraggables();
                })
                .catch(function(e) {
                    console.error(e);
                    throw e;
                })

            return this.updatingPromise;
        }

        this.internalUpdateText = function internalUpdateText(_d3, _rangeUtils) {
            var self = this;

            if (!d3 && _d3) d3 = _d3;
            if (!rangeUtils && _rangeUtils) rangeUtils = _rangeUtils;

            if (!d3) {
                return Promise.all([
                    Promise.require('d3'),
                    Promise.require('util/range')
                ]).then(function(results) {
                    return internalUpdateText.apply(self, results);
                })
            }

            return this.dataRequest('ontology', 'properties')
                .then(function(properties) {
                    var self = this,
                        scrollParent = this.$node.scrollParent(),
                        scrollTop = scrollParent.scrollTop(),
                        expandedKey = this.$node.find('.text-section.expanded').data('key'),
                        expandedName = this.$node.find('.text-section.expanded').data('name'),
                        textProperties = _.filter(this.model.properties, function(p) {
                            var ontologyProperty = properties.byTitle[p.name];
                            if (!ontologyProperty) {
                                return false;
                            }

                            // support legacy ontologies where text is not set to longText
                            var isTextProperty = _.some(TEXT_PROPERTIES, function(name) {
                                return name === p.name;
                            });
                            if (isTextProperty) {
                                return true;
                            }

                            if (!ontologyProperty.userVisible) {
                                return false;
                            }
                            return ontologyProperty.displayType === 'longText';
                        });

                    d3.select(self.node)
                        .selectAll('div.highlightWrap')
                        .data([1])
                        .call(function() {
                            this.enter().append('div');
                            this.attr('class', 'highlightWrap highlight-underline');
                        })
                        .selectAll('section.text-section')
                        .data(_.sortBy(textProperties, textPropertySort), textPropertyId)
                        .call(function() {
                            this.enter()
                                .append('section')
                                .attr('class', 'text-section collapsible')
                                .call(function() {
                                    this.append('h1').attr('class', 'collapsible-header')
                                        .call(function() {
                                            this.append('strong');
                                            this.append('button').attr('class', 'info');
                                        });
                                    this.append('div').attr('class', 'text visallo-allow-dblclick-selection');
                                });

                            this.order();

                            this.attr('data-key', function(p) {
                                    return p.key;
                                })
                                .attr('data-name', function(p) {
                                    return p.name;
                                })
                                .each(function() {
                                    var p = d3.select(this).datum();
                                    $(this).removePrefixedClasses('ts-').addClass('ts-' + F.className.to(p.key + p.name));
                                });
                            this.select('h1 strong').text(descriptionProperty);
                            this.select('button.info').on('click', function(d) {
                                d3.event.stopPropagation();
                                self.showPropertyInfo(this, self.model, d);
                            });

                            this.exit().remove();
                        });

                    if (textProperties.length) {
                        if (this.attr.focus) {
                            return this.openText(this.attr.focus.textPropertyKey, this.attr.focus.textPropertyName)
                                .then(function() {
                                    var $text = self.$node.find('.ts-' +
                                            F.className.to(self.attr.focus.textPropertyKey + self.attr.focus.textPropertyName) + ' .text'),
                                        $transcript = $text.find('.av-times'),
                                        focusOffsets = self.attr.focus.offsets;

                                    if ($transcript.length) {
                                        var start = F.number.offsetValues(focusOffsets[0]),
                                            end = F.number.offsetValues(focusOffsets[1]),
                                            $container = $transcript.find('dd').eq(start.index);

                                        rangeUtils.highlightOffsets($container.get(0), [start.offset, end.offset]);
                                    } else {
                                        rangeUtils.highlightOffsets($text.get(0), focusOffsets);
                                    }
                                    self.attr.focus = null;
                                });
                        } else if ((expandedName && expandedKey) || textProperties.length === 1) {
                            return this.openText(
                                expandedKey || textProperties[0].key,
                                expandedName || textProperties[0].name,
                                {
                                    scrollToSection: textProperties.length !== 1
                                }
                            ).then(function() {
                                scrollParent.scrollTop(scrollTop);
                            });
                        } else if (textProperties.length > 1) {
                            return this.openText(textProperties[0].key, textProperties[0].name, {
                                expand: false
                            });
                        }
                    }
                }.bind(this));
        };

        this.openText = function(propertyKey, propertyName, options) {
            var self = this,
                expand = !options || options.expand !== false,
                $section = this.$node.find('.ts-' + F.className.to(propertyKey + propertyName)),
                isExpanded = $section.is('.expanded'),
                $info = $section.find('button.info'),
                selection = getSelection(),
                range = selection.rangeCount && selection.getRangeAt(0),
                hasSelection = isExpanded && range && !range.collapsed,
                hasOpenForm = isExpanded && ($section.find('.underneath').length || $('.detail-text-terms-popover').length);

            if (hasSelection || hasOpenForm) {
                this.reloadText = this.openText.bind(this, propertyKey, propertyName, options);
                return Promise.resolve();
            }

            $section.closest('.texts').find('.loading').removeClass('loading');
            if (expand && !isExpanded) {
                $info.addClass('loading');
            }

            if (this.openTextRequest) {
                this.openTextRequest.cancel();
                this.openTextRequest = null;
            }

            var extensions = _.filter(registry.extensionsForPoint('org.visallo.detail.text'), function(e) {
                    /**
                     * @callback org.visallo.detail.text~shouldReplaceTextSectionForVertex
                     * @param {object} model The vertex/edge
                     * @param {string} propertyName
                     * @param {string} propertyKey
                     */
                    return e.shouldReplaceTextSectionForVertex(self.model, propertyName, propertyKey);
                }),
                textPromise;

            if (extensions.length > 1) {
                console.warn('Multiple extensions wanting to override text', extensions);
            }

            if (extensions.length) {
                textPromise = Promise.require('util/component/attacher')
                    .then(function(Attacher) {
                        /**
                         * @typedef org.visallo.detail.text~Component
                         * @property {object} model The vertex/edge
                         * @property {string} propertyName
                         * @property {string} propertyKey
                         */
                        self.textExtension = Attacher()
                            .node($section.find('.text'))
                            .path(extensions[0].componentPath)
                            .params({
                                vertex: self.model,
                                model: self.model,
                                propertyName: propertyName,
                                propertyKey: propertyKey
                            })
                        return self.textExtension.attach();
                    })
            } else {
                this.openTextRequest = this.dataRequest(
                    'vertex',
                    'highlighted-text',
                    this.model.id,
                    propertyKey,
                    propertyName
                );

                textPromise = this.openTextRequest
                    .catch(function() {
                        return '';
                    })
                    .then(function(artifactText) {
                        var html = self.processArtifactText(artifactText);
                        if (expand) {
                            $section.find('.text').html(html);
                        }
                    });
            }

            return textPromise
                .then(function() {
                    $info.removeClass('loading');
                    if (expand) {
                        $section.addClass('expanded');

                        self.updateEntityAndArtifactDraggablesNoDelay();
                        if (!options || options.scrollToSection !== false) {
                            self.scrollToRevealSection($section);
                        }
                    } else {
                        $section.removeClass('expanded');
                    }
                })
        };

        this.processArtifactText = function(text) {
            var self = this,
                warningText = i18n('detail.text.none_available');

            // Looks like JSON ?
            if (/^\s*{/.test(text)) {
                var json;
                try {
                    json = JSON.parse(text);
                } catch(e) { /*eslint no-empty:0*/ }

                if (json && !_.isEmpty(json.entries)) {
                    return transcriptEntriesTemplate({
                        entries: _.map(json.entries, function(e) {
                            return {
                                millis: e.start,
                                time: (_.isUndefined(e.start) ? '' : self.formatTimeOffset(e.start)) +
                                        ' - ' +
                                      (_.isUndefined(e.end) ? '' : self.formatTimeOffset(e.end)),
                                text: e.text
                            };
                        })
                    });
                } else if (json) {
                    text = null;
                    warningText = i18n('detail.transcript.none_available');
                }
            }

            return !text ? alertTemplate({ warning: warningText }) : text;
        };

        this.onDropdownClosed = function(event, data) {
            var self = this;
            _.defer(function() {
                self.disableSelection = false;
                self.checkIfReloadNeeded();
            })
        };

        this.checkIfReloadNeeded = function() {
            if (this.reloadText) {
                var func = this.reloadText;
                this.reloadText = null;
                func();
            }
        };

        this.onHoverOver = function(event) {
            this.setHoverTarget($(event.target).closest('.text'), event.target);
        };

        this.onHoverLeave = function(event) {
            clearTimeout(this.hoverLeaveTimeout);
            this.hoverLeaveTimeout = setTimeout(() => {
                this.setHoverTarget($(event.target).closest('.text'));
            }, 16);
        };

        this.setHoverTarget = function($text, target) {
            if (target) {
                clearTimeout(this.hoverLeaveTimeout);
            }

            const ref = target ? this.getElementRefId(target) : null;
            if (ref !== this.currentHoverTarget) {
                if (this.currentHoverTarget) {
                    $text.removeClass(this.currentHoverTarget)
                }
                if (ref) {
                    const refs = [ref];
                    if (target) {
                        let parent = target;
                        while (!parent.classList.contains('text')) {
                            const r = this.getElementRefId(parent);
                            const info = this.getElementInfoUsingRef(parent);
                            const type = info && info.conceptType;
                            const concept = type && this.concepts.byId[type];
                            const color = concept && concept.color || '#000000';
                            const selector = '.text.' + r + ' .' + r;

                            if (parent.classList.contains('res')) {
                                this.loadRule(color, selector, STYLE_STATES.HOVER);
                            } else if (parent.classList.contains('jref')) {
                                this.loadRule('#0088cc', selector, STYLE_STATES.HOVER);
                            }

                            refs.push(r);
                            parent = parent.parentNode;
                        }
                    }
                    this.currentHoverTarget = refs.join(' ');
                    $text.addClass(this.currentHoverTarget);
                } else {
                    this.currentHoverTarget = null;
                }
            }
        };

        this.getElementRefId = function(element) {
            return element.dataset.refId ? element.dataset.refId : element.dataset.ref;
        };

        this.getElementInfoUsingRef = function(element) {
            let info = element.dataset.info;
            let ref = element.dataset.ref;
            if (!info && ref) {
                const fullInfo = $(element).closest('.text').find(`.${ref}[data-ref-id]`)[0]
                if (fullInfo) {
                    info = fullInfo.dataset.info;
                } else {
                    console.warn("Text contains a data-ref that doesn't exist in document", element);
                }
            }
            return info ? JSON.parse(info) : null;
        }

        this.onTermClick = function(event) {
            var self = this,
                $target = $(event.target);

            if ($target.is('.underneath') || $target.parents('.underneath').length) {
                return;
            }
            var sel = window.getSelection();
            if (sel && sel.rangeCount === 1 && !sel.isCollapsed) {
                return;
            }

            const $textSection = $target.closest('.text-section');
            const clicked = $target.parentsUntil('.text', 'span').andSelf();
            const terms = [];
            clicked.each(function() {
                const info = self.getElementInfoUsingRef(this);
                if (info) {
                    terms.push(info)
                } else {
                    console.warn('Mention does not contain a data-info attribute', this);
                }
            })

            this.popover({
                node: $target,
                terms,
                propertyKey: $textSection.data('key'),
                propertyName: $textSection.data('name'),
                artifactId: self.model.id
            });

            /*
            TODO: implement these in Term.jsx
            requireAndCleanupActionBar().then(function(ActionBar) {
                var $text = $target.closest('.text'),
                    $textOffset = $text.closest('.nav-with-background').offset();

                if ($target.hasClass('resolved')) {
                    const info = $target.data('info');
                    const unresolve = Privileges.canEDIT &&
                        info.termMentionFor === 'VERTEX' &&
                        info.sandboxStatus !== 'PUBLIC';

                    ActionBar.attachTo($target, {
                        alignTo: 'node',
                        alignWithin: $text,
                        hideTopThreshold: $textOffset && $textOffset.top,
                        actions: $.extend({
                            Open: 'open',
                            Fullscreen: 'fullscreen'
                        }, unresolve ? {
                            Unresolve: 'unresolve'
                        } : {})
                    });

                    self.off('open')
                    self.on('open', function(event) {
                        event.stopPropagation();
                        self.trigger('selectObjects', { vertexIds: [$target.data('info').resolvedToVertexId] });
                    })
                    self.off('fullscreen')
                    self.on('fullscreen', function(event) {
                        event.stopPropagation();
                        self.dataRequest('vertex', 'store', { vertexIds: $target.data('info').resolvedToVertexId })
                            .then(function(vertices) {
                                self.trigger('openFullscreen', { vertices: vertices });
                            })
                    })
                    self.off('unresolve')
                    self.on('unresolve', function(event) {
                        event.stopPropagation();
                        _.defer(self.dropdownEntity.bind(self), {
                            creating: false,
                            insertAfterNode: $target,
                            unresolve: true
                        });
                    });

                } else if (Privileges.canEDIT) {

                    ActionBar.attachTo($target, {
                        alignTo: 'node',
                        alignWithin: $text,
                        hideTopThreshold: $textOffset && $textOffset.top,
                        actions: {
                            Entity: 'resolve',
                            Property: 'property'
                        }
                    });

                    self.off('resolve');
                    self.on('resolve', function(event) {
                        _.defer(self.dropdownEntity.bind(self), {
                             creating: false,
                             insertAfterNode: $target});
                        event.stopPropagation();
                    })
                    self.off('property');
                    self.on('property', function(event) {
                        event.stopPropagation();
                        _.defer(function() {
                            self.dropdownProperty($target, null, $target.text());
                        })
                    })
                }
            });
            */
        };

        this.getOffsets = function(root, range) {
            var rangeRelativeToText = range.cloneRange();
            rangeRelativeToText.selectNodeContents(root);
            rangeRelativeToText.setEnd(range.startContainer, range.startOffset);
            var mentionStart = rangeRelativeToText.toString().length;
            var mentionEnd = mentionStart + range.toString().length
            return { mentionStart, mentionEnd };
        }

        this.handleSelectionChange = _.debounce(function() {
            var sel = window.getSelection(),
                text = sel && sel.rangeCount === 1 ? $.trim(sel.toString()) : '';

            if (this.disableSelection) {
                return;
            }
            if (text && text.length > 0) {
                var anchor = $(sel.anchorNode),
                    focus = $(sel.focusNode),
                    is = '.detail-pane .text',
                    $anchorText = anchor.is(is) ? anchor : anchor.parents(is),
                    $focusText = focus.is(is) ? focus : focus.parents(is),
                    textContainer = $anchorText[0] || $focusText[0];

                // Ignore outside content text
                if ($anchorText.length === 0 || $focusText.length === 0) {
                    this.checkIfReloadNeeded();
                    return;
                }

                // Ignore if too long of selection
                var maxParagraphs = _.compact(text.replace(/(\s*<br>\s*)+/g, '\n').split('\n'));
                if (maxParagraphs.length > CONFIG_MAX_SELECTION_PARAGRAPHS) {
                    return requireAndCleanupActionBar();
                }

                if (sel.rangeCount === 0) {
                    this.checkIfReloadNeeded();
                    return;
                }

                if (Privileges.missingEDIT) {
                    return;
                }

                // Don't show action bar if dropdown opened
                if (this.$node.find('.text.dropdown').length) {
                    return;
                }

                var range = sel.rangeCount && sel.getRangeAt(0);

                if (!range) {
                    return;
                }
                const { mentionStart, mentionEnd } = this.getOffsets(textContainer, range);

                var self = this;
                var $text = $(textContainer),
                    $textSection = $text.closest('.text-section'),
                    $textOffset = $text.closest('.nav-with-background').offset();

                const anchorTo = { range: range.cloneRange() };
                const selection = {
                    sign: text,
                    mentionStart,
                    mentionEnd,
                    snippet: rangeUtils.createSnippetFromRange(range, undefined, textContainer)
                };

                this.popover({
                    node: textContainer,
                    anchorTo,
                    selection,
                    propertyKey: $textSection.data('key'),
                    propertyName: $textSection.data('name'),
                    artifactId: self.model.id
                })

                /*
                 * TODO: Move to TermSelection
                requireAndCleanupActionBar().then(function(ActionBar) {

                    ActionBar.attachTo(self.node, {
                        alignTo: 'textselection',
                        alignWithin: $text,
                        hideTopThreshold: $textOffset && $textOffset.top,
                        actions: {
                            Entity: 'resolve',
                            Property: 'property',
                            Comment: 'comment'
                        }
                    });

                    self.off('comment')
                    self.on('comment', function(event) {
                        event.stopPropagation();

                        var data = self.transformSelection(sel);
                        if (hasValidOffsets(data)) {
                            self.trigger('commentOnSelection', data);
                        }
                    })
                    self.off('property')
                    self.on('property', function(event) {
                        event.stopPropagation();
                        _.defer(function() {
                            self.dropdownProperty(getNode(endContainer), sel, text);
                        })
                    })
                    self.off('resolve')
                    self.on('resolve', function(event) {
                        event.stopPropagation();

                        self.dropdownEntity({
                            creating: true,
                            insertAfterNode: getNode(endContainer),
                            mentionStart,
                            mentionEnd,
                            text: text});
                    });

                    function getNode(node) {
                        var isEndTextNode = node.nodeType === 1;
                        if (isEndTextNode) {
                            return node;
                        } else {

                            // Move to first space in end so as to not break up word when splitting
                            var i = Math.max(range.endOffset - 1, 0), character = '', whitespaceCheck = /^[^\s]$/;
                            do {
                                character = node.textContent.substring(++i, i + 1);
                            } while (whitespaceCheck.test(character));

                            if (i < node.length) {
                                node.splitText(i);
                            }
                            return node;
                        }
                    }
                });
                */
            } else {
                this.checkIfReloadNeeded();
            }
        }, 250);

        this.popover = function({ node, ...options }) {
            if (this.TextPopover && $(node).lookupComponent(this.TextPopover)) {
                return;
            }
            require(['./popover/popover'], TextPopover => {
                this.TextPopover = TextPopover;
                TextPopover.teardownAll();
                TextPopover.attachTo(node, {
                    keepInView: true,
                    preferredPosition: 'below',
                    ...options
                });
            })
        }

        this.tearDownDropdowns = function() {
            this.$node.find('.underneath').teardownAllComponents();
            this.disableSelection = false;
        };

        this.dropdownEntity = function(data) {
            this.tearDownDropdowns();
            this.disableSelection = true;

            var self = this,
                form = $('<div class="underneath"/>'),
                $node = $(data.insertAfterNode),
                $textSection = $node.closest('.text-section'),
                $textBody = $textSection.children('.text');

            $node.after(form);
            require(['../dropdowns/termForm/termForm'], function(TermForm) {
                TermForm.attachTo(form, {
                    sign: data.text,
                    propertyKey: $textSection.data('key'),
                    propertyName: $textSection.data('name'),
                    selection: data.selection,
                    mentionNode: data.insertAfterNode,
                    mentionStart: data.mentionStart,
                    mentionEnd: data.mentionEnd,
                    snippet: data.selection ?
                        rangeUtils.createSnippetFromRange(data.selection.range, undefined, $textBody[0]) :
                        rangeUtils.createSnippetFromNode(data.insertAfterNode[0], undefined, $textBody[0]),
                    existing: !data.creating,
                    artifactId: self.model.id,
                    unresolve: data.unresolve || false
                });
            })
        };

        this.dropdownProperty = function(insertAfterNode, selection, text, vertex) {
            var self = this;

            if (vertex && _.isString(vertex)) {
                this.dataRequest('vertex', 'store', { vertexIds: vertex })
                    .done(function(vertex) {
                        self.dropdownProperty(insertAfterNode, selection, text, vertex);
                    });
                return;
            }

            this.tearDownDropdowns();
            this.disableSelection = true;

            var form = $('<div class="underneath"/>'),
                $node = $(insertAfterNode),
                $textSection = $node.closest('.text-section'),
                $textBody = $textSection.children('.text'),
                dataInfo = $node.data('info');

            $node.after(form);

            require(['../dropdowns/propertyForm/propForm'], function(PropertyForm) {
                PropertyForm.attachTo(form, {
                    data: vertex || undefined,
                    attemptToCoerceValue: text,
                    sourceInfo: selection ?
                        selection.snippet ?
                        selection :
                        self.transformSelection(selection) :
                        {
                            vertexId: self.model.id,
                            textPropertyKey: $textSection.data('key'),
                            textPropertyName: $textSection.data('name'),
                            startOffset: dataInfo.start,
                            endOffset: dataInfo.end,
                            snippet: rangeUtils.createSnippetFromNode($node[0], undefined, $textBody[0])
                        }
                });
            });
        };

        this.transformSelection = function(selection) {
            var $anchor = $(selection.anchorNode),
                $focus = $(selection.focusNode),
                textContainer = $anchor.closest('.text')[0],
                isTranscript = $anchor.closest('.av-times').length,
                offsetsFunction = isTranscript ?
                    'offsetsForTranscript' :
                    'offsetsForText',
                range = selection.getRangeAt(0),
                rangeOffsets = this.getOffsets(textContainer, range),
                offsets = this[offsetsFunction]([
                    {el: $anchor, offset: rangeOffsets.mentionStart },
                    {el: $focus, offset: rangeOffsets.mentionEnd }
                ], '.text', _.identity),
                contextHighlight = rangeUtils.createSnippetFromRange(
                    range, undefined, textContainer
                );

            return {
                startOffset: offsets && offsets[0],
                endOffset: offsets && offsets[1],
                snippet: contextHighlight,
                vertexId: this.model.id,
                textPropertyKey: $anchor.closest('.text-section').data('key'),
                textPropertyName: $anchor.closest('.text-section').data('name'),
                text: selection.toString(),
                vertexTitle: F.vertex.title(this.model)
            };
        };

        this.offsetsForText = function(input, parentSelector, offsetTransform) {
            return input.map(i => i.offset);
        };

        this.offsetsForTranscript = function(input) {
            var self = this,
                index = input[0].el.closest('dd').data('index'),
                endIndex = input[1].el.closest('dd').data('index');

            if (index !== endIndex) {
                return console.warn('Unable to select across timestamps');
            }

            var rawOffsets = this.offsetsForText(input, 'dd', function(offset) {
                    return F.number.offsetValues(offset).offset;
                }),
                bitMaskedOffset = _.map(rawOffsets, _.partial(F.number.compactOffsetValues, index));

            return bitMaskedOffset;
        };

        this.updateEntityAndArtifactDraggables = function() {
            var self = this,
                scrollNode = this.scrollNode,
                words = this.select('resolvedSelector'),
                validWords = $(words);

            if (!scrollNode) {
                scrollNode = this.scrollNode = this.$node.scrollParent();
            }

            // Filter list to those in visible scroll area
            if (scrollNode && scrollNode.length) {
                validWords = validWords.withinScrollable(scrollNode);
            }

            if (validWords.length === 0) {
                return;
            }

            var currentlyDragging = null;

            validWords
                .each(function() {
                    var info = self.getElementInfoUsingRef(this),
                        type = info && info.conceptType,
                        concept = type && self.concepts.byId[type];

                    if (concept) {
                        this.classList.forEach(className => {
                            if (className.indexOf('conceptId-') === 0 && className !== concept.className) {
                                this.classList.remove(className);
                            }
                        });
                        if (!this.classList.contains(concept.className)) {
                            this.classList.add(concept.className);
                            self.loadSelectorForConcept(concept);
                        }
                    }

                    /*
                    $this.attr('draggable', true)
                        .off('dragstart dragend')
                        .on('dragstart', function(event) {
                            const dt = event.originalEvent.dataTransfer;
                            const elements = { vertexIds: [info.resolvedToVertexId], edgeIds: [] };
                            dt.effectAllowed = 'all';
                            dnd.setDataTransferWithElements(dt, elements);
                            $(this).closest('.text').addClass('drag-focus');
                            currentlyDragging = event.target;
                        })
                        .on('dragend', function() {
                            $(this).closest('.text').removeClass('drag-focus');
                        });
                        */
                })

            if (Privileges.canEDIT) {

                words
                    .off('dragover drop dragenter dragleave')
                    .on('dragover', function(event) {
                        if (event.target.classList.contains('resolved')) {
                            event.preventDefault();
                        }
                    })
                    .on('dragenter dragleave', function(event) {
                        if (event.target.classList.contains('resolved')) {
                            $(event.target).toggleClass('drop-hover', event.type === 'dragenter');
                        }
                    })
                    .on('drop', function(event) {
                        event.preventDefault();
                        $(event.target).removeClass('drop-hover');

                        if (!currentlyDragging) {
                            throw new Error('Cannot drag from other detail panes.')
                        }

                        if (event.target.classList.contains('resolved')) {
                            var destTerm = $(event.target),
                                form;

                            if (destTerm.hasClass('opens-dropdown')) {
                                form = $('<div class="underneath"/>')
                                    .insertAfter(destTerm.closest('.detected-object-labels'));
                            } else {
                                form = $('<div class="underneath"/>').insertAfter(destTerm);
                            }
                            self.tearDownDropdowns();
                            self.disableSelection = true;

                            require(['../dropdowns/statementForm/statementForm'], function(StatementForm) {
                                StatementForm.attachTo(form, {
                                    sourceTerm: $(currentlyDragging),
                                    destTerm: destTerm
                                });
                            })
                        }
                    })
            }
        };

        this.loadSelectorForConcept = function(concept) {
            //if (!this._loadedConcepts) {
                //this._loadedConcepts = {};
            //}

            if (/*concept.id in this._loadedConcepts || */!concept.color) {
                return;
            }
            //this._loadedConcepts[concept.id] = true;

            const className = concept.rawClassName || concept.className;
            if (!className) {
                return;
            }

            const conceptColor = colorjs(concept.color);
            if (conceptColor.red === 0 && conceptColor.green === 0 & conceptColor.blue === 0) {
                return;
            }

            this.loadRule(concept.color, '.highlight-underline .res.' + className, STYLE_STATES.NORMAL);
            window._loadRule = (el, selector, state) => {
                var info = this.getElementInfoUsingRef(el),
                    type = info && info.conceptType,
                    concept = type && this.concepts.byId[type],
                    color = concept && concept.color || '#000000';

                if (el.classList.contains('res')) {
                    this.loadRule(color, selector, state);
                } else {
                    this.loadRule('#0088cc', selector, state);
                }
            };
        };

        this.loadRule = function(color, selector, state) {
            require(['detail/text/highlight-styles/underline.hbs'], tpl => {
                const definition = function(state, template) {
                    return (template || tpl)({
                        ...(_.object(_.map(STYLE_STATES, (v, k) => [k.toLowerCase(), v === state]))),
                        colors: {
                            normal: colorjs(color).setAlpha(1.0),
                            hover: colorjs(color).setAlpha(0.1)
                        }
                    });
                };
                textStylesheet.addRule(selector, definition(state));
            });
        };

        this.scrollToRevealSection = function($section) {
            var scrollIfWithinPixelsFromBottom = 150,
                y = $section.offset().top,
                sectionScrollY = $section.offset().top - $section.offsetParent().offset().top,
                scrollParent = $section.scrollParent(),
                scrollTop = scrollParent.scrollTop(),
                height = scrollParent.outerHeight(),
                fromBottom = height - y;
            sectionScrollY += scrollTop + scrollIfWithinPixelsFromBottom;
            if (fromBottom < scrollIfWithinPixelsFromBottom) {
                scrollParent.animate({
                    scrollTop: sectionScrollY - height
                }, 'fast');
            }
        };

        this.scrollToMediaPreview = function($detailBody) {
            if (!this.mediaType) {
                this.mediaType = $detailBody.find(PREVIEW_SELECTORS.audio).parent().length > 0 ? 'audio' : 'video';
                this.$mediaNode = this.mediaType === 'audio' ?
                    $detailBody.find(PREVIEW_SELECTORS.audio).parent() :
                    $detailBody.find(PREVIEW_SELECTORS.video);
            }
            var $scrollParent = visalloData.isFullscreen ? $('html, body') : $detailBody,
                scrollTop = visalloData.isFullscreen ? this.$mediaNode.offset().top : this.$mediaNode.position().top;

            $scrollParent.animate({
                scrollTop: scrollTop
            }, 'fast');
        };

        this.onAVLinkClick = function(event, data) {
            var seekTo = data.el.dataset.millis || '';
            var transcriptKey = $(event.target).parents('section').data().key;

            if (seekTo) {
                this.trigger(this.$node.parents('.type-content'), 'avLinkClicked', {
                    seekTo: seekTo,
                    autoPlay: false,
                    transcriptKey: transcriptKey
                });

                this.scrollToMediaPreview(this.$node.parents(this.attr.detailSectionContainerSelector));
            }
        };
    }

    function isTextSelectable(event) {
        return ($(event.target).closest('.opens-dropdown').length === 0 &&
            $(event.target).closest('.underneath').length === 0 &&
            !($(event.target).parent().hasClass('currentTranscript')) &&
            !($(event.target).hasClass('alert alert-error')));
    }

    function requireAndCleanupActionBar() {
        return Promise.require('util/actionbar/actionbar')
            .then(function(ActionBar) {
                ActionBar.teardownAll();
                return ActionBar;
            });
    }
});
