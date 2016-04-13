// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');
di.annotate(factory, new di.Provide('Files.FS'));
di.annotate(factory,
    new di.Inject(
        'Promise',
        'Services.Waterline',
        'uuid',
        'Assert',
        '_'
        )
);

var fs = require('fs'),
    path = require('path');

module.exports = factory;

function factory(Promise, waterline, uuid, assert,  _) {

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
                    var error = new Error('File not found on disk');
                    error.name = '404';
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


    FileManager.prototype.createEntry = function(fileObj) {
        assert.object(fileObj, "file Object");

        return Promise.resolve(waterline.files.create(fileObj));
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
                    var error = new Error('File not found in database');
                    error.name = '404';
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
            waterline.files.find({where: fileObj, sort: 'updatedAt DESC'})
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


    FileManager.prototype.put = function(query) {
        var self = this,
            id = uuid('v4'),
            filename = path.basename(query) + '_' + id;

            var wrStream = self.createWriteStream('unresolved_'+filename);

            wrStream.on('metadata', function(meta) {
                self.createEntry({
                    basename: query,
                    filename: filename,
                    uuid: id,
                    md5: meta.md5,
                    sha256: meta.sha256
                })
                .then(function() {
                    wrStream.emit('ready');

                    return new Promise(function(resolve, reject) {
                        fs.rename(
                            path.join(self.root, 'unresolved_'+filename),
                            path.join(self.root, filename),
                            function(err, result) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(result);
                                }
                            }
                        );
                    });
                })
                .catch(function(err) {
                    fs.unlink(path.join(self.root, 'unresolved_'+filename));
                    wrStream.emit('error', err);
                });
            });

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
                var error = new Error("File not found in database");
                error.name = "404";
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
        .then(function(fileArray) {

            var files = _.map(fileArray, function(file) {
                    return file.toJSON();
                });
            return Promise.resolve(files);
        });
    };

    return FileManager;
}
