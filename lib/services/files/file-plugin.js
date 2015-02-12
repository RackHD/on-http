'use strict';

var di = require('di');
di.annotate(factory, new di.Provide('Files.FS'));
di.annotate(factory, new di.Inject(
            'Q',
            'Services.Waterline',
            'uuid'
            ));

var fs = require('fs'),
    path = require('path'),
    _ = require('lodash');

module.exports = factory;

function factory(q, waterline, uuid) {

    function FileManager(config) {
        this.config = config;
        this.root = config.root;
        return this;
    }


    FileManager.prototype.exists = function(fileObj) {
        var deferred = q.defer();

        fs.exists(this.root + fileObj.filename, function(exists) {
            if (exists) {
                deferred.resolve(fileObj);
            } else {
                deferred.reject('file not found');
            }
        });
        return deferred.promise;
    };

    FileManager.prototype.unlink = function(fileObj) {
        var deferred = q.defer();

        fs.unlink(this.root + fileObj.filename, function(err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(fileObj);
            }
        });

        return deferred.promise;
    };

    FileManager.prototype.createWriteStream = function(file) {
        return fs.createWriteStream(this.root + file);
    };


    FileManager.prototype.createReadStream = function(file) {
        return fs.createReadStream(this.root + file);
    };


    FileManager.prototype.createEntry = function(fileObj) {
        var deferred = q.defer();

        waterline.files.create(fileObj)
        .exec(function(err, file) {
            err ? deferred.reject(err) : deferred.resolve(file);
        });

        return deferred.promise;
    };

    FileManager.prototype.destroyEntry = function(fileObj) {
        var deferred = q.defer();

        waterline.files.destroy(fileObj)
        .exec(function(err) {
            err ? deferred.reject(err) : deferred.resolve('file deleted');
        });

        return deferred.promise;
    };


    FileManager.prototype.findOneEntry = function(fileObj) {
        var deferred = q.defer();

        waterline.files.findOne(fileObj)
        .exec(function(err, file) {
            if (err) {
                deferred.reject(err);
            } else if (!file) {
                deferred.reject('file not found');
            } else {
                deferred.resolve(file);
            }
        });

        return deferred.promise;
    };

    FileManager.prototype.findEntries = function(fileObj) {
        var deferred = q.defer();

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
            return q.resolve(self.createReadStream(file.filename));
        });

    };


    FileManager.prototype.put = function(query) {
        var self = this,
            id = uuid('v4'),
            ext = path.extname(query),
            filename = path.basename(query, ext) + '_' + id + ext;

            return q.resolve({
                stream: self.createWriteStream(filename),
                id: id
            })
            .then(function(streamObj) {
             streamObj.stream.on('metadata', function(meta) {
                self.createEntry({
                    basename: query,
                    filename: filename,
                    uuid: id,
                    md5: meta.md5,
                    sha: meta.sha256
                });
             });

             return streamObj;
        });
    };


    FileManager.prototype.getMeta = function(query) {
        return this.list({basename: query});
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
            return q.resolve(files);
        });
    };

    return FileManager;
}
