// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    core = require('on-core')(di),
    injector = new di.Injector(core.injectables),
    services = injector.get('Services.Core'),
    Promise = injector.get('Promise'),
    configuration = injector.get('Services.Configuration');

return Promise.resolve().then(function () {
    configuration.set('migrate', 'alter');
})
.then(services.start)
.then(process.exit);

