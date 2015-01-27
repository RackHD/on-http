'use strict';

var di = require('di');
di.annotate(factory, new di.Provide('Files.FS'));

var fs = require('fs');

module.exports = factory;

function factory() {

    function FileManager(config) { // also change this bad name

        this.config = config; //may need this may not
        this.root = config.fileRoot;
        return this;
    }

    FileManager.prototype.get = function(query) {
        return fs.createReadStream(this.root + query.filename);
    };

    FileManager.prototype.put = function(query) {
        return fs.createWriteStream(this.root + query.filename);
    };

    FileManager.prototype.verify = function(query) {
        query;
        // fs.exists blah blah
    };

    return FileManager;
}
