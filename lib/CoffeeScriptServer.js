/*global require */

"use strict";

var compiler = require('decaf-coffeescript').CoffeeScript,
    Semaphore = require('Threads').Semaphore,
    File = require('File');

function getScript(me, path) {
    me.semaphore.lock();
    try {
        var cache = me.cache,
            file;

        var script = cache[path];
        if (!script) {
            file = new File(path);
            if (file.isDirectory()) {
                file = new File(path + '/index.coffee');
                if (!file.exists) {
                    return 403;
                }
            }
            else if (!file.exists()) {
                file = new File(path + '.coffee');
                if (!file.exists()) {
                    return 404;
                }
            }
            cache[path] = script = {
                file: file,
                lastModified: 0
            };
        }
        else {
            file = script.file;
        }
        var lastModified = file.lastModified();
        if (lastModified > script.lastModified) {
            script.source = file.readAll();
            script.compiled = compiler.compile(script.source, { bare: true }, path);
            script.fn = new Function('req', 'res', script.compiled);
            script.lastModified = lastModified;
        }
        return script;
    }
    finally {
        me.semaphore.unlock();
    }
}

function runScript(me, req, res) {
    var script = getScript(me, me.path + '/' + req.args.join('/'));
    if (!script.fn) {
        return script;
    }
    res.compiled = script.compiled;
    res.source = script.source;
    return script.fn(req, res) || 200;
}

/**
 * Jolt verb to serve coffeescript files from a directory tree.
 *
 * Typical usage is going to be something like:
 *
 *      app.verb('route', new CoffeeScriptServer('path/to/coffeescript/files');
 *
 * @constructor
 * @param {string} path path in file system to serve .coffee files from
 * @returns {Object} config suitable for use with Application.verb()
 */
function CoffeeScriptServer(path) {
    return {
        path: path,
        semaphore: new Semaphore(),
        cache: {},
        handler: function(me, req, res) {
            return runScript(me, req, res);
        }
    };
}

decaf.extend(CoffeeScriptServer.prototype, {

});

decaf.extend(exports, {
    CoffeeScriptServer: CoffeeScriptServer
});
