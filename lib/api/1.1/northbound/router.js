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

    return router;
}
