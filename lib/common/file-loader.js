// Copyright 2014, Renasar Technologies Inc.
/* jshint node: true, newcap: false */
'use strict';

var di = require('di'),
    glob = require('glob'),
    path = require('path'),
    fs = require('fs'),
    _ = require('lodash');

module.exports = fileLoaderFactory;

di.annotate(fileLoaderFactory, new di.Provide('FileLoader'));
di.annotate(fileLoaderFactory, new di.Inject('Q'));

/**
 * fileLoaderFactory provides the FileLoader class.
 * @private
 * @param  {Q} Q Injected promise library.
 * @return {FileLoader} FileLoader class constructor.
 */
function fileLoaderFactory(Q) {
    /**
     * The FileLoader class provides a mechanism for glob loading
     * files into an in memory key/value store where the key is
     * the name of the file and the value is the contents of the file.
     * @constructor
     */
    function FileLoader() {
        this.files = {};
    }

    /**
     * The load function takes the provided glob pattern and loads
     * all matching files into the internal key/value store.
     * @param  {String} pattern A glob file pattern.
     * @return {Promise} A promise fulfilled with the key/value store
     * result of the load.
     */
    FileLoader.prototype.load = function (pattern) {
        var self = this;

        var deferred = Q.defer();

        glob(pattern, function (err, files) {
            if (err) {
                deferred.resolve(err);
            } else {
                files = _.filter(files, function (file) {
                    return fs.statSync(file).isFile();
                });

                var promises = _.map(files, function (file) {
                    return Q.nfcall(fs.readFile, file, "utf-8");
                });

                Q.all(promises).then(function (results) {
                    _.each(results, function (contents, index) {
                        self.files[path.basename(files[index])] = contents;
                    });

                    deferred.resolve(self.files);
                })
                .fail(function (err) {
                    deferred.reject(err);
                });
            }
        });

        return deferred.promise;
    };

    /**
     * The get method returns the contents of the requested file if it exists.
     * @param  {String} fileName The name of the requested file.
     * @return {Promise} A promise fulfilled with the contents of the file.
     */
    FileLoader.prototype.get = function (fileName) {
        if (_.has(this.files, fileName)) {
            return Q.resolve(this.files[fileName]);
        } else {
            return Q.reject(new Error("File Not Found (" + fileName + ")."));
        }
    };

    /**
     * The getAll method returns the key/value store.
     * @return {Promise} A promise fulfilled with the key/value store.
     */
    FileLoader.prototype.getAll = function () {
        return Q.resolve(this.files);
    };

    /**
     * The getAllSync method returns the key/value store.
     * @return {object} The key/value store.
     */
    FileLoader.prototype.getAllSync = function () {
        return this.files;
    };

    return FileLoader;
}
