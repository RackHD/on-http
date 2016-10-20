// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var fileService = injector.get('fileService');

var filesGet = controller(function(req, res) {
    res.set('Content-Type', 'application/octet-stream');
    return fileService.getFile(req, res, req.swagger.params.fileidentifier.value);
});

var filesPut = controller({success: 201}, function(req) {
    return fileService.putFile(req, req.swagger.params.fileidentifier.value);
});

var filesMetadataGet = controller(function(req) {
    return fileService.getFileMetadata(req.swagger.params.filename.value);
});

var filesMd5Get = controller(function(req) {
    return fileService.getFileMetadata(req.swagger.params.filename.value);
});

var filesGetAll = controller(function() {
    return fileService.getFilesAll();
});

var filesDelete = controller({send204OnEmpty: true}, function(req) {
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

