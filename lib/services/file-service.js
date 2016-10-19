// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    crypto = require('crypto'),
    stream = require('stream'),
    util = require('util');


module.exports = factory;
di.annotate(factory, new di.Provide('fileService'));
di.annotate(factory,
    new di.Inject(
        "Assert",
        "_",
        di.Injector,
        'Errors',
        'Constants'
    )
);

function HashStream() {
    this.md5 = crypto.createHash('md5');
    this.sha256 = crypto.createHash('sha256');
    stream.Transform.call(this);
    return this;
}

util.inherits(HashStream, stream.Transform);

HashStream.prototype._transform = function (chunk, encoding, done) {
    this.md5.update(chunk);
    this.sha256.update(chunk);
    this.push(chunk);
    done();
};

HashStream.prototype._flush = function (done) {
    this.hashes = {
        md5: this.md5.digest('hex'),
        sha256: this.sha256.digest('hex')
    };
    done();
};

function factory(assert, _, injector, Errors, Constants) {

    function FileStreamer() {
        this.injectorMap = {
            FileSystem: 'Files.FS'
        };

        this.backEnds = {};
        this.defaultBackend = 'defaultBackend';
        return this;
    }

    FileStreamer.prototype.get = function(uuid, backend) {
        backend = backend || this.defaultBackend;
        assert.ok(backend in this.backEnds, "fileService backend");

        return this.backEnds[backend].get(uuid);

    };

    FileStreamer.prototype.put = function(rdStream, filename, backend) {
        backend = backend || this.defaultBackend;
        assert.ok(backend in this.backEnds, "fileService backend");

        var hashStream = new HashStream();

        return this.backEnds[backend].put(filename)
            .then(function(streamObj) {
                assert.object(streamObj, "write stream object");

                hashStream.on('end', function() {
                    streamObj.stream.emit('metadata', hashStream.hashes);
                });

                hashStream.pipe(streamObj.stream);
                return {
                    writeStream:streamObj.stream,
                    transformHashStream: hashStream,
                    id: streamObj.id
                };
            });
    };

    FileStreamer.prototype.delete = function(uuid, backend) {
        backend = backend || this.defaultBackend;
        assert.ok(backend in this.backEnds, "fileService backend");

        return this.backEnds[backend].delete(uuid);
    };

    FileStreamer.prototype.verify = function(uuid, backend) {
        backend = backend || this.defaultBackend;
        assert.ok(backend in this.backEnds, "fileService backend");

        return this.backEnds[backend].getMeta(uuid);
    };

    FileStreamer.prototype.list = function(query, backend) {
        backend = backend || this.defaultBackend;
        assert.ok(backend in this.backEnds, "fileService backend");

        query = query || {};

        return this.backEnds[backend].list(query);
    };

    FileStreamer.prototype.getFile = function(req, res, id) {
        var self = this;
        var uuidFound;

        if (id.match(Constants.Regex.uuid)) {
            uuidFound = Promise.resolve(id);
        } else {
            uuidFound = self.verify(id)
                .then(function(metadata) {
                    return metadata[metadata.length - 1].uuid;
                });
        }

        return new Promise(function(resolve, reject) {
            uuidFound
                .then(function(uuid) {
                    if (!uuid) {
                        reject(new Errors.NotFoundError('File: ' + id + ' not found'));
                    }
                    return self.get(uuid);
                })
                .then(function(rdStream) {
                    rdStream.on('error', function(err) {
                        reject(new Errors.BadRequestError(
                            'Failed to serve file request: ' + err.message)
                        );
                    });
                    rdStream.on('end', function() {
                        resolve();
                    });
                    rdStream.pipe(res);
                }, function(err) {
                    reject(new Errors.NotFoundError(
                        'Failed to get stream reader: ' + err.message)
                    );
                })
                .catch(function(err) {
                    reject(new Errors.NotFoundError(
                        'Failed to serve file request: ' + err.message)
                    );
                });
        });
    };

    FileStreamer.prototype.putFile = function(req, filename) {
        var self = this;

        return new Promise(function(resolve, reject) {
            self.put(req, filename)
                .then(function(streamObj){
                    streamObj.transformHashStream.on('error', function(err) {
                        reject(new Errors.BadRequestError(
                            'Failed to serve file request: ' + err.message)
                        );
                    });

                    streamObj.writeStream.on('ready', function() {
                        //todo make me work with uuid
                        resolve(
                            self.getFileMetadata(filename)
                        );
                    });

                    streamObj.writeStream.on('error', function(err) {
                        reject(new Errors.BadRequestError(
                            'Failed to serve file request: ' + err.message)
                        );
                    });
                    req.pipe(streamObj.transformHashStream);
                })
                .catch(function(err) {
                    reject(new Errors.NotFoundError(
                        'Failed to serve file request: ' + err.message)
                    );
                });
        });
    };

    FileStreamer.prototype.getFileMetadata = function(filename) {
        var self = this;

        return new Promise(function(resolve, reject) {
            self.verify(filename)
                .then(function(metadata){
                    resolve(metadata[metadata.length - 1]);
                })
                .catch(function(err) {
                    reject(new Errors.NotFoundError(
                        'Failed to serve file request: ' + err.message)
                    );
                });
        });
    };

    FileStreamer.prototype.getFilesAll = function() {
        var self = this;

        return new Promise(function(resolve, reject) {
            self.list()
                .then(function(files){
                    resolve(files);
                })
                .catch(function(err) {
                    reject(new Errors.NotFoundError(
                        'Failed to serve file request: ' + err.message)
                    );
                });
        });
    };

    FileStreamer.prototype.deleteFile = function(uuid) {
        var self = this;

        return new Promise(function(resolve, reject) {
            self.delete(uuid)
                .then(function() {
                    resolve();
                })
                .catch(function(err) {
                    reject(new Errors.NotFoundError(
                        'Failed to serve file request: ' + err.message)
                    );
                });
        });
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

        if(!_.has(self.backEnds,self.defaultBackend)) {
            throw new Error("No defaultBackend in config");
        }

        return;
    };

    return new FileStreamer();
}
