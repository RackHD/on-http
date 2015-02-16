// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('common-api-router', function () {

    helper.before(function () {
        return [
            helper.require('/lib/api/index.js'),
            helper.require('/lib/services/file-service'),
            helper.require('/lib/services/files/file-plugin'),
            helper.require('/lib/services/common-api-presenter.js'),
            helper.require('/lib/services/gridfs-service.js'),
            dihelper.simpleWrapper({}, 'Task.Services.OBM')
        ];
    });

    helper.after();

    it('should add routes', function () {
        var router = helper.injector.get('common-api-router');
        var app = require('express')();
        app.use(router);
    });
});
