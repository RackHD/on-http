// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Schemas', function () {
    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    describe('/api/1.1/schemas', function () {
        it('should return a list of schemas', function() {
            return helper.request().get('/api/1.1/schemas')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (response) {
                    response.body.forEach(function (schema) {
                        expect(schema.id).to.contain('Serializables.V1');
                    });
                });
        });
    });

    describe('/api/1.1/schemas/:id', function () {
        it('should return the requested schema', function() {
            return helper.request().get('/api/1.1/schemas/Serializables.V1.Lookup')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (response) {
                    expect(response.body.id).to.equal('Serializables.V1.Lookup');
                });
        });
    });
});

