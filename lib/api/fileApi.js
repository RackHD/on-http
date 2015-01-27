'use strict';
var di = require('di'),
    config = require('../../../config.js'),
    crypto = require('crypto'),
    zlib = require('zlib');



// get / set appropriate file backend

module.exports = factory;
di.annotate(factory, new di.Provide('Files.Api')); // change this name too
di.annotate(factory,
    new di.Inject(
        'Files.FS',
        'Files.NFS',
        'Files.MDB'
        )
);


function factory(FS,NFS,MDB) {

    function FileFetcher() { //change this terrible name
        this.config = config;
        this.gzip = zlib.createGzip();
        this.md5sum = crypto.createHash('md5');
        this.shasum = crypto.createHash('sha256');

        var BackEnd = require(this.config.backEnd);
        this.backend = new BackEnd(this.config);

        return this;
    }

    FileFetcher.prototype.get = function(res, query) {
        return this.backend.get(query).pipe(res);
    };

    FileFetcher.prototype.put = function(req, query) {
        return req.pipe(this.backend.put(query));
    };

/*
    FileFetcher.prototype.verify = function(res, query) {

    }

    FileFetcher.prototype.list = function() {

    }
*/
    FileFetcher.prototype.reconfig = function(newConfig) {
        this.config = newConfig;

        var BackEnd = require(this.config.backEnd);
        this.backend = new BackEnd(this.config);
    };

    return new FileFetcher();
}

