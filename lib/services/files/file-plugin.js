'use strict';

var di = require('di');
di.annotate(factory, new di.Provide('Files.FS'));
di.annotate(factory, new di.Inject('Q'));
var fs = require('fs'),
    path = require('path'),
    _ = require('lodash');

module.exports = factory;

function factory(q) {

    function FileManager(config) {

        this.config = config;
        this.root = config.root;
        return this;
    }

    FileManager.prototype.get = function(query) {
        var deferred = q.defer(),
            self = this;

        fs.exists(self.root + query, function(exists){
            if (exists) {
                deferred.resolve(fs.createReadStream(self.root + query));
            } else {
                deferred.reject("file not found");
            }
        });

        return deferred.promise;
    };

    FileManager.prototype.put = function(query) {
        var deferred = q.defer(),
            self = this;

        fs.exists(self.root + query,function(exists) {
            if (exists) {
                deferred.reject("file already exists");
            } else {
                deferred.resolve(fs.createWriteStream(self.root + query));
            }
        });

        return deferred.promise.then(function(wStream) {
             wStream.on('metadata', function(meta) {
                fs.writeFile(self.root + query + '.meta', JSON.stringify(meta));
             });
             return wStream;
        });
    };

    FileManager.prototype.getMeta = function(query) {
        var self = this,
            deferred = q.defer();

        fs.exists(self.root + query, function(exists){
            if (exists) {
                fs.readFile(self.root + query + '.meta', function(err, data) {
                    deferred.resolve(JSON.parse(data));
                });
            } else {
                deferred.reject('file not found');
            }
        });

        return deferred.promise;
    };

    FileManager.prototype.delete = function(query) {
        var self = this,
            deferred = q.defer();

        fs.exists(self.root + query, function(exists) {
            if (exists) {
                fs.unlink(self.root + query + '.meta', function(err) {
                    console.log(err);
                });
                fs.unlink(self.root + query, function(err) {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve('file deleted');
                    }
                });
            } else {
                deferred.reject('file not found');
            }
        });

        return deferred.promise;
    };

    FileManager.prototype.list = function() {
        var deferred = q.defer();

        fs.readdir(this.root, function(err, files) {
            var fileJSON = _.filter(files, function(val) {
                    var extension =  path.extname(val);
                return (extension !== '.meta');
                });
            deferred.resolve(JSON.stringify(fileJSON));
        });

        return deferred.promise;

    };

    return FileManager;
}
