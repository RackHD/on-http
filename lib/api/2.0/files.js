// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var fileService = injector.get('fileService');
var Errors = injector.get('Errors');

/**
 * @api {get} /api/2.0/files/:fileid GET 
 * @apiDescription get the specified file
 * @apiName files-get
 * @apiGroup files
 */
var filesGet = controller(function(req, res) {
    return fileService.getFile(req, res, req.swagger.params.fileidentifier.value);
});

/**
 * @api {put} /api/2.0/files/:filename PUT 
 * @apiVersion 2.0
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
var filesPut = controller(function(req) {
    return fileService.putFile(req, req.swagger.params.fileidentifier.value);
});

/**
 * @api {get} /api/2.0/files/metadata/:filename GET
 * @apiVersion 2.0
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
var filesMetadataGet = controller(function(req) {
    return fileService.getFileMetadata(req.swagger.params.filename.value);
});

/**
 * @api {get} /api/2.0/files/:filename/latest/md5 GET
 * @apiVersion 2.0
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
var filesMd5Get = controller(function(req) {
    return fileService.getFileMd5(req.swagger.params.filename.value);
});

/**
 * @api {get} /api/2.0/files GET
 * @apiVersion 2.0
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
var filesGetAll = controller(function() {
    return fileService.getFilesAll();
});

/**
 * @api {delete} /api/2.0/files/:uuid DELETE
 * @apiVersion 2.0
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
var filesDelete = controller(function(req) {
    return fileService.deleteFile(req.swagger.params.fileidentifier.value);
});

module.exports = {
    filesGet: filesGet,
    filesPut: filesPut,
    filesMetadataGet: filesMetadataGet,
    filesMd5Get: filesMd5Get,
    filesGetAll: filesGetAll,
    filesDelete: filesDelete
};

