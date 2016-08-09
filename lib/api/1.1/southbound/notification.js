// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = notificationRouterFactory;

di.annotate(notificationRouterFactory, new di.Provide('Http.Api.Internal.Notification'));
di.annotate(notificationRouterFactory,
    new di.Inject(
        'Http.Services.RestApi',
        'Http.Services.Api.Notification',
        '_'
	)
);

function notificationRouterFactory (
    rest,
    notificationApiService,
    _
) {
    var router = express.Router();

    /**
     * @api {post} /api/1.1/notification
     * @apiVersion 1.1.0
     * @apiDescription post a notification from node
     * @apiName notification-post
     * @apiGroup notification
     */

    router.post('/notification/', rest(function (req) {
        var message = _.defaults(req.query || {}, req.body || {});

        if (_.has(message, 'nodeId')) {
            return notificationApiService.postNodeNotification(message);
        }
        // Add other cases here if to support more notification types

        // This will be a broadcast notification if no id (like nodeId) is specified
        else {
            return notificationApiService.postBroadcastNotification(message);
        }
    }, {renderOptions: {success: 201}}));

    return router;
}
