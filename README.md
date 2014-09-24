# Jolt

Jolt is a WWW application framework inspired by Sinatra and ExpressJS.  It is NOT a clone of either or even a work-alike of either.  It is built on top of decaf's http server module.

There is a reasonably extensive example Jolt application in the examples/ directory of the decaf GitHub repository.

You instantiate an Application instance:

```javascript
var Application = require('jolt').Application,
	app = new Application();
```

## Anatomy of a URL

Command lines in the Unix shell (OSX Terminal) have the form:

	command [arg...]

The command executes and is passed the arguments that follow.  The shell (bash, zsh, etc.) may process the arguments you type, substituting $VARIABLES, expanding wildcard patterns into a list of filenames, and so on.  A "C" program main() function is passed an array of arguments; it is up to the program to use those arguments as it sees fit.

If you've used the command line (terminal), you're likely to be aware of how command lines are formed.  An example is the bower command, which installs packages from github:

	bower help
	
"bower" is the command name, or "verb" and "help" is the argument to the command.  If you enter this on the command line, bower prints out a summary of how to use the command and what its possible arguments might be.
	
**In Jolt, we treat the URL like a command line.**

The URL is split on the ```/``` character.  The first element of the resulting array is a "verb" (or command) in Jolt terms.  The remaining elements are arguments to your verb.

If the requested URL is "/blog/about-jolt" then the verb is "blog" and the arguments are "about-jolt".

The req object is augmented by Jolt to include a req.verb member that will contain "blog" in our example, and a req.args array that will contain [ "about-jolt" ].

You route verbs to handler functions or objects that have handler members that are functions.  This is done with the app.verb() method:

```javascript
app.verb('blog', function(config, req, res) {
   res.send('blog entry requested is ' + req.args[0]);
));
```

The config argument passed your handler is an object that contains a handler member pointing at your handler function.  You can add to this config object in your handler function as you see fit.  Just don't replace the handler member with some incompatible value or delete it.

```
app.verb('blog', {
	blogDir: 'blog-posts',
	handler: function(config, req, res) {
		res.send('blog requested: ' + config.blogDir + '/' + req.args[0]);
	});
})
```

Note that the **verbs must not contain a ```/``` character**, except in the case of the special "/" verb, which is the function called when the request URI is "/".

```
// if the requested URI is http://whatever.com/, this verb is called:
app.verb('/', function(config, req, res) {
	res.send('Site Home Page');
});
```

## Error Handling

So what happens if the requested URI does not contain a verb that is implemented? Or if your handler function determines it wants to return a status other than 200?

Jolt's Application class has default handlers for 403 errors, 404 errors and 500 errors.  

If the requested URI satisfies none of your verb, the default 404 handler gets run.  

Your verbs' handlers are called within a try/catch block; if there's an error thrown, the default 500 handler is called.  Note that if you call res.stop() which throws 'RES.STOP', the 500 handler is not called.

You can override these two handlers or add handlers for any other status code:

```
app.errorHandler(403, function(req, res) {
	res.send(403, 'Not authorized');
});

// or

app.errorHandler(403, {
	someMember: 'some value',
	handler: function(config, req, res) {
		res.send(403, 'Not authorized to access this page, get authorized! ' + config.someMember);
	}
});
```

If your verb handler functions return a number, the number is assumed to be the non-200 status code for the response.  The errorHandler for that status code will be called.

If a handler for a verb throws an error, it will be caught and res.error is set to the caught exception object (res.error is normally undefined).  If you have provided a 500 errorHandler, it will be called with an additional (last/final) argument that is the default function to handle 500 errors.  You may find it useful to do something when exceptions occur and call the default handler to generate the HTML with stack trace and other information from res.error.

## Application Events

The Application instance provides two methods for binding and triggering events.  These methods are:

	app.on(eventName, listenerFn)
	app.fire(eventName, varargs)

You can define any eventNames you like, though two are reserved by Jolt.  Whatever variable list of arguments you pass to app.fire() are passed as arguments to your listener function (listenerFn).  You may have as many listeners for a single event; call app.on() for each.  The listeners will be called in the order bound.

The Application constructor calls http.createServer() and supplies an internal request handler function that does the verb/arguments processing and request routing, and so on.  

