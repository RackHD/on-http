// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

var response;

var functions = {
    getTasksById: function(client, callback) {
        if (client.identifier === undefined) {
            return callback('invalid task id', undefined);
        } else {
            return callback(undefined, {response: response});
        }
    },
    workflowsGet: function(client, callback) {
        if (typeof response === 'object') {
            throw response;
        }
        return callback(undefined, {response: response});
    }
};

var scheduler = {
    scheduler: {
        Scheduler: function() {
            return functions;
        }
    }
};

var mockGrpc = {
    credentials: {
        createInsecure: function() {}
    },
    load: function() {
        return scheduler;
    },
    setResponse: function(res) {
        response = res;
    }
};

module.exports = mockGrpc;