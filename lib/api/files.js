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
        'Logger'
    )
);

function filesRouterFactory (gridfsService, Logger) {
    var logger = Logger.initialize(filesRouterFactory);

    /**
     * @api {get} /api/common/files/:identifier GET /:identifier
     * @apiDescription get a file referenced by a BSON ID
     * @apiName files-get
     * @apiGroup files
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "File not found."
     *     }
     */

    router.get('/files/:identifier', function(req, res) {
        logger.debug("Received request for file ", {
            fileId: req.param('identifier')
        });

        var query = {
            bsonId: req.param('identifier')
        };

        gridfsService.apiDownloadFile(res, query);
    });

    /**
     * @api {delete} /api/common/files/:identifier DELETE /:identifier
     * @apiDescription delete a file referenced by a BSON ID
     * @apiName files-delete
     * @apiGroup files
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Server Error
     *     {
     *       "error": "Error deleting file from the database."
     *     }
     */

    router.delete('/files/:identifier', function(req, res) {
        logger.debug("Deleting file with ID " + req.param('identifier'), {
            path: req.path
        });

        var query = {
            bsonId: req.param('identifier'),
        };

        return gridfsService.apiDeleteFile(res, query)
        .fail(function(error) {
            logger.error("Error removing file from gridfs: ", {
                fileId: req.param('identifier'),
                error: error.stack
            });
            res.status(500).json({
                error: "Error deleting file from the database."
            });
        });
    });

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

        gridfsService.apiDownloadFile(res, query);
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

        gridfsService.apiUploadFile(req, res, query);
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

        return gridfsService.apiDeleteFile(res, query)
        .fail(function(error) {
            logger.error("Error removing file from gridfs global files collection: ", {
                filename: req.param('filename'),
                error: error
            });
            res.status(500).json({
                error: "Error deleting file from the database."
            });
        });
    });


    return router;
}