### beginRequest

Before the actual verb handler function is called, it fires the 'beginRequest' event (eventName) with req and res as arguments.  Your listeners will have access to both, and may alter any values in both.  

One reason to implement a beginRequest event handler might be to implement server-side sessions.  The event handler would look at ```req.cookies``` to see if a session cookie has been sent by the browser.  If the cookie is present, the session data is fetched from whatever backing store (file system, database, memory, etc.) and is added to the req object as ```req.session```.  If the cookie is not set, the method sets the cookie by calling res.setCookie() and initializes a session object and sets it as ```req.session```.  The application may access and modify ```req.session``` in a similar manner as sessions are used in other languages.

Another reason might be to implement a sort of mod_rewrite equivalent.  The event handler would examine req.uri and if the conditions are right, set req.verb and req.args to something else.  For example, our event handler sees ```req.uri``` is ```/admin/users``` and modifies the verb to 'adminUsers.'  The user sees '/admin/users' in his browser address bar, but the code doesn't have to implement a 'admin' verb that switches on the first argument (users) to figure out the real action to be performed. 

### endRequest

The 'endRequest' event is fired after the response (headers and response body) has been sent.  The event listener functions are passed req and res.  Modifying either has no effect at this point, but they certainly contain useful information, like the requested URI, the effective verb and arguments, the response status code (e.g. 200, 404, etc.), and so on.

If you're implementing server-side sessions, you might add an endRequest handler that copies req.session to the backing store.

## Jolt Verb handlers

Jolt provides a handful of handy helper classes that implement handlers for common use cases:

* StaticServer
* CoffeeScriptServer
* JstServer
* LessServer
* SjsServer
* StylusServer

These handlers replace the need for "watchers" for various languages.  You can edit files served by these handlers and reload your browser and see the changes take effect immediately without restarting your server.

The general rule is if you modify some file that is loaded via require(), you **WILL** need to restart your server.  Otherwise you won't.

### StaticServer

Applications almost always need to serve static files from a directory heirarchy.  Jolt provides the StaticServer  class for this purpose.  Simply put your static files in a directory structure and use the class something like this:

```javascript
app.verb('static', new StaticServer('/path/to/static/files'));
```

All requested URLs beginning with /static/ will be served from /path/to/static/files.  Examples:
```
    /static/a.js will be served from /path/to/static/files/a.js
    /static/a/b.js will be served from /path/to/static/files/a/b.js
    etc.
```
Remember, a verb cannot have a / in it.  The path/to/static/files may be absolute (anywhere in the file system) or relative (as in relative to the project/app/site root directory).

You may have more than one verb that uses StaticServer.  Consider:
```javascript
    app.verb('js', new StaticServer('client/scripts'));
    app.verb('css', new StaticServer('client/stylesheets'));
```
In this example, /js/whatever will be served from the relative path ./client/scripts/whatever, and /css/whatever will be served from the relative path ./client/stylesheets/whatever.

StaticServer handles serving static files from directories, but sometimes you want to serve a single static file for a specific verb.  Consider:
```javascript
    app.verb('/', new StaticFile('client/index.html'));
    app.verb('favicon.ico', new StaticFile('client/resources/favicon.ico'));
```
In this example, requests for / (index.html) will be served from client/index.html and /favicon.ico will be served from ./client/resources/favicon.ico.

### CoffeeScriptServer

Jolt facilitates the implementation of all or part of your server application in CoffeeScript via the CoffeeScriptServer class.  Simply put your .coffee files in a subdirectory and use the class something like this:

```
app.verb('coffee', new CoffeeScriptServer('path/to/your-coffee-files'));
```

When the user hits a URL like ```/coffee/abc``` the file 'path/to/your-coffee-files/abc.coffee' is "executed" to serve the request.  If the URL is ```/coffee/abc/def``` the file 'path/to/your-coffee-files/abc/def.coffee' is "executed."  If the URL specifies a directory (not a file) in path/to/your-coffee-files, then the this implementation tries to serve the file index.coffee in that subdirectory.

When CoffeeScriptServer "executes" a .coffee file for the first time, it loads the file from disk, compiles it into JavaScript source, then creates a new Function(req, res) for it and then calls that function.  The Function is remembered.

