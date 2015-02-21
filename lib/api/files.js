// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

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
     * @api {get} /api/1.1/files/:filename GET /:filename
     * @apiDescription get the most recent file from the global files root collection by filename
     * @apiName files-global-get
     * @apiGroup files
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "File not found."
     *     }
     */

    router.get('/files/:uuid', function(req, res) {
        logger.debug("Received request for file by uuid", {
            uuid: req.param('uuid')
        });


        return fileService.get(req.param('uuid'))
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
     * @apiDescription put a file to the global files root collection (unique by name).
     * If a file with the filename already exists, it will be overwritten.
     * @apiName files-global-put
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
        logger.debug("Receiving file " + req.param('filename'));


        fileService.put(req, req.param('filename'))
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
     * @api {delete} /api/1.1/files/:filename DELETE /:filename
     * @apiDescription delete the most recent file from the global files root colletion
     * with the name filename
     * @apiName files-global-delete
     * @apiGroup files
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Server Error
     *     {
     *       "error": "Error deleting file from the database."
     *     }
     */

    router.delete('/files/:uuid', function(req, res) {
        logger.debug("Deleting file with uuid: " + req.param('uuid') +
            " from the global files collection.");

        return fileService.delete(req.param('uuid'))
        .then(function() {
            res.status(204).end();
        })
        .catch(function(error) {
            logger.error("Error removing file from global files collection: ", {
                filename: req.param('filename'),
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
     * @apiDescription get the metadata for a file from the global files root collection by filename
     * @apiName files-global-get-metadata
     * @apiGroup files
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "File not found."
     *     }
     */



    router.get('/files/metadata/:filename', function(req, res) {
        logger.debug("Received metadata request for file" +
            req.param('filename') + " from the global files collection.");

        var query = req.param('filename');

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
     * @api {get} /api/1.1/files/list/all GET /list/all
     * @apiDescription get a list of all available files from the global files root collection
     * @apiName files-global-get-list
     * @apiGroup files
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



