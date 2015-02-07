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
        'gridfs',
        'Logger',
        'Services.Configuration',
        'fileService'
    )
);

function filesRouterFactory (gridfsService, Logger, configuration, FileService) {
    var logger = Logger.initialize(filesRouterFactory),
        fileService = new FileService();

    fileService.start(configuration.get("fileService"));

    /**
     * @api {get} /api/common/files/global/:filename GET /global/:filename
     * @apiDescription get the most recent file from the global files root collection by filename
     * @apiName files-global-get
     * @apiGroup files
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "File not found."
     *     }
     */

    router.get('/files/global/:filename', function(req, res) {
        logger.debug("Received request for file ", {
            filename: req.param('filename')
        });

        var query = {
            filename: req.param('filename')
        };

        return fileService.get(query)
        .then(function(rdStream) {
            rdStream.on('error', function(){
                res.status(500).json({
                    error: "Failed to serve file request."
                });
            });
            rdStream.pipe(res);
        })
        .catch(function(err) {
            if (err === 'no file') {
                res.status(404).json({
                    error: 'File not found.'
                });
            } else {
                console.log(res);
                res.status(500).json({
                    error: "Failed to serve file request."

                });
            }
        });

    });

    /**
     * @api {put} /api/common/files/global/:filename PUT /global/:filename
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

    router.put('/files/global/:filename', function(req, res) {
        logger.debug("Receiving file " + req.param('filename'));

        var query = {
            filename: req.param('filename')
        };

        fileService.put(req, query)
        .then(function(writeStream) {

            writeStream.on('error', function() {
                res.status(500).json({
                    error: "Failed to serve file request."
                });
            });

            writeStream.on('end', function() {
                res.status(201).end();
            });

            req.pipe(writeStream);
        })
        .catch(function() {
            res.status(500).json({
                error: "Failed to serve file request."
            });
        });
    });

    /**
     * @api {delete} /api/common/files/global/:filename DELETE /global/:filename
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

    router.delete('/files/global/:filename', function(req, res) {
        logger.debug("Deleting file " + req.param('filename') +
            " from the global files collection.");

        var query = {
            filename: req.param('filename'),
        };

        return fileService.delete(query)
        .then(function() {
            res.status(204).end();
        })
        .catch(function(error) {
            logger.error("Error removing file from global files collection: ", {
                filename: req.param('filename'),
                error: error
            });
            if (error === 'file not found') {
                res.status(404).json({
                    error: "File not found."
                });
            }

            res.status(500).json({
                error: "Error deleting file from the database."
            });
        });
    });



    /**
     * @api {get} /api/common/files/global/metadata/:filename GET /global/metadata/:filename
     * @apiDescription get the metadata for a file from the global files root collection by filename
     * @apiName files-global-get-metadata
     * @apiGroup files
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "File not found."
     *     }
     */



    router.get('/files/global/metadata/:filename', function(req, res) {
        logger.debug("Received metadata request for file" +
            req.param('filename') + " from the global files collection.");

        var query = {
            filename: req.param('filename')
        };

        return fileService.verify(query)
        .then(function(metadata) {
            res.json(200,  metadata);
        })
        .catch(function(err) {
            if (err === 'file not found') {
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
     * @api {get} /api/common/files/global/list/all GET /global/list/all
     * @apiDescription get a list of all available files from the global files root collection
     * @apiName files-global-get-list
     * @apiGroup files
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Server Error
     *     {
     *       "error": "Error retrieving list from the database."
     *     }
     */


    router.get('/files/global/list/all', function(req, res) {
        logger.debug("Received request for file list");

        return fileService.list()
        .then(function(files) {
            res.json(200, files);
        })
        .catch(function() {
             res.status(500).json({
                    error: "Error retrieving file list."
                });
        });
    });


    return router;

}



