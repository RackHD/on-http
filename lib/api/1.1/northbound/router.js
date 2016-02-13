// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = northApiFactory;

di.annotate(northApiFactory, new di.Provide('northbound-api-router'));
di.annotate(northApiFactory, new di.Inject(
        di.Injector
    )
);

function northApiFactory (injector) {
    var router = express.Router();

    router.mount = function() {

        // Un-mount existing routes when mounting.
        this.unMountAllRouters();

        router.use(injector.get(require('./catalogs')));
        router.use(injector.get(require('./config')));
        router.use(injector.get(require('./files')));
        router.use(injector.get(require('./lookups')));
        router.use(injector.get(require('./nodes')));
        router.use(injector.get(require('./obms')));
        router.use(injector.get(require('./pollers')));
        router.use(injector.get(require('./profiles')));
        router.use(injector.get(require('./schemas')));
        router.use(injector.get(require('./skus')));
        router.use(injector.get(require('./templates')));
        router.use(injector.get(require('./workflows')));
        router.use(injector.get(require('./versions')));
        router.use(injector.get(require('./tags')));
    };

    router.unMountAllRouters = function(){
        // Router.stack is an array that will grow every time a new
        // route is mounted.
        // Setting router.stack back to empty array will clear all
        // routes that had previously mounted.
        this.stack = [];
    };

    return router;
}