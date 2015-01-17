// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true, newcap: false */
'use strict';

var di = require('di'),
    mongo = require('mongodb'),
    Grid = require('gridfs-stream'),
    ObjectID = mongo.ObjectID,
    util = require('util'),
    _ = require('lodash');

module.exports = GridServiceFactory;

di.annotate(GridServiceFactory, new di.Provide('gridfs'));
di.annotate(GridServiceFactory, new di.Inject(
        'Logger',
        'Services.Configuration',
        'Assert',
        'Q'
    )
);

function GridServiceFactory(Logger, configuration, assert, Q) {
    var logger = Logger.initialize(GridServiceFactory);

    /*
     * A promise
     * @typedef Promise
     */
    /*
     * A mongo BSON id toString()
     * @typedef BsonString
     */
    /**
     * A user inputted query for a gridfs file. Should be run through
     * GridService._convertQuery before doing actual lookups.
     *
     * @typedef RawQuery
     * @property {BsonString} [query.nodeId] - If present along with filename,
     * will search in the gridfs node files collection, otherwise will search
     * in the gridfs global_root collection
     * @property {String} [query.filename] - required if query.bsonId
     * is not supplied. Does not guarantee a specific record, since there could
     * be duplicate entries with that filename
     * @property {BsonString} [query.bsonId] - required if query.filename
     * does not exist. Will fetch a unique record
     */
    /**
     * A converted query for a gridfs file
     *
     * @typedef ConvertedQuery
     * @property {BsonString} query._id - If present along with filename,
     * will search in the gridfs node files collection, otherwise will search
     * in the gridfs global_root collection. Will fetch a unique record
     * @property {String} [root] - the root collection of the file. If undefined
     * will default to the nodes root collection (fs.files)
     */

    /**
     * @constructor
     *
     * @param {ConvertedQuery} query
     * @param {Object} record - the file document from gridfs (metadata, etc.)
     */
    function GridFile(query, record) {
        /** @member */
        this.query = query;
        /** @member */
        this.record = record;
    }

    /**
     * Creates a new gridfs connection to mongo via mongoose.
     *
     * @constructor
     */
    function GridService () {
        // Separate collection for files used by any number of nodes, such as
        // firmware files. Filenames should be enforced unique here.
        this.globalRoot = 'global_files';
        this.nonExistantError = new Error('Doc not found');
    }


    /**
     * Returns a gfs collection object. The gridfs-stream module doesn't
     * expose the .chunks collections through this.gfs.collection, so we
     * need to access the this.gfs.db.collection method in order to do that.
     *
     * @member
     * @function
     *
     * @param {String} [collection] - the collection to return
     * @returns {Object} - a gfs collection object (mongo.GridStore)
     */
    GridService.prototype._collection = function _collection(collection) {
        assert.ok(this.gfs);

        if (!collection) {
            return this.gfs.collection();
        }
        // requires es6-shim being globally loaded
        if (collection.endsWith('chunks')) {
            // NOTE: The gridfs-stream collection method this.gfs.collection()
            // will not give us access to the chunks collection, but we need
            // access to it in order to delete file chunks!!!
            return this.gfs.db.collection(collection);
        }
        return this.gfs.collection(collection);
    };

    /**
     * @member
     * @function
     */
    GridService.prototype.start = function start() {
        var self = this,
            config = configuration.get('mongo');

        var db = new mongo.Db(
            config.database,
            new mongo.Server(
                config.host,
                config.port
            ),
            {
                fsync: true,
                native_parser: true //jshint ignore:line
            }
        );

        return Q.nfcall(db.open.bind(db)).then(function () {
            self.gfs = Grid(db, mongo);
            self.nodes = self.gfs.collection();
            self.root = self.gfs.collection(self.globalRoot);

            logger.info('GridFS Service Started');
        }).fail(function (err) {
            logger.error('GridFS Service Error', {
                error: err
            });

            return Q.reject(err);
        });
    };

    /**
     * @member
     * @function
     */
    GridService.prototype.stop = function stop() {
        assert.ok(this.gfs);
        return Q.ninvoke(this.gfs, 'close');
    };


    /**
     * Helper method used by the nodes and files APIs
     *
     * @member
     * @function
     *
     * @param {Object} res - object to send HTTP responses with
     * @param {RawQuery}
     */
    GridService.prototype.apiDownloadFile = function(res, query) {
        var self = this;

        self.createReadStream(query)
        .then(function(readStream) {
            // If we have no error handler here, a request for a non-existent
            // file will crash the whole process, regardless of a try/catch,
            // because it seems if there are no error listeners, then errors
            // will just bubble up and not get caught.
            readStream.on('error', function(err) {
                logger.error("Failed to serve file request", {
                    query: query,
                    error: err.stack
                });
                res.status(500).json({
                    error: "Failed to serve file request."
                });
            });

            readStream.pipe(res);
        })
        .fail(function(err) {
            if (err === self.nonExistantError) {
                res.status(404).json({
                    error: 'File not found.'
                });
            } else {
                logger.error("Failed to serve file request", {
                    query: query,
                    error: err.stack
                });
                res.status(500).json({
                    error: "Failed to serve file request."
                });
            }
        });
    };

    /**
     * Helper method used by the nodes and files APIs
     *
     * @member
     * @function
     *
     * @param {Object} req - object on which to trigger upload events
     * @param {Object} res - object to send HTTP responses with
     * @param {RawQuery}
     */
    GridService.prototype.apiUploadFile = function(req, res, query) {
        var self = this;
        if (!query.filename) {
            res.status(400).json({
                error: "a filename parameter is required to create " +
                        "upload files"
            });
            return;
        }

        self.createWriteStream(query)
        .then(function(writeStream) {
            writeStream.on('close', function() {
                logger.debug("File upload complete", {
                    query: query,
                    fileBSONId: writeStream.id.toString()
                });
                res.status(201).json({
                    fileId: writeStream.id.toString()
                });
                // Do this async but don't bother returning anywhere, we'll
                // just log it.
                self._pruneOldFiles(query);
            });

            req.on('error', function(error) {
                logger.error("File upload failed.", {
                    query: query,
                    error: error.stack
                });
                res.status(500).json({
                    error: "File upload failed."
                });
            });

            req.pipe(writeStream);
        })
        .fail(function(error) {
            logger.error("File upload failed.", {
                query: query,
                error: error.stack
            });
            res.status(500).json({
                error: "File upload failed."
            });
        });
    };


    /**
     * Helper method used by the nodes and files APIs
     *
     * @member
     * @function
     *
     * @param {Object} res - object to send HTTP responses with
     * @param {RawQuery}
     *
     * @returns {Promise}
     */
    GridService.prototype.apiDeleteFile = function(res, query) {
        return this.remove(query)
        .then(function(removed) {
            res.status(204).json(removed);
        })
        .fail(function(err) {
            logger.error("Error deleting gridfs file: ", {
                error: err
            });
            res.status(500).json({
                error: "File delete failed."
            });
        });
    };

    /**
     * @member
     * @function
     *
     * @param {RawQuery}
     * @returns {Promise}
     */
    GridService.prototype.listFiles = function(query) {
        var self = this;
        return self._convertQuery(query)
        .then(function(out) {
            if (!out.exists) {
                return;
            }
            return Q.ninvoke(
                self._collection(out.query.root).find(_.omit(out.query, 'root')), 'toArray');
        });
    };

    /**
     * Method to be used after file uploads that finds old files in the collections
     * and deletes them if we have more files than the maximum specified.
     *
     * @member
     * @function
     *
     * @param {RawQuery}
     * @returns {Promise}
     */
    GridService.prototype._pruneOldFiles = function(query) {
        var self = this;
        var root;

        return self._convertQuery(query)
        .then(function(out) {
            if (!out.exists) {
                return;
            }
            root = out.query.root;
            return Q.ninvoke(
                self._collection(out.query.root).find(_.omit(out.query, 'root')), 'toArray');
        })
        .then(function(results) {
            if (_.isEmpty(results)) {
                return;
            }
            var maxFiles = (configuration.get('maxGridfsFileVersions') || 3);
            if (results.length <= maxFiles) {
                return;
            }
            var sort = _.sortBy(results, function(doc) {
                return doc.uploadDate;
            });
            var oldestFiles = sort.slice(0, results.length - maxFiles);

            // Queries for collection.files
            var fileQueries = _.map(oldestFiles, function(doc) {
                var q = {
                    _id: doc._id
                };
                if (root) {
                    q.root = root;
                }
                return q;
            });

            // Queries for collection.chunks
            var chunkQueries = (_.map(oldestFiles, function(doc) {
                var q = {
                    'files_id': doc._id
                };
                if (root) {
                    q.root = root;
                }
                return q;
            }));

            // All queries for deletion
            var bsonQueries = fileQueries.concat(chunkQueries);

            return Q.allSettled(_.map(bsonQueries, function(bsonQuery) {
                return self._remove(bsonQuery);
            }));
        })
        .then(function(results) {
            _.forEach(results, function(result) {
                if (result.state === 'rejected') {
                    logger.error("Failed to prune file from gridfs", {
                        error: result.reason
                    });
                }
            });
            return Q.resolve();
        })
        .fail(function(err) {
            logger.error("Something went wrong pruning files from gridfs: ", {
                error: err
            });
        });
    };

    /**
     * @typedef ConvertQueryReturnType
     *
     * @property {Boolean} exists - whether a file exists for the modified query
     * @property {ConvertedQuery} query - an updated query which determines the collection
     * the file can be found in (query.root)
     */
    /**
     * @member
     * @function
     *
     * @param {RawQuery}
     * @returns {ConvertQueryReturnType}
     */
    GridService.prototype._convertQuery = function(query) {
        var self = this;
        var schemaData = {};
        assert.ok(self.gfs);

        if (!query) {
            return Q.reject(new Error("query must not be empty"));
        }

        // Query could be for either a node or for a file in the global_root collection
        if (query.bsonId) {
            // TODO: why isn't Q just catching this?
            try {
                schemaData._id = new ObjectID(query.bsonId);
            } catch (e) {
                return Q.reject(e);
            }
        // Query must be for a node file
        } else if (query.nodeId) {
            schemaData.filename = query.filename;
            schemaData.metadata = {
                machine: query.nodeId
            };
        // Query must be for a file in the global_root collection
        } else {
            schemaData.filename = query.filename;
            schemaData.root = self.globalRoot;
        }

        return Q.ninvoke(self.gfs, 'exist', schemaData)
        .then(function(exists) {
            // If we didn't find the file, and we didn't already check the
            // global files root, and we know it's not a query for a node file,
            // check the global files root.
            if (!exists && _.isEqual(_.keys(schemaData), ['_id'])) {
                schemaData.root = self.globalRoot;
                return Q.ninvoke(self.gfs, 'exist', schemaData)
                .then(function(exists) {
                    return { exists: exists, query: schemaData};
                });
            }
            return { exists: exists, query: schemaData};
        });
    };

    /**
     * @member
     * @function
     *
     * @param {RawQuery}
     * @returns {GridFile}
     */
    GridService.prototype._getGridFileDoc = function(query) {
        var self = this;
        var bsonQuery;

        return self._convertQuery(query)
        .then(function(out) {
            if (!out.exists) {
                return new GridFile(out.query, undefined);
            }
            return Q.ninvoke(
                self._collection(out.query.root).find(_.omit(out.query, 'root')), 'toArray')
            .then(function(result) {
                if (_.isEmpty(result)) {
                    return new GridFile(out.query, undefined);
                } else if (result.length > 1) {
                    var sort = _.sortBy(result, function(doc) {
                        return doc.uploadDate;
                    });
                    var latest = _.last(sort);
                    // Return an exact BSON query here, since we've gone to
                    // all this trouble of finding the most recent record.
                    bsonQuery = {
                        _id: latest._id
                    };
                    if (out.query.root) {
                        bsonQuery.root = out.query.root;
                    }
                    return new GridFile(bsonQuery, latest);
                } else {
                    // Return an exact BSON query here, since we've gone to
                    // all this trouble of finding the most recent record.
                    bsonQuery = {
                        _id: result[0]._id
                    };
                    if (out.query.root) {
                        bsonQuery.root = out.query.root;
                    }
                    return new GridFile(bsonQuery, result[0]);
                }
            });
        });
    };

    /**
     * @member
     * @function
     *
     * @param {RawQuery}
     * @returns {Promise.<Boolean>}
     */
    GridService.prototype.fileExists = function(query) {
        return this._convertQuery(query)
        .then(function(out) {
            return Boolean(out.exists);
        });
    };

    /**
     * @member
     * @function
     *
     * @param {RawQuery}
     * @returns {Promise.<String>}
     */
    GridService.prototype.getMd5Sum = function(query) {
        var self = this;

        var schemaData = {};

        if (query.bsonId) {
            schemaData._id = query.bsonId;
        } else if (query.nodeId) {
            schemaData.filename = query.filename;
            schemaData.metadata = {
                machine: query.nodeId
            };
        } else {
            schemaData.filename = query.filename;
        }

        return this._getGridFileDoc(query)
        .then(function(doc) {
            if (!doc.record) {
                return Q.reject(self.nonExistantError);
            }
            return doc.record.md5;
        });
    };

    /**
     * @member
     * @function
     *
     * @param {RawQuery} query
     * @returns {Promise.<RawQuery>}
     */
    GridService.prototype.remove = function(query) {
        var self = this;

        return self._getGridFileDoc(query)
        .then(function(doc) {
            if (!doc.record) {
                return;
            }
            return self._remove(doc.query);
        })
        .then(function() {
            return Q.resolve(query);
        });
    };


    /**
     * @member
     * @function
     *
     * @param {ConvertedQuery} query
     * @returns {Promise.<ConvertedQuery>}
     */
    GridService.prototype._remove = function(convertedQuery) {
        var self = this;
        var query;
        var collection;
        if (_.has(convertedQuery, '_id')) {
            query = { _id: convertedQuery._id };
            collection = convertedQuery.root;
        } else if (_.has(convertedQuery, 'files_id')) {
            query = { 'files_id': convertedQuery.files_id };  // jshint ignore:line
            collection = convertedQuery.root + '.chunks';
        }

        return Q.ninvoke(
            self._collection(collection), 'remove', query)
        .then(function(out) {
            if (!out[1] || !out[1].ok) {
                var error = new Error("Failure removing file from gridfs, did not " +
                    "receive ok, instead got: " + util.inspect(out));
                return Q.reject(error);
            }
            return Q.resolve();
        });
    };

    /**
     * A readable nodejs stream
     * @typedef ReadableStream
     */
    /**
     * @member
     * @function
     *
     * @param {RawQuery} query
     * @returns {Promise.<ReadableStream>}
     */
    GridService.prototype.createReadStream = function(query) {
        var self = this;
        assert.ok(self.gfs);

        // If we can find the file, then use the modified query used to find
        // the file to create the read stream
        // (i.e. did we find it in the root collection or not)?
        return self._getGridFileDoc(query)
        .then(function(doc) {
            if (doc.record) {
                return self.gfs.createReadStream(doc.query);
            } else {
                return Q.reject(self.nonExistantError);
            }
        });
    };

    /**
     * A writeable nodejs stream
     * @typedef WriteableStream
     */
    /**
     * @member
     * @function
     *
     * @param {Object} query - query to use for fetching the file
     * @param {String} [query.nodeId] - an optional node BSON id toString(). Will look
     * up for a file in the nodes collection if supplied.
     * @param {String} [query.filename] - required. Does not guarantee a
     * specific record if query.nodeId is specified
     *
     * @returns {Promise.<WriteableStream>}
     */
    GridService.prototype.createWriteStream = function(query) {
        var self = this;
        assert.ok(self.gfs);

        return self._convertQuery(query)
        .then(function(out) {
            return self.gfs.createWriteStream(out.query);
        });
    };

    return new GridService();
}
