/**
 * The jolt application server
 *
 * @module jolt
 * @main jolt
 */
/*global require, exports */

decaf.extend(exports, {
    Application: require('lib/Application').Application,
    StaticServer: require('lib/StaticServer').StaticServer,
    StaticFile: require('lib/StaticServer').StaticFile,
    SjsServer: require('lib/SjsServer').SjsServer,
    SjsFile: require('lib/SjsServer').SjsFile,
    JstServer: require('lib/JstServer').JstServer,
    JstFile: require('lib/JstServer').JstFile,
    LessServer: require('lib/LessServer').LessServer,
#    StylusServer: require('lib/StylusServer').StylusServer,
    CoffeeScriptServer: require('lib/CoffeeScriptServer').CoffeeScriptServer
});
