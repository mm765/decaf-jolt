/**
 * JOLT Application class
 *
 * @module jolt
 * @xsubmodule Application
 */
/*global require, exports, java, toString */

"use strict";

var http = require('http'),
    File = require('File');

function html(title, body) {
    if (toString.apply(body) === '[object Array]') {
        body = body.join('\n');
    }
    return [
        '<!doctype html>',
        '<html>',
        '    <head>',
        '        <title>' + title + '</title>',
        '        <style>',
        'body { padding: 5px; }',
        'h1 { padding: 0; margin: 0 }',
        'h2 { padding: 0; margin: 0; margin-top: 10px; }',
        'pre { padding: 0; margin: 0} ',
        '.listing { font-family: monospace; white-space: pre; border: 1px solid black; padding: 5px; }',
        '.highlight { background: red; color: white; display: block; }',
        '        </style>',
        '    </head>',
        '    <body>',
        body,
        '    </body>',
        '</html>'
    ].join('\n');
}

function internalServerError(req, res) {
    if (decaf.isNumber(res.error)) {
        res.error = new Error('HTTP Error ' + res.error);
    }
    res.writeHead(500, {
        'Content-type' : 'text/html'
    });

    var content = [
        '<h1>Error 500</h1>',
        '<div>Internal Server Error</div>',
        '<div>Requested resource: ' + req.uri + '</div>',
        '<h2>Stack Trace</h2>',
        '<pre>',
        res.error.asText(),
        '</pre>'
    ];

    var lines,
        lineNumber,
        start,
        end,
        listing = '<div class="listing">';

    try {
        lines = new File(res.error.fileName).readAll().split('\n');
        lineNumber = res.error.lineNumber - (require.isRequiredFile(res.error.fileName) ? 7 : 0);
        start = (lineNumber - 15) >= 0 ? lineNumber - 15 : 0;
        end = start + 30;

        for (var lineNo = start; lineNo <= end; lineNo++) {
            var ln = '' + lineNo;
            while (ln.length < 5) {
                ln = ' ' + ln;
            }
            if (lineNo === lineNumber) {
                listing += '<div class="highlight">' + ln + ' ' + lines[lineNo - 1].replace(/</g, '&lt;') + '</div>';
            }
            else {
                listing += ln + ' ' + lines[lineNo - 1].replace(/</g, '&lt;') + '\n';
            }
        }
        listing += '</div>';
        content.push('<h2>' + res.error.fileName + '</h2>');
        content.push(listing);
    }
    catch (e) {
    }
    if (res.compiled) {
        lines = res.compiled.split('\n');
        lineNumber = res.error.lineNumber;
        end = lines.length;
        for (var lineNo = 1; lineNo <= end && lines[lineNo - 1] !== undefined; lineNo++) {

            var ln = '' + lineNo;
            while (ln.length < 5) {
                ln = ' ' + ln;
            }
            if (lineNo === lineNumber) {
                listing += '<div class="highlight">' + ln + ' ' + lines[lineNo - 1].replace(/</g, '&lt;') + '</div>';
            }
            else {
                listing += ln + ' ' + lines[lineNo - 1].replace(/</g, '&lt;') + '\n';
            }
        }
        listing += '</div>';
        content.push('<h2>Compiled</h2>');
        content.push(listing);
//            content.push('<pre>' + res.source.replace(/</igm, '&lt;') + '</pre>');
    }
    if (res.source) {
        content.push('<h2>Source</h2>');
        content.push('<div class="listing">' + res.source.replace(/</igm, '&lt;') + '</div>');
    }
    res.end(html(500, content));
}

/**
 * Construct a new Jolt application
 *
 * Example:
 *
 *     var Application = require('jolt').Application,
 *         app = new Application();
 *
 *     // add zero or more verbs
 *     app.verb('route', config);   // see verb() below
 *     // add zero or more webSockets
 *     app.webSocket('route', handler);
 *     app.listen(port);
 *
 * @constructor
 */
