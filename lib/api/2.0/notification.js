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
 * @api {get} /api/2.0/notification/:taskId/:totalSteps
 * @apiDescription deeply customized notification get api only for ipxe to use.
 *  Let RackHD receive ipxe initrd downloading finished progress message for OS installation task .
 *  :taskId: active (OS installation) taskId
 *  :totalSteps: total steps for the task
 * @apiName notification-get
 * @apiGroup notification
 */
var notificationIpxeGet = controller(function(req, res){
    var ipxeGetSequence = 2;
    return notificationApiService.postNotification({
        taskId: req.swagger.params.taskId.value,
        progress: {
            totalSteps: _.parseInt(req.swagger.params.totalSteps.value) || 2,
            currentStep: ipxeGetSequence ,
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
    notificationIpxeGet: notificationIpxeGet
};
