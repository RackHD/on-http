// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Obms', function () {
    var waterline, stub, Errors, nodeApiService, obmsApiService;

    var goodSendData = [
        {
            nodeId: '12345678',
            service: 'ipmi-obm-service',
            config: {
                host: '1.1.1.1',
                user: 'user',
                password: 'passw'
            }
        },
        {
            nodeId: '12345678',
            service: 'ipmi-obm-service',
            config: {
                host: '2.1.1.1',
                user: 'user',
                password: 'passw'
            }
        }
    ];

    var goodData = [
        {
            id: '12341234',
            node: '12345678',
            service: 'ipmi-obm-service',
            config: {
                host: '1.1.1.1',
                user: 'user',
                password: 'passw'
            }
        },
        {
            id: '56785678',
            node: '12345678',
            service: 'ipmi-obm-service',
            config: {
                host: '2.1.1.1',
                user: 'user',
                password: 'passw'
            }
        }
    ];

    var badData1 = {
        service: 'zzzipmi-obm-service',
        config: {
            host: '1.1.1.1',
            user: 'user',
            password: 'passw'
        }
    };
    var badData2 = {
        service: 'ipmi-obm-service',
        config: {
            zzzhost: '1.1.1.1',
            user: 'user',
            password: 'passw'
        }
    };

    var goodLedData = {
        nodeId: '12345678',
        value: true
    };
    var badLedData = {};

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer().then(function() {
            waterline = helper.injector.get('Services.Waterline');
            Errors = helper.injector.get('Errors');
            nodeApiService = helper.injector.get('Http.Services.Api.Nodes');
            obmsApiService = helper.injector.get('Http.Services.Api.Obms');
        });
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

    describe('/api/2.0/obms/definitions', function () {
        it('should return a list of OBM schemas', function () {
            return helper.request().get('/api/2.0/obms/definitions')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an.instanceOf(Array);
                });
        });

        it('should get the ipmi OBM schema', function () {
            return helper.request().get('/api/2.0/obms/definitions/ipmi-obm-service.json')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('title', 'ipmi-obm-service');
                    expect(res.body).to.have.deep.property(
                        'definitions.Obm.properties.service').that.is.an('object');
                    expect(res.body).to.have.deep.property(
                        'definitions.Obm.properties.config').that.is.an('object');
                });
        });

        it('should get the panduit OBM schema', function () {
            return helper.request().get('/api/2.0/obms/definitions/panduit-obm-service.json')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('title', 'panduit-obm-service');
                    expect(res.body).to.have.deep.property(
                        'definitions.Obm.properties.service').that.is.an('object');
                    expect(res.body).to.have.deep.property(
                        'definitions.Obm.properties.config').that.is.an('object');
                });

        });
    });

    describe('/api/2.0/obms', function () {
        it('should return a list of OBM instances', function () {
            stub = sinon.stub(waterline.obms, 'find').resolves(goodData);

            return helper.request().get('/api/2.0/obms')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(stub).to.have.been.called.once;
                    expect(res.body).to.be.an.instanceOf(Array);
                    expect(res.body.service).to.equal(goodData.service);
                    expect(res.body.node).to.equal(goodData.node);
                    expect(res.body.config).to.deep.equal(goodData.config);
                });
        });

        it('should put an OBM instance', function () {
            stub = sinon.stub(waterline.obms, 'upsertByNode').resolves(goodData[0]);

            return helper.request().put('/api/2.0/obms')
                .send(goodSendData[0])
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(stub).to.have.been.called.once;
                });
        });

        it('should 400 when put with unloaded schema', function () {
            stub = sinon.stub(waterline.obms, 'upsertByNode');

            return helper.request().put('/api/2.0/obms')
                .send(badData1)
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function () {
                    expect(stub).not.to.have.been.called;
                });
        });

        it('should 400 when put with missing field', function () {
            stub = sinon.stub(waterline.obms, 'upsertByNode');

            return helper.request().put('/api/2.0/obms')
                .send(badData2)
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function () {
                    expect(stub).not.to.have.been.called;
                });
        });

    });

    describe('/api/2.0/obms/:id', function () {
        it('should get an OBM instance', function () {
            stub = sinon.stub(waterline.obms, 'needByIdentifier').resolves(goodData[0]);

            return helper.request().get('/api/2.0/obms/123')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(stub).to.have.been.called.once;
                    expect(res.body.service).to.equal(goodData[0].service);
                    expect(res.body.node).to.equal('/api/2.0/nodes/'+goodData[0].node);
                });
        });

        it('should 404 if OBM instance is not found', function () {
            stub = sinon.stub(waterline.obms, 'needByIdentifier').rejects(
                new Errors.NotFoundError('not found'));

            return helper.request().get('/api/2.0/obms/123')
                .expect(404);
        });

        it('should patch an OBM instance', function () {
            stub = sinon.stub(obmsApiService, 'updateObmById').resolves(goodData[0]);

            return helper.request().patch('/api/2.0/obms/123')
                .send(goodSendData[0])
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function () {
                    expect(stub).to.have.been.called.once;
                });
        });

        it('should 400 when patching with bad data', function () {
            stub = sinon.stub(obmsApiService, 'updateObmById');

            return helper.request().patch('/api/2.0/obms/123')
                .send(badData1)
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function () {
                    expect(stub).not.to.have.been.called;
                });
        });

        it('should delete an OBM instance', function () {
            stub = sinon.stub(obmsApiService, 'removeObmById');

            return helper.request().delete('/api/2.0/obms/123')
                .expect(204)
                .expect(function () {
                    expect(stub).to.have.been.called.once;
                });
        });
    });

    describe('/api/2.0/obms/led', function () {
        it('should post a body', function () {
            stub = sinon.stub(nodeApiService, 'postNodeObmIdById');

            return helper.request().post('/api/2.0/obms/led')
                .send(goodLedData)
                .expect(201)
                .expect(function () {
                    expect(stub).to.have.been.called.once;
                });
        });

        it('should 400 if node is not specified in body', function () {
            stub = sinon.stub(nodeApiService, 'postNodeObmIdById');

            return helper.request().post('/api/2.0/obms/led')
                .send(badLedData)
                .expect(400)
                .expect(function () {
                    expect(stub).not.to.have.been.called.once;
                });
        });
    });
});
