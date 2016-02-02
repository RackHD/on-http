// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    router = express.Router();

module.exports = filesRouterFactory;

di.annotate(filesRouterFactory, new di.Provide('Http.Api.Files'));
di.annotate(filesRouterFactory,
    new di.Inject(
        'Logger',
        'Services.Configuration',
        'fileService',
        'Assert'
    )
);

function filesRouterFactory (Logger, configuration, fileService, assert) {
    var logger = Logger.initialize(filesRouterFactory);

    /**
     * @api {get} /api/1.1/files/:uuid GET /:uuid
     * @apiVersion 1.1.0
     * @apiDescription get a file referenced by a BSON ID
     * @apiName files-get
     * @apiGroup files
     * @apiError NotFound The file with the <code>uuid</code> was not found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "File not found."
     *     }
     */

    router.get('/files/:uuid', function(req, res) {
        logger.debug("Received request for file by uuid", {
            uuid: req.params.uuid
        });


        return fileService.get(req.params.uuid)
        .then(function(rdStream) {
            rdStream.on('error', function(err){
                logger.error("Failure serving file request", { error: err });
                res.status(500).json({
                    error: "Failed to serve file request."
                });
            });
            rdStream.pipe(res);
        })
        .catch(function(err) {
            logger.warning("Failure serving file request", { error: err });
            if (err.name === '404') {
                res.status(404).json({
                    error: 'File not found.'
                });
            } else {
                res.status(500).json({
                    error: "Failed to serve file request."

                });
            }
        });

    });

    /**
     * @api {get} /api/1.1/files/:filename/latest GET /:filename
     * @apiVersion 1.1.0
     * @apiDescription get the most recent version of a file by filename
     * @apiName files-get
     * @apiGroup files
     * @apiError NotFound The file with the <code>uuid</code> was not found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "File not found."
     *     }
     */

    router.get('/files/:filename/latest', function(req, res) {
        logger.debug("Received request for file by uuid", {
            uuid: req.params.uuid
        });

        var query = req.params.filename;

        return fileService.verify(query)
        .then(function(metadata) {
            return metadata[0].uuid;
        })
        .then(function(uuid) {
            return fileService.get(uuid);
        })
        .then(function(rdStream) {
            rdStream.on('error', function(err){
                logger.error("Failure serving file request", { error: err });
                res.status(500).json({
                    error: "Failed to serve file request."
                });
            });
            rdStream.pipe(res);
        })
        .catch(function(err) {
            logger.error("Failure serving file request", { error: err });
            if (err.name === '404') {
                res.status(404).json({
                    error: 'File not found.'
                });
            } else {
                res.status(500).json({
                    error: "Failed to serve file request."

                });
            }
        });

    });

    /**
     * @api {put} /api/1.1/files/:filename PUT /:filename
     * @apiVersion 1.1.0
     * @apiDescription put a file to the global files root collection.
     * @apiName file-put
     * @apiGroup files
     * @apiSuccessExample Completed-Response:
     *     HTTP/1.1 201 Created
     * @apiError Error Any problem was encountered, file was not written.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Error
     *     {
     *       "error": "File upload failed."
     *     }
     */

    router.put('/files/:filename', function(req, res) {
        logger.debug("Receiving file " + req.params.filename);


        fileService.put(req, req.params.filename)
        .then(function(streamObj) {

            assert.object(streamObj, 'transform Stream object');

            streamObj.transformHashStream.on('error', function(err) {
                logger.error("Failure serving file request", { error: err });
                res.status(500).json({
                    error: "Failed to serve file request."
                });
            });

            streamObj.writeStream.on('ready', function() {
                res.status(201);
                res.send(streamObj.id);
            });

            streamObj.writeStream.on('error', function(err) {
                logger.error("Failure serving file request", { error: err });
                res.status(500).json({
                    error: "Failed to serve file request."
                });
            });

            req.pipe(streamObj.transformHashStream);

        })
        .catch(function() {
            res.status(500).json({
                error: "Failed to serve file request."
            });
        });
    });

    /**
     * @api {delete} /api/1.1/files/:uuid DELETE /:uuid
     * @apiVersion 1.1.0
     * @apiDescription delete the file with the <code>uuid</code>from the global files
     *                 root collection with the name filename
     * @apiName file-delete
     * @apiGroup files
     * @apiError NotFound The file with the <code>uuid</code> was not found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Server Error
     *     {
     *       "error": "Error deleting file from the database."
     *     }
     */

    router.delete('/files/:uuid', function(req, res) {
        logger.debug("Deleting file with uuid: " + req.params.uuid +
            " from the global files collection.");

        return fileService.delete(req.params.uuid)
        .then(function() {
            res.status(204).end();
        })
        .catch(function(error) {
            logger.error("Error removing file from global files collection: ", {
                uuid: req.params.uuid,
                error: error
            });
            if (error.name === '404') {
                res.status(404).json({
                    error: "File not found."
                });
            } else {

                res.status(500).json({
                    error: "Error deleting file from the database."
                });
            }
        });
    });



    /**
     * @api {get} /api/1.1/files/metadata/:filename GET /metadata/:filename
     * @apiVersion 1.1.0
     * @apiDescription get the metadata for a file from the global files root collection by filename
     * @apiName files-global-get-metadata
     * @apiGroup files
     * @apiSuccess {json} files All files with the <code>filename</code>.
     * @apiError NotFound The file with the <code>filename</code> was not found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "File not found."
     *     }
     */

    router.get('/files/metadata/:filename', function(req, res) {
        logger.debug("Received metadata request for file" +
            req.params.filename + " from the global files collection.");

        var query = req.params.filename;

        return fileService.verify(query)
        .then(function(metadata) {
            res.json(200,  metadata);
        })
        .catch(function(err) {
            logger.error("Failure serving file request", { error: err });
            if (err.name === '404') {
                res.status(404).json({
                    error: 'File not found.'
                });
            } else {
                res.status(500).json({
                    error: "Error retrieving metadata."
                });
            }
        });
    });

    /**
     * @api {get} /api/1.1/files/md5/:filename/latest GET /md5/:filename/ltest
     * @apiVersion 1.1.0
     * @apiDescription get the md5sum for the most recent matching file from the
     *                 global files root collection by filename
     * @apiName files-global-get-md5-latest
     * @apiGroup files
     * @apiSuccess {json} files Most recent file with the <code>filename</code>.
     * @apiError NotFound The file with the <code>filename</code> was not found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "File not found."
     *     }
     */
    router.get('/files/md5/:filename/latest', function(req, res) {
        logger.debug("Received md5sum request for file" +
            req.params.filename + " from the global files collection.");

        var query = req.params.filename;

        return fileService.verify(query)
        .then(function(metadata) {
            res.json(200,  metadata[0].md5);
        })
        .catch(function(err) {
            logger.warning("Failure serving file request", { error: err });
            if (err.name === '404') {
                res.status(404).json({
                    error: 'File not found.'
                });
            } else {
                res.status(500).json({
                    error: "Error retrieving metadata."
                });
            }
        });
    });



    /**
     * @api {get} /api/1.1/files/list/all GET /list/all
     * @apiVersion 1.1.0
     * @apiDescription get a list of all available files from the global files root collection
     * @apiName files-global-get-list
     * @apiGroup files
     * @apiSuccess {json} files lists of all files or an empty object if there is none.
     * @apiError ServerError could not retrieve the list of nodes from the database.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Server Error
     *     {
     *       "error": "Error retrieving list from the database."
     *     }
     */

    router.get('/files/list/all', function(req, res) {
        logger.debug("Received request for file list");

        return fileService.list(req.body)
        .then(function(files) {
            res.json(200, files);
        })
        .catch(function(err) {
             logger.error("Failure serving file request", { error: err });
             res.status(500).json({
                    error: "Error retrieving file list."
                });
        });
    });


    return router;

}
