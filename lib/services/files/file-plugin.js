'use strict';

var di = require('di');
di.annotate(factory, new di.Provide('Files.FS'));
di.annotate(factory, new di.Inject(
            'Q',
            'Files.Waterline',
            'uuid'
            ));

var fs = require('fs'),
    path = require('path'),
    _ = require('lodash');

module.exports = factory;

function factory(q, Waterline, uuid) {

    function FileManager(config) {
        this.config = config;
        this.root = config.root;
        this.waterline = new Waterline();
        this.waterline.start();
        this.fileStore = this.waterline.service.collections.files;
        return this;
    }


    FileManager.prototype.get = function(query) {
        var deferred = q.defer(),
            self = this;

        this.fileStore.findOne()
        .where({uuid: query})
        .exec(function (err, file) {
            query = file[0].filename;

            fs.exists(self.root + query, function(exists){
                if (exists) {
                    deferred.resolve(fs.createReadStream(self.root + query));
                } else {
                    deferred.reject("file not found");
                }
            });
        });


        return deferred.promise;
    };


    FileManager.prototype.put = function(query) {
        var deferred = q.defer(),
            self = this,
            id = uuid('v4');
 //           version = 0;


/*
        fs.exists(self.root + query,function(exists) {
            if (exists) {
                self.fileStore.findOne
            }
*/
                var ext = path.extname(query),
                    filename = path.basename(query, ext) + '_' + id + ext;

                deferred.resolve(fs.createWriteStream(self.root + filename));
  /*
        });
*/
        return deferred.promise.then(function(wStream) {
             wStream.on('metadata', function(meta) {
                self.fileStore.create({
                    basename: query,
                    filename: filename,
                    uuid: id,
                    md5: meta.md5,
                    sha: meta.sha256
                })
                .exec(function(err, file) {
                    if (err) {
                        console.log(err);
                    } else {
                        wStream.emit('uuid', file.uuid);

                    }
                });

             });
             return wStream;
        });
    };

    FileManager.prototype.getMeta = function(query) {
        var deferred = q.defer();

/*
        fs.exists(self.root + query, function(exists){
            if (exists) {
                fs.readFile(self.root + query + '.meta', function(err, data) {
                    deferred.resolve(JSON.parse(data));
                });
            } else {
                deferred.reject('file not found');
            }
        });
*/
        this.fileStore.find()
        .where({basename: query})
        .exec(function(err, files) {
           var metaArray =  _.map(files, function(file) {
                return {md5: files.md5, sha256: file.sha, id: file.uuid};
           });

           deferred.resolve(JSON.parse(metaArray));

        });

        return deferred.promise;
    };



    FileManager.prototype.delete = function(query) {
        var self = this,
            deferred = q.defer();


        this.fileStore.findOne()
        .where({uuid: query})
        .exec(function(err, file) {

            fs.exists(self.root + file.filename, function(exists) {
                if (exists) {
                    fs.unlink(self.root + file.filename + '.meta', function(err) {
                        console.log(err);
                    });
                    fs.unlink(self.root + file.filename, function(err) {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            self.fileStore.destroy({name: file.filename})
                            .exec(function() {});

                            deferred.resolve('file deleted');
                        }
                    });
                } else {
                    deferred.reject('file not found');
                }
            });

        });

        return deferred.promise;
    };



    FileManager.prototype.list = function() {
        var deferred = q.defer();

        this.fileStore.find()
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
