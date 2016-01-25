// Copyright 2016, EMC, Inc.

'use strict';

var injector = (typeof helper !== 'undefined') ? helper.injector : require('../../../index.js').injector;
var redfish = injector.get('Http.Api.Services.Redfish');

module.exports = {
    getServiceRoot: getServiceRoot
};

function getServiceRoot(req, res) {
    var uuid = injector.get('uuid')('v4');
    var options = {};
    options.basepath = req.swagger.operation.api.basePath;
    options.templateScope = ['global'];
    options.url = req.url;
    options.identifier = 'ServiceRoot';
    options.uuid = uuid;

    redfish.render('redfish.1.0.0.serviceroot.1.0.0.json', 
                            'ServiceRoot.1.0.0.json#/definitions/ServiceRoot',
                            options)
    .then(function(output) {
        res.status(200).json(output);
    })
    .catch(function(error) {
        res.status(500).json(error);
    });

}
