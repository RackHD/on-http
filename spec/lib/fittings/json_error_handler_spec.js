// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';
var fitting = require('../../../lib/fittings/json_error_handler.js');
var http = require('http');

describe('Swagger error handler fitting', function() {
    var context;
    var errorHandler;
    var mockNext;

    beforeEach('setup serdes test', function() {
        var res = {
            status: sinon.stub(),
            json: sinon.stub()
        };
        context = {
            response: res
        };
        errorHandler = fitting();
        mockNext = sinon.stub();
    });

    it('should parse an Error object', function() {
        var err = new Error('error message');

        context.error = err;
        errorHandler(context, mockNext);

        expect(context.response.status).to.be.calledWith(400);
        expect(context.response.json).to.be.calledWith({message: err.message});
        expect(mockNext).to.not.be.called;
    });

    it('should parse an Error object with status', function() {
        var err = new Error('error message');
        err.status = 404;

        context.error = err;
        errorHandler(context, mockNext);

        expect(context.response.status).to.be.calledWith(404);
        expect(context.response.json).to.be.calledWith({message: err.message});
        expect(mockNext).to.not.be.called;
    });

    it('should parse an Error object with status but without message', function() {
        var err = new Error();
        err.status = 404;

        context.error = err;
        errorHandler(context, mockNext);

        expect(context.response.status).to.be.calledWith(404);
        expect(context.response.json).to.be.calledWith({message: http.STATUS_CODES[404]});
        expect(mockNext).to.not.be.called;
    });

    it('should not parse an ordinary object', function() {
        var err = {};

        context.error = err;
        errorHandler(context, mockNext);

        expect(context.response.status).to.not.be.called;
        expect(context.response.json).to.not.be.called;
        expect(mockNext).to.be.called;
    });
});
