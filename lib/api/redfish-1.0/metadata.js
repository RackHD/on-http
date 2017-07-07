// Copyright 2017, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');
var Promise = injector.get('Promise');    // jshint ignore:line
var controller = injector.get('Http.Services.Swagger').controller;
var Errors = injector.get('Errors');
var nodeFs = require('fs');
var fs = Promise.promisifyAll(nodeFs);

var getMetadata = controller(function(req, res) {
    var fromRoot = process.cwd();
    
    return Promise.try(function() {
        return fs.readFileAsync(fromRoot + '/static/redfishMetadata.xml', 'utf8');
    })
    .then(function(fileContent) {
        return fileContent;
    })
    .catch(function(error) {
        if(error.name === 'AssertionError') {
            error = new Errors.NotFoundError('invalid resource: ' + error.message);
        }
        return redfish.handleError(error, res);
    });
});

module.exports = {
    getMetadata: getMetadata
};
