// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    router = express.Router();

module.exports = filesRouterFactory;

di.annotate(filesRouterFactory, new di.Provide('Http.Api.Internal.Files'));
di.annotate(filesRouterFactory,
    new di.Inject(
        'Logger',
        'fileService',
        'Assert'
    )
);

function filesRouterFactory (
    Logger,
    fileService,
    assert
) {
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

    return router;

}
