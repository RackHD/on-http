// Copyright 2015, EMC, Inc.
/* jshint node: true */
'use strict';

var di = require('di');

module.exports = taskApiServiceFactory;
di.annotate(taskApiServiceFactory, new di.Provide('Http.Services.Api.Tasks'));
di.annotate(taskApiServiceFactory,
    new di.Inject(
        'Protocol.Task',
        'Services.Waterline',
        'Errors',
        'Util',
        'Logger',
        'Q'
    )
);
function taskApiServiceFactory(
    taskProtocol,
    waterline,
    Errors,
    util
) {

    function NoActiveTaskError(message) {
        NoActiveTaskError.super_.call(this, message);
        Error.captureStackTrace(this, NoActiveTaskError);
    }
    util.inherits(NoActiveTaskError, Errors.BaseError);

    function TaskApiService() {
        this.NoActiveTaskError = NoActiveTaskError;
    }

    TaskApiService.prototype.getNode = function(macAddress) {
        macAddress = macAddress || '';
        macAddress = macAddress.toLowerCase();
        return waterline.nodes.findByIdentifier(macAddress);
    };

    TaskApiService.prototype.getTasks = function(identifier) {
        var self = this;
        return taskProtocol.activeTaskExists(identifier)
        .catch(function() {
            throw new self.NoActiveTaskError('');
        })
        .then(function() {
            return taskProtocol.requestCommands(identifier);
        });
    };

    return new TaskApiService();
}
