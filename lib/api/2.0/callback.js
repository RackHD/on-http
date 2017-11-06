// Copyright 2016-2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var Errors = injector.get('Errors');
var callbackService = injector.get('Http.Services.Api.Callback');
var _ = injector.get('_'); // jshint ignore:line


// POST /wsmanCallback/identifier
var callbackPost = controller({success: 201}, function (req) {
    if (_.has(req, 'swagger.params.body.value.options.defaults')) {
        var id = req.swagger.params.identifier.value;
        var data = req.body.options.defaults;
        return callbackService.publishHttpCallbackData(id, data);
    } else {
        throw new Errors.BadRequestError('CALLBACK: Callback data is invalid.');
    }
});

// POST /ucsCallback
var ucsCallbackPost = controller({success: 200}, function (req) {
    var body = _.defaults(req.body ||{}, req.swagger.body || {});
    var callbackId = req.swagger.query.callbackId || body.callbackId;
    if (!callbackId) {
        throw new Errors.BadRequestError('callbackId does not exist.');
    } else {
        return callbackService.publishHttpCallbackData(callbackId, body);
    }
});

module.exports = {
    callbackPost: callbackPost,
    ucsCallbackPost: ucsCallbackPost
};
