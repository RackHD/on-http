// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');
di.annotate(factory, new di.Provide('Files.FS'));
di.annotate(factory,
    new di.Inject(
        'Promise',
        'Errors',
        'Services.Waterline',
        'uuid',
        'Assert',
        '_',
        'fs')
);

var path = require('path');

module.exports = factory;

function factory(Promise, Errors, waterline, uuid, assert,  _, fs) {

    fs = Promise.promisifyAll(fs);

    function FileManager(config) {
        this.config = config;
        this.root = config.root;
        return this;
    }


    FileManager.prototype.exists = function(fileObj) {
        assert.object(fileObj, "file Object");
        var self = this;
        return new Promise(function (resolve, reject) {
            fs.exists(path.join(self.root, fileObj.filename), function(exists) {
                if (exists) {
                    resolve(fileObj);
                } else {
                    var error = new Errors.NotFoundError('File not found on disk');
                    reject(error);
                }
            });
        });
    };

    FileManager.prototype.unlink = function(fileObj) {
        assert.object(fileObj, "file Object");
        var self = this;
        return new Promise(function (resolve, reject) {
            fs.unlink(path.join(self.root, fileObj.filename), function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(fileObj);
                }
            });
        });
    };

    FileManager.prototype.createWriteStream = function(file) {
        return fs.createWriteStream(path.join(this.root, file));
    };


    FileManager.prototype.createReadStream = function(file) {
        return fs.createReadStream(path.join(this.root, file));
    };


    FileManager.prototype.createOrUpdateEntry = function(fileObj) {
        assert.object(fileObj, "file Object");
        var query = { basename: fileObj.basename };

        return this.findOneEntry(query)
        .then(function(record) {
            fileObj.uuid = record.uuid;
            return waterline.files.update(query, fileObj);
        })
        .catch(function(err) {
            if (err instanceof Errors.NotFoundError) {
                return waterline.files.create(fileObj);
            }
            throw err;
        });
    };

    FileManager.prototype.destroyEntry = function(fileObj) {
        assert.object(fileObj, "file Object");

        return Promise.resolve(waterline.files.destroy(fileObj));
    };


    FileManager.prototype.findOneEntry = function(fileObj) {
        assert.object(fileObj, "file Object");

        return new Promise(function (resolve, reject) {
            waterline.files.findOne(fileObj)
            .exec(function(err, file) {
                if (err) {
                    reject(err);
                } else if (!file) {
                    var error = new Errors.NotFoundError('File not found in database');
                    reject(error);
                } else {
                    resolve(file);
                }
            });
        });
    };

    FileManager.prototype.findEntries = function(fileObj) {
        assert.object(fileObj, "file Object");

        return new Promise(function (resolve, reject) {
            waterline.files.find(fileObj)
            .exec(function(err, fileArray) {
                err ? reject(err) : resolve(fileArray);
            });
        });
    };

    FileManager.prototype.get = function(uuid) {
        var self = this,
            query = {uuid: uuid};

        return this.findOneEntry(query)
        .then(function(data) {
            return self.exists(data);
        })
        .then(function(file) {
            return Promise.resolve(self.createReadStream(file.filename));
        });

    };

    var _onMetadata = function(stream, query, filename, id, metadata) {
        var self = this;

        return self.createOrUpdateEntry({
            basename: query,
            filename: filename,
            uuid: id,
            md5: metadata.md5,
            sha256: metadata.sha256
        })
        .then(function(fileObj) {
            return self.exists(fileObj)
            .then(function(fileObj) {
                return self.unlink(fileObj);
            })
            .catch(function() {
                return fileObj;
            });
        })
        .then(function(fileObj) {
            return fs.renameAsync(path.join(self.root, 'unresolved_'+filename),
                           path.join(self.root, filename))
            .then(function() {
                return fileObj;
            });
        })
        .then(function() {
            stream.emit('ready');
        })
        .catch(function(err) {
            stream.emit('error', err);
            return fs.unlinkAsync(path.join(self.root, 'unresolved_'+filename));
        });
    };

    FileManager.prototype.put = function(query) {
        var id = uuid('v4');
        var filename = path.basename(query);
        var wrStream = this.createWriteStream('unresolved_'+filename);

        wrStream.on('metadata', _onMetadata.bind(
            this, wrStream, query, filename, id
        ));

        return Promise.resolve({
            stream: wrStream,
            filename: filename,
            id: id
        });
    };


    FileManager.prototype.getMeta = function(query) {
        return this.list({basename: query})
        .then(function(fileArray) {
            if (_.isEmpty(fileArray)){
                var error = new Errors.NotFoundError("File not found in database");
                return Promise.reject(error);
            } else {
                return Promise.resolve(fileArray);
            }
        });
    };


    FileManager.prototype.delete = function(uuid) {
        var self = this,
            query = {uuid: uuid};

        return this.findOneEntry(query)
        .then(function(file) {
            return self.exists(file);
        })
        .then(function(file) {
            return self.unlink(file);
        })
        .then(function(file){
            return self.destroyEntry({filename: file.filename});
        });

    };



    FileManager.prototype.list = function(query) {
        return this.findEntries(query)
    };

    return FileManager;
}
