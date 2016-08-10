// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var notificationApiService = injector.get('Http.Services.Api.Notification');
var _ = injector.get('_');    // jshint ignore:line

var notificationPost = controller({success: 201}, function(req) {
    var message = _.defaults(req.swagger.query || {}, req.body || {});

    if (_.has(message, 'nodeId')) {
            return notificationApiService.postNodeNotification(message);
        }
    // Add other cases here if to support more notification types

    // This will be a broadcast notification if no id (like nodeId) is specified
    else {
        return notificationApiService.postBroadcastNotification(message);
    }
});

module.exports = {
    notificationPost: notificationPost
};
