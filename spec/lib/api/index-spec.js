// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('common-api-router', function () {

    helper.before(function () {
        return [
            helper.require('/lib/api/index.js'),
            helper.requireGlob('/lib/**/*.js'),
            dihelper.simpleWrapper({}, 'Task.Services.OBM'),
            dihelper.simpleWrapper({}, 'ipmi-obm-service')
        ];
    });

    helper.after();

    it('should add routes', function () {
        var router = helper.injector.get('common-api-router');
        var app = require('express')();
        app.use(router);
    });
});
