'use strict';
var di = require('di'),
    _ = require('lodash'),
    crypto = require('crypto'),
    stream = require('stream');


module.exports = factory;
di.annotate(factory, new di.Provide('fileService'));
di.annotate(factory,
    new di.Inject(
        di.Injector
    )
);


function factory(injector) {

    var assert = injector.get('Assert');

    var hashStream = new stream.Transform();
    hashStream.md5 = crypto.createHash('md5');
    hashStream.sha256 = crypto.createHash('sha256');

    hashStream._transform = function (chunk, encoding, done) {
        this.md5.update(chunk);
        this.sha256.update(chunk);
        this.push(chunk);
        done();
    };

    hashStream._flush = function (done) {
        this.hashes = {
            md5: this.md5.digest('hex'),
            sha256: this.sha256.digest('hex')
        };
        done();
    };

    function FileStreamer() {
        this.injectorMap = {
            FileSystem: 'Files.FS'
                };

        this.backEnds = {};

        return this;
    }


    FileStreamer.prototype.get = function(query, backend) {
        backend = backend || 'defaultBackend';
        assert.ok(backend in this.backEnds);


        return this.backEnds[backend].get(query.filename);

    };

    FileStreamer.prototype.put = function(rdStream, query, backend) {
        backend = backend || 'defaultBackend';
        assert.ok(backend in this.backEnds);



        return this.backEnds[backend].put(query.filename)
            .then(function(writeStream) {
                    hashStream.on('end', function() {
                        writeStream.emit('metadata', hashStream.hashes);
                    });
                 hashStream.pipe(writeStream);
                    return hashStream;
            });
    };

    FileStreamer.prototype.delete = function(query, backend) {
        backend = backend || 'defaultBackend';
        assert.ok(backend in this.backEnds);

        return this.backEnds[backend].delete(query.filename);
    };

    FileStreamer.prototype.verify = function(query, backend) {
        backend = backend || 'defaultBackend';
        assert.ok(backend in this.backEnds);

        return this.backEnds[backend].getMeta(query.filename);
    };



    FileStreamer.prototype.list = function(backend) {
        backend = backend || 'defaultBackend';
        assert.ok(backend in this.backEnds);

        return this.backEnds[backend].list();
    };



    FileStreamer.prototype.start = function(config) {
        var self = this;
        self.config = config;

        _.forEach(self.config, function(contents, key) {
            if (!(contents.type in self.injectorMap)) {
                throw new Error("unrecognized back end string");
            }
            var BackEndConstructor  = injector.get(self.injectorMap[contents.type]);
            self.backEnds[key] = new BackEndConstructor(contents);
        });

        if(!("defaultBackend" in self.backEnds)) {
            throw new Error("No defaultBackend in config");
        }

        return;
    };

    return FileStreamer;
}

