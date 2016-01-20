// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

var ws = require('ws');

describe('Http.Api.Auth', function () {

    helper.before(function () {
        return [
            helper.require('/lib/api/index.js'),
            helper.requireGlob('/lib/**/*.js'),
            dihelper.simpleWrapper({}, 'Task.Services.OBM'),
            dihelper.simpleWrapper({}, 'ipmi-obm-service'),
            dihelper.simpleWrapper(ws.Server, 'WebSocketServer'),
        ];
    });

    helper.after();

    it('should add routes', function () {
        var router = helper.injector.get('Http.Api.Auth');
        var app = require('express')();
        app.use(router);
    });
});
