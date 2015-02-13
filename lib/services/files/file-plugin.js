'use strict';

var di = require('di');
di.annotate(factory, new di.Provide('Files.FS'));
di.annotate(factory,
    new di.Inject(
        'Q',
        'Services.Waterline',
        'uuid',
        'Assert',
        '_'
        )
);

var fs = require('fs'),
    path = require('path');

module.exports = factory;

function factory(Q, waterline, uuid, assert,  _) {

    function FileManager(config) {
        this.config = config;
        this.root = config.root;
        return this;
    }


    FileManager.prototype.exists = function(fileObj) {
        assert.object(fileObj, "file Object");
        var deferred = Q.defer();

        fs.exists(path.join(this.root, fileObj.filename), function(exists) {
            if (exists) {
                deferred.resolve(fileObj);
            } else {
                var error = new Error('File not found');
                error.name = '404';
                deferred.reject('err');
            }
        });
        return deferred.promise;
    };

    FileManager.prototype.unlink = function(fileObj) {
        assert.object(fileObj, "file Object");
        var deferred = Q.defer();

        fs.unlink(path.join(this.root, fileObj.filename), function(err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(fileObj);
            }
        });

        return deferred.promise;
    };

    FileManager.prototype.createWriteStream = function(file) {
        return fs.createWriteStream(path.join(this.root + file));
    };


    FileManager.prototype.createReadStream = function(file) {
        return fs.createReadStream(path.join(this.root + file));
    };


    FileManager.prototype.createEntry = function(fileObj) {
        assert.object(fileObj, "file Object");

        return Q.resolve(waterline.files.create(fileObj));
    };

    FileManager.prototype.destroyEntry = function(fileObj) {
        assert.object(fileObj, "file Object");

        return Q.resolve(waterline.files.destroy(fileObj));
    };


    FileManager.prototype.findOneEntry = function(fileObj) {
        assert.object(fileObj, "file Object");
        var deferred = Q.defer();

        waterline.files.findOne(fileObj)
        .exec(function(err, file) {
            if (err) {
                deferred.reject(err);
            } else if (!file) {
                var error = new Error('File not found');
                error.name = '404';
                deferred.reject('file not found');
            } else {
                deferred.resolve(file);
            }
        });

        return deferred.promise;
    };

    FileManager.prototype.findEntries = function(fileObj) {
        assert.object(fileObj, "file Object");
        var deferred = Q.defer();

        waterline.files.find(fileObj)
        .exec(function(err, fileArray) {
            err ? deferred.reject(err) : deferred.resolve(fileArray);
        });

        return deferred.promise;
    };

    FileManager.prototype.get = function(query) {
        var self = this;

        return this.findOneEntry({uuid: query})
        .then(function(file) {
            return self.exists(file);
        })
        .then(function(file) {
            return Q.resolve(self.createReadStream(file.filename));
        });

    };


    FileManager.prototype.put = function(query) {
        var self = this,
            id = uuid('v4'),
            ext = path.extname(query),
            filename = path.basename(query, ext) + '_' + id + ext;

            return Q.resolve({
                stream: self.createWriteStream(filename),
                filename: filename,
                id: id
            })
            .then(function(streamObj) {
                 streamObj.stream.on('metadata', function(meta) {
                    Q.resolve(self.createEntry({
                            basename: query,
                            filename: filename,
                            uuid: id,
                            md5: meta.md5,
                            sha256: meta.sha256
                        })
                    )
                    .then(function() {
                        streamObj.stream.emit('ready');
                    })
                    .catch(function(err) {
                        streamObj.stream.emit('error', err);
                        fs.unlink(path.join(self.root, filename));
                    });
                 });

                 return streamObj;
        });
    };


    FileManager.prototype.getMeta = function(query) {
        return this.list({basename: query})
        .then(function(fileArray) {
            if (_.isEmpty(fileArray)){
                var error = new Error("File not found");
                error.name = "404";
                return Q.reject(error);
            } else {
                return Q.resolve(fileArray);
            }
        });
    };


    FileManager.prototype.delete = function(query) {
        var self = this;

        return this.findOneEntry({uuid: query})
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
            return Q.resolve(files);
        });
    };

    return FileManager;
}
