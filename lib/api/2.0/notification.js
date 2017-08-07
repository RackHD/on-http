// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var notificationApiService = injector.get('Http.Services.Api.Notification');
var _ = injector.get('_');    // jshint ignore:line
var parser = require('body-parser');
var Promise = injector.get('Promise');

var notificationPost = controller({success: 201}, function(req, res) {
    var message = _.defaults(req.swagger.query || {}, req.query || {}, req.body || {});
    message.nodeIp = res.locals.ipAddress;
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
    return notificationApiService.publishTaskProgress(message)
    .then(function(){
        //Send any feedback is OK, just to cheat ipxe engine
        res.send('Notification response, no file will be sent');
    });
});

/**
 * @api {post} /api/2.0/notification/alerts
 * @apiDescription Receives Redfish alerts, refactors the message and publishes it into amqp
 * @apiName notification post
 * @apiGroup notification
 */
var twistedParser = parser.json({ type: 'application/x-www-form-urlencoded' });
var notificationAlertsPost = controller({success: 201}, function(req,res) {
    var format= req.headers["content-type"];
    return Promise.try(function(){
        return new Promise(function(resolve, reject) {
            if (format === 'application/x-www-form-urlencoded'){
                //This is a work around where some vendors are sending json data
                // with http header content-type of “x-www-form-urlencoded”
                twistedParser(req, res, function (err) {
                    if (err) {
                        return reject(err);
                    }else{
                        resolve();
                    }
                });
            }else{
                resolve();
            }

        })
        .then(function() {
            return notificationApiService.redfishAlertProcessing(req);
        });
    });
});

module.exports = {
    notificationPost: notificationPost,
    notificationProgressPost: notificationProgressPost,
    notificationAlertsPost:notificationAlertsPost
};
