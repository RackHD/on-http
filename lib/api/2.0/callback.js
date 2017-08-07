// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var Errors = injector.get('Errors');
var eventsProtocol = injector.get('Protocol.Events');
var _ = injector.get('_'); // jshint ignore:line


// POST /wsmanCallback/identifier
var callbackPost = controller({success: 201}, function (req) {
    if (_.has(req, 'swagger.params.body.value.options.defaults')) {
        var id = req.swagger.params.identifier.value;
        var data = req.body.options.defaults;
        return Promise.resolve(eventsProtocol.publishHttpResponseUuid(id, data));
    } else {
        throw new Errors.BadRequestError('CALLBACK: Callback data is invalid.');
    }
});

module.exports = {
    callbackPost: callbackPost
};
