// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var waterline = injector.get('Services.Waterline');

var nodesGet = controller(function(req, res) {
    return waterline.nodes.find(req.query); // todo replace with service
});

module.exports = {
    nodesGet: nodesGet
};
