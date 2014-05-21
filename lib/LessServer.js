/** @module jolt */

/*global require, exports */

"use strict";

/**
 * @private
 * @type {*}
 */
var compile = require('decaf-less').compile,
    Semaphore = require('Threads').Semaphore,
    File = require('File');

function getCss(me, path) {
    me.semaphore.lock();
    try {
        var cache = me.cache,
            file;

        var script = cache[path];
        if (!script) {
            file = new File(path);
            if (file.isDirectory()) {
                return 403;
            }
            else if (!file.exists()) {
                return 404;
            }
            cache[path] = script = {
                file         : file,
                lastModified : 0
            };
        }
        else {
            file = script.file;
        }
        var lastModified = file.lastModified();
        if (lastModified > script.lastModified) {
            script.source = file.readAll();
            script.compiled = compile(script.source);
            script.lastModified = lastModified;
        }
        return script;
    }
    finally {
        me.semaphore.unlock();
    }
}

function serve(me, req, res) {
    var css = getCss(me, me.path + '/' + req.args.join('/'));
    if (typeof css === 'number') {
        return css;
    }
    res.writeHead(200, {
        'Content-type': 'text/css'
    });
    res.end(css.compiled);
    return 200;
}

/**
 * Serve LESS files from a directory structure on disk.
 *
 * LESS files are compiled once and then served over and over, but if the
 * file is changed on disk, it will be recompiled.  This caching provides
 * some boost in performance.
 *
 * @constructor
 * @param {string} path directory to serve .less files from
 * @returns {Object} config suitable for use with Application.verb()
 */
function LessServer(path) {
    return {
        path: path,
        semaphore: new Semaphore(),
        cache: {},
        handler: function(me, req, res) {
            return serve(me, req, res);
        }
    };
}

decaf.extend(LessServer.prototype, {

});

decaf.extend(exports, {
    LessServer : LessServer
});
