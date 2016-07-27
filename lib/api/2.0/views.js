// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var views = injector.get('Views');
var Promise = injector.get('Promise');
var Errors = injector.get('Errors');
var _ = injector.get('_');
var bodyParser = require('body-parser');

/**
* @api {get} /api/2.0/views GET /views
* @apiVersion 2.0.0
* @apiDescription Get list of views
* @apiName views-get
* @apiGroup views
* @apiSuccess {json} List of all views or if there are none an empty collection.
*/
var viewsGet = controller(function() {
    return views.getAll();
});

/**
* @api {get} /api/2.0/views/:identifier GET /views/:identifier
* @apiVersion 2.0.0
* @apiDescription get a specific view
* @apiName views-getById
* @apiGroup views
* @apiParam {String} name of view
* @apiSuccess {json} view with specified identifier.
* @apiError NotFound There is no view with specified name
*/
var viewsGetById = controller(function(req) {
    return views.get(req.swagger.params.identifier.value)
    .then(function(view) {
        if (_.isEmpty(view)) {
            throw new Errors.NotFoundError(
                'Could not find ' + req.swagger.params.identifier.value
            );
        }
        return view;
    });
});

/**
* @api {put} /api/2.0/views/:identifier PUT /views/:identifer
* @apiVersion 2.0.0
* @apiDescription create or update a view
* @apiName views-put
* @apiGroup views
* @apiParam {String} name of view
* @apiSuccess {json} created or updated view.
* @apiError Error was encountered, view is unchanged.
*/
var viewsPut = controller({success: 201}, function(req, res) {
    return views.put(req.swagger.params.identifier.value, req);
});

/**
* @api {delete} /api/2.0/views/:identifier DELETE /views/:identifier
* @apiVersion 2.0.0
* @apiDescription Unlink specified view
* @apiName views-delete
* @apiGroup views
* @apiParam {String} name of view
* @apiError NotFound There is no view with specified name
*/
var viewsDelete = controller({send204OnEmpty: true}, function(req) {
    return views.unlink(req.swagger.params.identifier.value)
    .then(function(view) {
        if (_.isEmpty(view)) {
            throw new Errors.NotFoundError(
                'Could not delete ' + req.swagger.params.identifier.value
            );
        }
    });
});

module.exports = {
    viewsGet: viewsGet,
    viewsGetById: viewsGetById,
    viewsPut: viewsPut,
    viewsDelete: viewsDelete
};
