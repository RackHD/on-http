// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

var di = require('di'),
    ejs = require('ejs');


module.exports = profileApiServiceFactory;
di.annotate(profileApiServiceFactory, new di.Provide('Http.Services.Api.Profiles'));
di.annotate(profileApiServiceFactory,
    new di.Inject(
        'Promise',
        'Logger',
        'Errors',
        '_',
        'Http.Services.Api.Taskgraph.Scheduler',
        'crypto'
    )
);
function profileApiServiceFactory(
    Promise,
    Logger,
    Errors,
    _,
    taskgraphService,
    crypto
) {

    var logger = Logger.initialize(profileApiServiceFactory);

    function ProfileApiService() {
    }

    ProfileApiService.prototype.postProfilesSwitchError = function(error) {
        logger.error('SWITCH ERROR DEBUG ', error);
    };

    ProfileApiService.prototype.profilesPutLibByName = function (name, body, scope) {
        var self = this;
        return self.FileStreaming(name, body, scope)
            .then (function(data){
                return taskgraphService.profilesPutLibByName(name, data, scope);
            });
    };

    ProfileApiService.prototype.FileStreaming = function (filename, stream) {
        var contents = '';
        var resolve;
        var reject;
        var hash = crypto.createHash('md5');

        var promise = new Promise(function(_resolve, _reject) {
            resolve = _resolve;
            reject = _reject;
        });

        stream.on('data', function(chunk) {
            var chunkStr = chunk.toString('utf-8');
            contents += chunkStr;
            hash.update(chunkStr);
        });

        stream.on('end', function() {
            resolve(contents);
        });

        stream.on('error', function(err) {
            reject(new Errors.InternalServerError(err.message));
        });

        return promise;
    };

    ProfileApiService.prototype.profilesMetaGetByName = function (name, scope) {
        return taskgraphService.profilesMetaGetByName(name, scope);
    };

    ProfileApiService.prototype.profilesGetLibByName = function (name, scope) {
        return taskgraphService.profilesGetLibByName(name, scope);
    };

    return new ProfileApiService();
}
