"use strict";

/*global require, sync */

/**
 * @private
 */
var compiler = require('jst').Jst,
    File = require('File'),
    GZIP = require('http').GZIP,
    cache = {};

var getJst = sync(function(path) {
    var file;

    var jst = cache[path];
    if (!jst) {
        file = new File(path);
        if (file.isDirectory()) {
            file = new File(path + '/index.jst');
            if (!file.exists) {
                return 403;
            }
        }
        else if (!file.exists()) {
            file = new File(path + '.jst');
            if (!file.exists()) {
                return 404;
            }
        }
        cache[path] = jst = {
            file         : file,
            lastModified : 0
        };
    }
    else {
        file = jst.file;
    }
    var lastModified = file.lastModified();
    if (lastModified > jst.lastModified) {
        jst.source = file.readAll();
        jst.compiled = [
            '"use strict";',
            'function include(fn) {',
            '   res.include(fn);',
            '}',
            'function print(s) {',
            '   res.out += s;',
            '}',
            'function println(s) {',
            "   res.out += s + '\\n';",
            '}',
            compiler.compile(jst.source),
            'return res.out;'
        ].join('\n');
        try {
            jst.fn = new Function('req', 'res', jst.compiled);
        }
        catch (e) {
            throw {
                source   : jst.source,
                compiled : jst.compiled,
                e        : e
            };
        }
        jst.lastModified = lastModified;
    }
    return jst;
}, cache);

function runJst(me, req, res) {
    var jst = getJst(me.path + '/' + req.args.join('/'));
    if (!jst.fn) {
        return jst;
    }
    res.compiled = jst.compiled;
    res.source = jst.source;

    var content = jst.fn(req, res);
    if (req.gzip) {
        content = GZIP.compress(content);
        res.writeHead(200, {
            'Content-Type' : res.headers['content-type'] || 'text/html',
            'Content-Encoding' : 'gzip'
        });
    }
    else {
        res.writeHead(200, {
            'Content-Type' : res.headers['content-type'] || 'text/html'
        });
    }
    res.end(content);
    return 200;
}

/**
 * Serve JST files from a directory structure on disk.
 *
 * JST files are compiled once and then called over and over, but if the
 * file is changed on disk, it will be recompiled.  This caching provides
 * some boost in performance.
 *
 * The options argument may contain a jstPath member, which is a path
 * to where JST scripts will include other scripts from.  If options
 * contains gzip = false, then gzip compression/encoding will be disabled.
 *
 * Additional key/value pairs in the config object are available to the JST
 * scripts as res.options and may be used for whatever purpose the application
 * requires.
 *
 * @constructor
 * @param {string} path directory to serve JST files from
 * @param {object} options (optional) options
 * @returns {Object} config suitable for use with Application.verb()
 */
function JstServer(path, options) {
    options = options || {};
    return {
        path    : path,
        options : options,
        handler : function(me, req, res) {
            res.data = {};
            res.out = '';
            res.options = me.options;
            res.include = function(fn) {
                var jst = getJst(me, me.path + '/' + fn);
                if (typeof jst === 'number' && me.options.jstPath) {
                    jst = getJst(me.options.jstPath + '/' + fn);
                }
                if (typeof jst === 'number') {
                    return jst;
                }
                res.source = jst.source;
                res.compiled = jst.compiled;
                jst.fn(req, res);
            };
            try {
                return runJst(me, req, res);
            }
            catch (e) {
                res.source = e.source;
                res.compiled = e.compiled;
                res.error = e.e;
                throw e.e;
            }
        }
    };
}

/**
 * Serve a single JST file from a specific route.
 *
 * JST files are compiled once and then called over and over, but if the
 * file is changed on disk, it will be recompiled.  This caching provides
 * some boost in performance.
 *
 * The options argument may contain a jstPath member, which is a path
 * to where JST scripts will include other scripts from.  If options
 * contains gzip = false, then gzip compression/encoding will be disabled.
 *
 * Additional key/value pairs in the config object are available to the JST
 * scripts as res.options and may be used for whatever purpose the application
 * requires.
 *
 * @class JstFile
 * @namespace jolt
 *
 * @constructor
 * @param {string} path path of .jst file to serve
 * @param {object} (optional} options
 * @returns {Object} config suitable for use with Application.verb()
 */
function JstFile(path, options) {
    options = options || {};
    return {
        path         : path,
        file         : new File(path),
        lastModified : 0,
        options      : options,
        mimeType     : options.mimeType || 'text/html',
        handler      : function(me, req, res) {
            try {
                res.data = {};
                var jst = getJst(me.path);
                res.include = function(fn) {
                    var jst = getJst(fn);
                    if (typeof jst === 'number' && me.options.jstPath) {
                        jst = getJst(me.options.jstPath + '/' + fn);
                    }
                    if (typeof jst === 'number') {
                        return jst;
                    }
                    res.source = jst.source;
                    res.compiled = jst.compiled;
                    jst.fn(req, res);
                };
                res.out = '';
                res.options = me.options;
                try {
                    var content = jst.fn(req, res);
                    if (options.gzip !== false && req.gzip) {
                        content = GZIP.compress(content);
                        res.writeHead(200, {
                            'Content-Type' : me.mimeType,
                            'Content-Encoding' : 'gzip'
                        });
                    }
                    else {
                        res.writeHead(200, {
                            'Content-type' : me.mimeType
                        });
                    }
                    res.end(content);
                    return 200;
                }
                catch (e) {
                    console.log('YIKES')
                    console.dir(e);
                    if (typeof e === 'number') {
                        return e;
                    }
                    throw e;
                }
            }
            catch (e) {
                console.dir(e);
                res.source = e.source;
                res.compiled = e.compiled;
                res.error = e.e;
                throw e.e;
            }
        }

    };
}
decaf.extend(exports, {
    JstServer : JstServer,
    JstFile   : JstFile
});
