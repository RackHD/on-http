// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var notificationApiService = injector.get('Http.Services.Api.Notification');
var _ = injector.get('_');    // jshint ignore:line

var notificationPost = controller({success: 201}, function(req) {
    var message = _.defaults(req.swagger.query || {}, req.query || {}, req.body || {});
    return notificationApiService.postNotification(message);
});

/**
 * @api {get} /api/2.0/notification/progress
 * @apiDescription deeply customized notification for task progress
 *  :taskId: active (OS installation) taskId
 *  :totalSteps: total steps for the task
 *  :currentStep: current setp sequence the API stands for
 * @apiName notification get
 * @apiGroup notification
 */
var notificationProgressGet = controller(function(req, res){
    var message = _.defaults(req.swagger.query || {}, req.query || {});
    return notificationApiService.postNotification({
        taskId: message.taskId,
        progress: {
            maximum: message.totalSteps,
            value: message.currentStep,
            description: "kernel download done, starting initiating installer"
        }
    })
    .then(function(){
        //Send any feedback is OK, just to cheat ipxe engine
        res.send('Notification response, no file will be sent');
    });
});

module.exports = {
    notificationPost: notificationPost,
    notificationProgressGet: notificationProgressGet
};
