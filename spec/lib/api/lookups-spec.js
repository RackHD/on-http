// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Lookup', function () {
    var waterline, stub;

    var data = [
        {
            id: '123',
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
            macAddress: '00:11:22:33:44:55',
            ipAddress: '127.0.0.1',
            node: '123'
        },
        {
            id: 'abc',
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
            macAddress: '66:11:22:33:44:55',
            ipAddress: '127.0.0.10',
            node: 'abc'
        }
    ];

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer();
    });

    before(function () {
        waterline = helper.injector.get('Services.Waterline');
    });

    afterEach(function () {
        if (stub) {
            stub.restore();
            stub = undefined;
        }
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    describe('/api/1.1/lookups', function () {
        describe('GET', function () {
            it('should should call waterline.lookups.findByTerm', function() {
                stub = sinon.stub(waterline.lookups, 'findByTerm').resolves(data);

                return helper.request().get('/api/1.1/lookups')
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function () {
                        expect(stub).to.have.been.calledWith(undefined);
                    });
            });

            it('should call waterline.lookups.findByterm with 123', function() {
                stub = sinon.stub(waterline.lookups, 'findByTerm').resolves(data);

                return helper.request().get('/api/1.1/lookups?q=123')
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function () {
                        expect(stub).to.have.been.calledWith('123');
                    });
            });
        });

        describe('POST', function () {
            it('should call waterline.lookups.create', function() {
                stub = sinon.stub(waterline.lookups, 'create').resolves(data[0]);

                return helper.request().post('/api/1.1/lookups')
                    .send(data[0])
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function () {
                        expect(stub).to.have.been.calledWith(sinon.match(data[0]));
                    });
            });
        });
    });

    describe('/api/1.1/lookups/:id', function () {
        describe('GET', function () {
            it('should call waterline.lookups.needOneById with 123', function() {
                stub = sinon.stub(waterline.lookups, 'needOneById').resolves(data[0]);

                return helper.request().get('/api/1.1/lookups/123')
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function () {
                        expect(stub).to.have.been.calledWith('123');
                    });
            });
        });

        describe('PATCH', function () {
            it('should call waterline.lookups.updateOneById with 123', function() {
                stub = sinon.stub(waterline.lookups, 'updateOneById').resolves(data[0]);

                return helper.request().patch('/api/1.1/lookups/123')
                    .send(data[0])
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function () {
                        expect(stub).to.have.been.calledWith('123', sinon.match(data[0]));
                    });
            });
        });

        describe('DELETE', function () {
            it('should call waterline.lookups.destroyOneById with 123', function() {
                stub = sinon.stub(waterline.lookups, 'destroyOneById').resolves(data[0]);

                return helper.request().delete('/api/1.1/lookups/123')
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function () {
                        expect(stub).to.have.been.calledWith('123');
                    });
            });
        });
    });
});

