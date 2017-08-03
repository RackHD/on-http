// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Lookup 2.0', function () {
    var waterline, stub, Promise, _, findByTerm, create,
        needOneById, updateOneById, destroyOneById;

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

    var invalidData = [
        {
            macAddress: '00:11:22:33:44:55',
            ipAddress: '555.555.555.555',
            node: '123'
        },
        {
            macAddress: '00:11:22:33:44:55',
            ipAddress: '12.34.5',
            node: '123'
        },
        {
            macAddress: '00:11:22:33:44',
            ipAddress: '127.0.0.1',
            node: '123'
        },
        {
            macAddress: '001:111:222:334:444:555',
            ipAddress: '127.0.0.1',
            node: '123'
        },
        {
            macAddress: '00:11:22:33:44',
            ipAddress: '127.0.0.1',
            node: 123
        }
    ];

    helper.httpServerBefore();

    before(function () {
        Promise = helper.injector.get('Promise');
        _ = helper.injector.get('_');
        waterline = helper.injector.get('Services.Waterline');
    });

    beforeEach('set up mocks', function () {
        findByTerm = this.sandbox.stub(waterline.lookups, 'findByTerm').resolves(data);
        create = this.sandbox.stub(waterline.lookups, 'create').resolves(data[0]);
        needOneById = this.sandbox.stub(waterline.lookups, 'needOneById').resolves(data[0]);
        updateOneById = this.sandbox.stub(waterline.lookups, 'updateOneById').resolves(data[0]);
        destroyOneById = this.sandbox.stub(waterline.lookups, 'destroyOneById').resolves(data[0]);
    });

    helper.httpServerAfter();

    describe('/api/2.0/lookups', function () {
        describe('GET', function () {
            it('should call waterline.lookups.findByTerm', function() {
                return helper.request().get('/api/2.0/lookups')
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function () {
                        expect(findByTerm).to.have.been.calledWith(undefined);
                    });
            });

            it('should call waterline.lookups.findByterm with 123', function() {
                return helper.request().get('/api/2.0/lookups?q=123')
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function () {
                        expect(findByTerm).to.have.been.calledWith('123');
                    });
            });
        });

        describe('POST', function () {
            it('should call waterline.lookups.create', function() {
                var postData = _.omit(data[0], [ 'id', 'createdAt', 'updatedAt' ]);
                return helper.request().post('/api/2.0/lookups')
                    .send(postData)
                    .expect('Content-Type', /^application\/json/)
                    .expect(201)
                    .expect(function () {
                        expect(create).to.have.been.calledWith(sinon.match(postData));
                    });
            });
            it('should reject invalid input', function() {
                return Promise.map(invalidData, function (data) {
                    return helper.request().post('/api/2.0/lookups')
                        .send(data)
                        .expect(400)
                });
            });
        });
    });

    describe('/api/2.0/lookups/:id', function () {
        describe('GET', function () {
            it('should call waterline.lookups.needOneById with 123', function() {
                return helper.request().get('/api/2.0/lookups/123')
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function () {
                        expect(needOneById).to.have.been.calledWith('123');
                    });
            });
        });

        describe('PATCH', function () {
            it('should call waterline.lookups.updateOneById with 123', function() {
                var patchData = _.omit(data[0], [ 'id', 'createdAt', 'updatedAt' ]);
                return helper.request().patch('/api/2.0/lookups/123')
                    .send(patchData)
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function () {
                        expect(updateOneById).to.have.been.calledWith('123', patchData);
                    });
            });

            it('should reject invalid input', function() {
                return Promise.map(invalidData, function (data) {
                    return helper.request().post('/api/2.0/lookups')
                        .send(data)
                        .expect(400)
                });
            });
        });

        describe('DELETE', function () {
            it('should call waterline.lookups.destroyOneById with 123', function() {
                return helper.request().delete('/api/2.0/lookups/123')
                    .expect(204)
                    .expect(function () {
                        expect(destroyOneById).to.have.been.calledWith('123');
                    });
            });
        });
    });
});

