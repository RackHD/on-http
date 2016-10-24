// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';
var fitting = require('../../../lib/fittings/error_handler.js');
var http = require('http');

describe('Swagger error handler fitting', function() {
    var context;
    var errorHandler;
    var mockNext;
    var swaggerService;

    before('inject swagger service', function() {
        helper.setupInjector(_.flattenDeep([
                onHttpContext.prerequisiteInjectables,
                onHttpContext.injectables,
            ])
        );
        swaggerService = helper.injector.get('Http.Services.Swagger');
        sinon.stub(swaggerService, 'renderer');
    });

    beforeEach('setup serdes test', function() {
        var res = {
            status: sinon.stub(),
            json: sinon.stub(),
            locals: {
                uuid: 'foo'
            }
        };
        context = {
            request: {},
            response: res
        };
        errorHandler = fitting(null, null, helper.injector);
        mockNext = sinon.stub();
    });

    afterEach(function() {
        swaggerService.renderer.reset();
    });

    it('should parse an Error object', function() {
        var err = new Error('error message');

        context.error = err;
        errorHandler(context, mockNext);

        expect(swaggerService.renderer).to.be.calledWith(
            context.request,
            context.response
        );
        expect(context.response.body).to.deep.equal({
            message: 'error message',
            status: 400,
            uuid: 'foo'
        });
        expect(mockNext).to.not.be.called;
    });

    it('should parse an Error object with status', function() {
        var err = new Error('error message');
        err.status = 404;

        context.error = err;
        errorHandler(context, mockNext);

        expect(swaggerService.renderer).to.be.calledWith(
            context.request,
            context.response
        );
        expect(context.response.body).to.deep.equal({
            message: 'error message',
            status: 404,
            uuid: 'foo'
        });

        expect(mockNext).to.not.be.called;
    });

    it('should parse an Error object with status but without message', function() {
        var err = new Error();
        err.status = 404;

        context.error = err;
        errorHandler(context, mockNext);

        expect(swaggerService.renderer).to.be.calledWith(
            context.request,
            context.response
        );
        expect(context.response.body).to.deep.equal({
            message: http.STATUS_CODES[404],
            status: 404,
            uuid: 'foo'
        });

        expect(mockNext).to.not.be.called;
    });

    it('should parse an Error object with error messages', function() {
        var err = new Error('error message');
        err.status = 404;
        // Error object from:
        // https://github.com/theganyo/swagger-node-runner/blob/master/fittings/swagger_validator.js#L24
        // and from:
        // https://github.com/apigee-127/sway/blob/master/lib/types/operation.js#L236
        err.errors = [
            { code: 'INVALID_REQUEST_PARAMETER',
              errors:
               [ { code: 'OBJECT_MISSING_REQUIRED_PROPERTY',
                   message: 'Missing required property: nodeId',
                   path: [],
                   description: 'OBM settings' } ],
              in: 'body',
              message: 'Invalid parameter (body): Value failed JSON Schema validation',
              name: 'body',
              path: [ 'paths', '/obms', 'put', 'parameters', '0' ] },
            { code: 'INVALID_REQUEST_PARAMETER',
              errors:
               [ { code: 'OBJECT_MISSING_REQUIRED_PROPERTY',
                   message: 'Missing required property: service',
                   path: [],
                   description: 'OBM settings' } ],
              in: 'body',
              message: 'Invalid parameter (body): Value failed JSON Schema validation',
              name: 'body',
              path: [ 'paths', '/obms', 'put', 'parameters', '0' ] }
        ];

        context.error = err;
        errorHandler(context, mockNext);

        expect(swaggerService.renderer).to.be.calledWith(
            context.request,
            context.response
        );
        expect(context.response.body).to.deep.equal({
            message: 'error message',
            status: 404,
            uuid: 'foo',
            errors: [
                'Missing required property: nodeId',
                'Missing required property: service'
            ]
        });
        expect(mockNext).to.not.be.called;
    });

    it('should not parse an ordinary object', function() {
        var err = {};

        context.error = err;
        errorHandler(context, mockNext);

        expect(mockNext).to.be.called;
    });
});
