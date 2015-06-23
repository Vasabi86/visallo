
// Global Mocks
$ = { extend: _.extend };
window = this;
navigator = { userAgent: ''};
console = {
    log: print,
    info: print,
    debug: print,
    warn: consoleWarn,
    error: consoleError
};

require.config({
    baseUrl: '',
    paths: {
        // LIBS
        'chrono': 'libs/chrono.min',
        'sf': 'libs/sf',
        'timezone-js': 'libs/date',
        'underscore': 'libs/underscore',
        'bluebird': 'libs/promise-6.0.0',
        'duration-js': 'libs/duration',

        // MOCKS
        'jquery': 'mocks/jquery',
        'jstz': 'mocks/jstz',
        'util/withDataRequest': 'mocks/withDataRequest',
        'util/ajax': 'mocks/ajax',
        'util/memoize': 'mocks/memoize',

        // SRC
        'util/formatters': 'util_formatters',
        'util/promise': 'util_promise',
        'util/messages': 'util_messages',
        'util/requirejs/promise': 'util_requirejs_promise',
        'util/service/messagesPromise': 'util_service_messagesPromise',
        'util/service/ontologyPromise': 'util_service_ontologyPromise',
        'util/vertex/formatters': 'util_vertex_formatters',
        'util/vertex/formula': 'util_vertex_formula',
        'util/vertex/urlFormatters': 'util_vertex_urlFormatters'
    },
    shims: {
        'bluebird': { exports: 'Promise' },
        'util/vertex/formatters': { deps: ['util/promise'] }
    }
});

require(['timezone-js'], function(timezoneJS) {
    timezoneJS.timezone.zoneFileBasePath = 'tz';
    timezoneJS.timezone.defaultZoneFile = ['northamerica'];
    timezoneJS.timezone.loadZoneFile = function(fileName, opts) {
        if (this.loadedZones[fileName]) return;
        this.loadedZones[fileName] = true;

        var url = 'tz/' + fileName,
            file = readFile(url);

        if (!opts || !opts.async) {
            return this.parseZones(file);
        }

        var parsedZones = this.parseZones(file);
        if (opts && opts.callback) {
            ops.callback();
        }
    };
    timezoneJS.timezone.init({ async: false });
});

var timerLoop = makeWindowTimer(this, function () { });

require(['util/vertex/formatters'], function(F) {
    var createFunction = function(name) {
            return function(json) {
                 return F.vertex[name](JSON.parse(json));
            }
        };

    window.evaluateTitleFormulaJson = createFunction('title');
    window.evaluateTimeFormulaJson = createFunction('time');
    window.evaluateSubtitleFormulaJson = createFunction('subtitle');
});

timerLoop();
