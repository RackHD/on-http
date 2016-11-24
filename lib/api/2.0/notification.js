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
 * @api {get} /api/2.0/notification/:taskId/:steps
 * @apiDescription notification get api, used to notify RackHD ipxe initrd downloading finished
 *  :taskId: active taskId
 *  :steps: task steps count
 * @apiName notification-get
 * @apiGroup notification
 */
var notificationIdGet = controller(function(req, res){
    return notificationApiService.postNotification({
        taskId: req.swagger.params.taskId.value,
        progress: {
            //percentage: "20%",
            totalSteps: _.parseInt(req.swagger.params.steps.value) || 2,
            currentStep: 2,
            description: "iPXE initrd download done, starting initiating installer"
        }
    })
    .then(function(){
        //Send any feedback is OK, just to cheat ipxe engine
        res.send('Notification response, no file will be sent');
    });
});

module.exports = {
    notificationPost: notificationPost,
    notificationIdGet: notificationIdGet
};
