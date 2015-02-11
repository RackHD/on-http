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


    FileManager.prototype.get = function(query) {
        var deferred = q.defer(),
            self = this;
        waterline.files.findOne()
        .where({uuid: query})
        .exec(function (err, file) {

            if (file) {

                fs.exists(self.root + file.filename, function(exists){
                    if (exists) {
                        deferred.resolve(fs.createReadStream(self.root + file.filename));
                    } else {
                        deferred.reject("file not found");
                    }
                });

            } else {
                deferred.reject("file not found");
            }
        });

        return deferred.promise;
    };


    FileManager.prototype.put = function(query) {
        var deferred = q.defer(),
            self = this,
            id = uuid('v4'),
            ext = path.extname(query),
            filename = path.basename(query, ext) + '_' + id + ext;

            deferred.resolve({
                stream: fs.createWriteStream(self.root + filename),
                id: id
            });


        return deferred.promise.then(function(streamObj) {
             streamObj.stream.on('metadata', function(meta) {
                waterline.files.create({
                    basename: query,
                    filename: filename,
                    uuid: id,
                    md5: meta.md5,
                    sha: meta.sha256
                })
                .exec(function() {});
             });

             return streamObj;
        });
    };


    FileManager.prototype.getMeta = function(query) {
        return this.list({basename: query});
    };


    FileManager.prototype.delete = function(query) {
        var self = this,
            deferred = q.defer();


        waterline.files.findOne()
        .where({uuid: query})
        .exec(function(err, file) {

            if (file) {

                fs.exists(self.root + file.filename, function(exists) {
                    if (exists) {
                        fs.unlink(self.root + file.filename, function(err) {
                            if (err) {
                                deferred.reject(err);
                            } else {
                                waterline.files.destroy({filename: file.filename})
                                .exec(function() {});

                                deferred.resolve('file deleted');
                            }
                        });
                    } else {
                        deferred.reject('file not found');
                    }
                });

            } else {
                deferred.reject('file not found');
            }
        });
        return deferred.promise;
    };



    FileManager.prototype.list = function(query) {
        var deferred = q.defer();

        waterline.files.find(query)
        .exec(function(err, files) {
            if (err) {
                deferred.reject(err);
            } else {
                files = _.map(files, function(file) {
                    return file.toJSON();
                });

                deferred.resolve(files);
            }

        });

        return deferred.promise;

    };

    return FileManager;
}