The second (and subsequent) time the URI for the file is requested, CoffeeScriptServer checks the file modification time on the file and compares with the file modification time of the file used to create the Function and only if the file on disk is newer is the Function recompiled/recreated.  

This eliminates the need for some sort of "watcher" program that compiles .coffee into .js as a separate task you run from the command line.  Jolt does the "watch" functionality automatically, and simply does the right thing.

Keep in mind that your CoffeeScript program is wrapped in a function that takes two arguments, req, and res.  This means there will be req and res variables available to use.  See the http module documentation for the members of these, and note the additions made by Jolt itself.

### JstServer

Jst is a simple PHP-like or JSP-like template language that compiles into JavaScript.  Jst source files may contain any arbitrary text, with two exceptions.  Text between ```<%``` and ```%>``` tags is raw JavaScript and simply is executed in line.  And text between ```<%=``` and ```%>``` tags is replaced with the value of the JavaScript expression within those tags.

Jst scripts do not call the res object methods to write content to the browser.  Instead they call print(s), and println(s).  These append strings to a special res.out member that will ultimately contain the response body.  The scripts **MAY** set cookies, set headers, set the content-type header, etc., in the res object.

A special version of include() is implemented for Jst scripts.  This is required so the text generated by the included Jst is added to res.out properly.

The default content type is 'text/html' but you might create CSS with Jst (works great!) and you'd need to set the content type to 'text/css'.

Jolt facilitates the implementation of all or part of your server application in Jst via the JstServer class.  

```
app.verb('jst', new JstServer('path/to/your-jst-files'[, options ]));
```

Or

```
app.verb('hello', new JstFile('path/to/hello.jst'[, options ]));
```

The JstServer class executes Jst scripts within a directory, much like CoffeeScriptServer serves its scripts.  If the URL requested is a subdirectory within 'path/to/your-jst-files', then this class tries to serve the index.jst file in that directory.

The JstFile class associates an absolute verb to a Jst script; it does not serve scripts from within a directory.  The following example sets the site home page to be served by '/path/to/your-jst-files/default.jst':

```
app.verb('/', new JstFile('path/to/your-jst-files/default.jst'));
```

The power of include() is that you can implement a common site header in a .jst file and include() it in all your page sources, and similarly you can implement footer, navigation, etc.

It is probably a good idea to store your include() .jst files in a directory that is not being served by Jolt.  You may include() files from any path on your hard drive!  But you will need to tell JstFile or JstServer where to find these include() files.  This is done via the optional ```options``` hash/argument:

```
app.verb('jst', new JstServer('path/to/your-jst-files', {
	jstPath: 'path/to/your-jst-includes'
}));
```

By default, Jolt gzip compresses responses if the client accepts those.  If you want to disable gzip, you can set ```gzip: false`` in the options hash.

Additionally, any options you pass in, whether they are jstPath or gzip or anything else you choose, they will appear to your Jst scripts in the ```res.options``` member variable/hash.

The first time a Jst script is requested or included, it will be loaded from the file system, compiled into JavaScript, and made into a function and that function called.  Each successive time the script is requested or included, the file modification time on the disk file is checked against the modification time of the file that was loaded; if the disk file is newer, it is loaded and compiled and made into a Function and called.  

### LessServer

Less is a dyanmic stylesheet language documented at <http://lesscss.org/>.

The LessServer class serves LESS files from a directory structure, much like a static WWW server.  The difference is that the files served are run through the Less compiler.  The compiled results are stored in memory and served over and over again until the modification time on the file on disk is changed to newer than the file that was compiled.  

```
app.verb('less', new LessServer('path/to/your-less-files'));
```

### SjsServer

Sjs stands for "Server-side JavaScript."  

The SjsServer class serves .sjs files from a directory structure, much like a static WWW server.  Each .sjs file is compiled into a Function() when the URI associated with it is requested the first time.  Each successive request, the Function() is simply called, unless the .sjs file has changed on disk.  If it has changed, it is recompiled into a Function() and the new Function() used going forward. 

This behavior allows you to write, run, and debug your server-side JavaScript without restarting the server.