function Application() {
    var me = this;

    me.verbs = {};
    me.errorHandlers = {
        403: function(req, res) {
            res.writeHead(403, {
                'Content-type' : 'text/html'
            });
            res.end(html('Access denied', 'Access Denied'));
        },
        404 : function(req, res) {
            res.writeHead(404, {
                'Content-type' : 'text/html'
            });
            res.end(html('Not Found', 'Not found'));
        }

    };
    me.listeners = {};
    me.server = http.createServer(function(req, res) {
        var verb,
            verbs = me.verbs,
            errorHandlers = me.errorHandlers,
            config,
            status;

        try {
            req.args = req.uri.substr(1).split('/');
            verb = req.verb = req.args.shift();
            if (req.uri.endsWith('/')) {
                req.args.pop();
            }
            if (!verb.length) {
                req.verb = '/';
            }

            me.fire('beginRequest', req, res);
            // in case beginRequest handler changed it!
            verb = req.verb;
            config = verbs[verb] || verbs[404] || 404;
            if (config !== 404) {
                status = config.handler(config, req, res);
            }
            else {
                status = 404;
            }
            config = errorHandlers[status];
            if (config) {
                if (config.handler) {
                    config.handler(config, req, res);
                }
                else {
                    errorHandlers[status](req, res);
                }
            }
        }
        catch (e) {
            if (e === 'RES.STOP') {
                throw e;
            }
            else if (e === 'EOF') {
                throw e;
            }
            me.fire('exception', e, req, res);
            res.error = e;
            config = errorHandlers[500];
            if (config) {
                if (config.handler) {
                    config.handler(config, req, res, internalServerError);
                }
                else {
                    config(req, res, internalServerError);
                }
            }
            else {
                internalServerError(req, res);
            }
        }
        me.fire('endRequest', req, res);
    });
}

decaf.extend(Application.prototype, {

    /**
     * Add a verb/action to the application
     *
     * @chainable
     * @param {string} verb
     * @param {object} config
     * @chainable
     */
    verb : function(verb, config) {
        if (toString.apply(config) === '[object Function]') {
            var fn = config;
            config = {
                handler : function(config, req, res) {
                    return fn(req, res);
                }
            };
        }
        this.verbs[verb] = config;
        return this;
    },

    /**
     * Add a handler for non-200 status codes
     *
     * For example, an SJS program might return 403, and
     * you want to render a custom "not authorized" page.
     *
     * The second argument to this function can be
     * a SjSFile, JstFile, etc., instance as well.
     *
     * @param {int} status - status code to add handler for
     * @param {function} handler - method to execute for this status
     */
    errorHandler : function(status, handler) {
        this.errorHandlers[status] = handler;
    },

    /**
     * Start up the server, begin listening for connections
     *
     * @chainable
     * @param {int} port ip port to listen ons
     * @param {string} address ip address to listen on
     * @param {int} backlog size of accept() backlog
     * @chainable
     */
    listen : function(port, address, backlog, uploadMaxSize, uploadBlocksize, uploadDir) {
        var me = this;
        me.server.listen(port, address, backlog, uploadMaxSize, uploadBlocksize, uploadDir);
        return me;
    },

    /**
     * Add a webSocket handler to the application
     *
     * @chainable
     * @param {string} path
     * @param (function) handler
     * @chainable
     */
    webSocket : function(path, handler) {
        var me = this;

        me.server.webSocket(path, handler);
        return me;
    },

    /**
     *
     * @memberOf Thread
     * @param event
     * @param fn
     */
    on : function(event, fn) {
        this.listeners[event] = this.listeners[event] || [];
        this.listeners[event].push(fn);
    },

    /**
     *
     * @memberOf Thread
     * @param event
     */
    fire : function(event) {
        var me = this;
        if (me.listeners[event]) {
            var args = [];
            for (var i = 1, len = arguments.length; i < len; i++) {
                args.push(arguments[i]);
            }
            decaf.each(me.listeners[event], function(fn) {
                fn.apply(me, args);
            });
        }
    }


});

//exports.Application = Application;

decaf.extend(exports, {
    Application : Application
});
