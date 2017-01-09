// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var hooks = injector.get('Http.Services.Api.Hooks');

/**
 * @api {get} /api/2.0/hooks GET /
 * @apiDescription get list of hooks
 * @apiName hooks-get
 * @apiGroup hooks
 */
var hooksGetAll = controller(function(req) {
    return hooks.getHooks(req.query);
});

/**
 * @api {POST} /api/2.0/hooks POST /
 * @apiDescription post a new hook
 * @apiName hooks-post
 * @apiGroup hooks
 */
var hooksPost = controller({success: 201}, function(req) {
    return hooks.createHook(req.body);
});

/**
 * @api {PATCH} /api/2.0/hooks/:identifier POST /:identifier
 * @apiDescription patch an existing hook
 * @apiName hooks-patch
 * @apiGroup hooks
 */
var hooksPatchById = controller(function(req) {
    return hooks.updateHookById(req.swagger.params.identifier.value, req.body);
});

/**
 * @api {DELETE} /api/2.0/hooks/:identifier DELETE /:identifier
 * @apiDescription delete an existing hook
 * @apiName hooks-delete
 * @apiGroup hooks
 */
var hooksDelById = controller({success: 204}, function(req) {
    return hooks.deleteHookById(req.swagger.params.identifier.value);
});

module.exports = {
    hooksGetAll: hooksGetAll,
    hooksPost: hooksPost,
    hooksPatchById: hooksPatchById,
    hooksDelById: hooksDelById
};

