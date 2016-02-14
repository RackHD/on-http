// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;

module.exports = {
    getConfig: getConfig,
    patchConfig: patchConfig
};

function getConfig(req, res) {
    var config = injector.get('Http.Services.Api.Config');
    res.json(config.configGetAll());
}

function patchConfig(req, res) {
    var config = injector.get('Http.Services.Api.Config');
    res.json(config.configSet(req));
}

