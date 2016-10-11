// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../index.js').injector;
var _ = injector.get('_');    // jshint ignore:line
var Promise = injector.get('Promise');    // jshint ignore:line
var debug = require('debug')('swagger:locals'); // jshint ignore:line
var Error = injector.get('Errors'); // jshint ignore:line

var skuParamHandler = function(context, value) {
    var injector = require('../../index.js').injector;
    var nodeServiceApi = injector.get('Http.Services.Api.Nodes');
    return nodeServiceApi.getNodeById(value)
    .then(function(node) {
        if(node.sku) {
            context.response.locals.scope.unshift(node.sku);
        }
    })
    .catch(function() {
        debug('Skipping processing in skuParamHandler for %s', value);
    });
};

var skuChassisParamHandler = function(context, value) {
    var injector = require('../../index.js').injector;
    var nodeServiceApi = injector.get('Http.Services.Api.Nodes');
    return nodeServiceApi.getAllNodes({
        or: [
            {id: value},
            {name: {'contains': value}}
        ]
    })
    .then(function(node) {
        if(node.length !== 1) {
            return [];
        }
        var encloses =  _(node[0].relations)
            .filter({relationType: 'encloses'})
            .pluck('targets')
            .flattenDeep()
            .value();
        return Promise.map(encloses, function(enclosed) {
            return nodeServiceApi.getNodeById(enclosed);
        });
    })
    .then(function(enclosedNodes) {
        if(_.every(enclosedNodes, function(node) {
            return node.sku && node.sku === enclosedNodes[0].sku;
        })) {
            context.response.locals.scope.unshift(enclosedNodes[0].sku);
        }
    })
    .catch(function() {
        debug('Skipping processing in skuChassisParamHandler for %s', value);
    });
}

module.exports = function create() {
    var anchorFuncs = {
        sku: skuParamHandler,
        skuChassis: skuChassisParamHandler
    };
    var anchors = _.keys(anchorFuncs);

    return function swagger_locals(context, next) {    // jshint ignore:line
        var promises = [];
        var operation = context.request.swagger.operation;
        _.forEach(operation.parameterObjects, function(param) {
            if(-1 !== _.indexOf(anchors, param['x-param-handler'])) {
                var value = _.get(context.request.swagger.params, [param.name, 'raw'].join('.') );
                promises.push( anchorFuncs[param['x-param-handler']].apply(null, [context, value]) );
            }
        });

        return Promise.all(promises).then(function() {
            next();
        });
    };
};
