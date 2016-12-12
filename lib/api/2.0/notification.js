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
 * @api {get} /api/2.0/notification/:taskId/:totalSteps/:currentStep
 * @apiDescription deeply customized notification for task progress
 *  :taskId: active (OS installation) taskId
 *  :totalSteps: total steps for the task
 *  :currentStep: current setp sequence the API stands for
 * @apiName notification get 
 * @apiGroup notification
 */
var notificationTaskProgressGet = controller(function(req, res){
    return notificationApiService.postNotification({
        taskId: req.swagger.params.taskId.value,
        progress: {
            maximum: req.swagger.params.totalSteps.value,
            value: req.swagger.params.currentStep.value,
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
    notificationTaskProgressGet: notificationTaskProgressGet
};
