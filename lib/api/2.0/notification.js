// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var notificationApiService = injector.get('Http.Services.Api.Notification');
var _ = injector.get('_');    // jshint ignore:line
var Promise = injector.get('Promise');
var assert = injector.get('Assert');

var notificationPost = controller({success: 201}, function(req) {
    var message = _.defaults(req.swagger.query || {}, req.query || {}, req.body || {});
    return notificationApiService.postNotification(message);
});

/**
 * @api {post} /api/2.0/notification/progress
 * @apiDescription deeply customized notification for task progress
 *  :taskId: active (OS installation) taskId
 *  :maximum: the maximum progress value
 *  :value: the current progress value
 * @apiName notification post
 * @apiGroup notification
 */
var notificationProgressPost = controller(function(req, res){
    var message = _.defaults(req.swagger.query || {}, req.query || {}, req.body || {});
    return Promise.try(function() {
        assert.string(message.taskId, 'taskId is required for progress notification');
        assert.ok(message.maximum, 'maximum is required for progress notification');
        assert.ok(message.value, 'maximum is required for progress notification');

        if (message.value) {
            message.value = parseInt(message.value);
        }
        if (message.maximum) {
            message.maximum = parseInt(message.maximum);
        }
        return {
            taskId: message.taskId,
            progress: _.pick(message, ['maximum', 'value', 'description'])
        };
    })
    .then(function(progressData) {
        return notificationApiService.postNotification(progressData);
    })
    .then(function(){
        //Send any feedback is OK, just to cheat ipxe engine
        res.send('Notification response, no file will be sent');
    });
});

module.exports = {
    notificationPost: notificationPost,
    notificationProgressPost: notificationProgressPost
};
