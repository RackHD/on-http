// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Ibms', function () {
    var waterline, stub, Errors;
    var configuration;
    var defaultCred =  {
        id: '12341234',
        node: '12345678',
        service: 'ssh-ibm-service',
        config: {
            host: '1.1.1.1'
        }
    };
    var goodSendData =
    {
        nodeId: '12345678',
        service: 'ssh-ibm-service',
        config: {
            host: '1.1.1.1',
            user: 'user',
            password: 'passw'
        }
    };

    var goodData = [
        {
            id: '12341234',
            node: '12345678',
            service: 'ssh-ibm-service',
            config: {
                host: '1.1.1.1',
                user: 'user',
                password: 'passw'
            }
        },
        {
            id: '56785678',
            node: '12345678',
            service: 'ssh-ibm-service',
            config: {
                host: '2.1.1.1',
                user: 'user',
                password: 'passw'
            }
        }
    ];

    var badData1 = {
        service: 'zzzssh-ibm-service',
        config: {
            host: '1.1.1.1',
            user: 'user',
            password: 'passw'
        }
    };
    var badData2 = {
        service: 'ssh-ibm-service',
        config: {
            zzzhost: '1.1.1.1',
            user: 'user',
            password: 'passw'
        }
    };

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer().then(function() {
            waterline = helper.injector.get('Services.Waterline');
            Errors = helper.injector.get('Errors');helper.injector.get("Services.Configuration");
            configuration = helper.injector.get("Services.Configuration");
            //sinon.stub(configuration);
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

    describe('/api/2.0/ibms/definitions', function () {
        it('should return a list of IBM schemas', function () {
            return helper.request().get('/api/2.0/ibms/definitions')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an.instanceOf(Array);
                });
        });

        it('should get the ssh IBM schema', function () {
            return helper.request().get('/api/2.0/ibms/definitions/ssh-ibm-service.json')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('title', 'ssh-ibm-service');
                    expect(res.body).to.have.deep.property(
                        'definitions.Ibm.properties.service').that.is.an('object');
                    expect(res.body).to.have.deep.property(
                        'definitions.Ibm.properties.config').that.is.an('object');
                });
        });

    });

    describe('/api/2.0/ibms', function () {
        it('should return a list of IBM instances', function () {
            stub = sinon.stub(waterline.ibms, 'find').resolves(goodData);

            return helper.request().get('/api/2.0/ibms')
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

        it('should put an IBM instance', function () {
            stub = sinon.stub(waterline.ibms, 'upsertByNode').resolves(goodData[0]);

            return helper.request().put('/api/2.0/ibms')
                .send(goodSendData)
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function () {
                    expect(stub).to.have.been.called.once;
                });
        });

        it('should PUT an IBM instance with default credential', function () {
            this.sandbox = sinon.sandbox.create();
            stub = sinon.stub(waterline.ibms, 'upsertByNode').resolves(defaultCred);
            configuration.set('defaultIbms', {
                "user": "monorail",
                "password": "monorail"
            });
            return helper.request().put('/api/2.0/ibms')
                .send(defaultCred)
                .expect('Content-Type', /^application\/json/)
                .expect(201);
        });
        it('should fail to PUT an IBM instance with default credential', function () {
            this.sandbox.restore();
            stub = sinon.stub(waterline.ibms, 'upsertByNode').resolves(defaultCred);
            configuration.set('defaultIbms', undefined);

            return helper.request().put('/api/2.0/ibms')
                .send(defaultCred)
                .expect('Content-Type', /^application\/json/)
                .expect(400);
        });

        it('should 400 when put with unloaded schema', function () {
            stub = sinon.stub(waterline.ibms, 'upsertByNode');

            return helper.request().put('/api/2.0/ibms')
                .send(badData1)
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function () {
                    expect(stub).not.to.have.been.called;
                });
        });

        it('should 400 when put with missing field', function () {
            stub = sinon.stub(waterline.ibms, 'upsertByNode');

            return helper.request().put('/api/2.0/ibms')
                .send(badData2)
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function () {
                    expect(stub).not.to.have.been.called;
                });
        });

    });

    describe('/api/2.0/ibms/:id', function () {
        beforeEach(function() {
            sinon.stub(waterline.ibms, 'needByIdentifier');
            sinon.stub(waterline.ibms, 'updateByIdentifier');
            sinon.stub(waterline.ibms, 'destroyByIdentifier');
        });

        afterEach(function() {
            waterline.ibms.needByIdentifier.restore();
            waterline.ibms.updateByIdentifier.restore();
            waterline.ibms.destroyByIdentifier.restore();
        });

        it('should get an IBM instance', function () {
            waterline.ibms.needByIdentifier.resolves(goodData[0]);

            return helper.request().get('/api/2.0/ibms/123')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body.service).to.equal(goodData[0].service);
                    expect(res.body.node).to.equal('/api/2.0/nodes/'+goodData[0].node);
                });
        });

        it('should 404 if IBM instance is not found', function () {
            waterline.ibms.needByIdentifier.rejects( new Errors.NotFoundError('not found'));

            return helper.request().get('/api/2.0/ibms/123')
                .expect(404);
        });

        it('should patch an IBM instance', function () {

            waterline.ibms.needByIdentifier.resolves(goodData[0]);
            stub = sinon.stub(waterline.nodes, 'getNodeById').resolves(goodData[0]);
            waterline.ibms.updateByIdentifier.resolves(goodData[0]);
            return helper.request().patch('/api/2.0/ibms/123')
                .send(goodSendData)
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function () {
                    expect(stub).to.have.been.called.once;
                });
        });

        it('should 400 when patching with bad data', function () {
            waterline.ibms.needByIdentifier.resolves([]);
            stub = sinon.stub(waterline.nodes, 'getNodeById').resolves([]);
            waterline.ibms.updateByIdentifier.resolves([]);

            return helper.request().patch('/api/2.0/ibms/123')
                .send(badData1)
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function () {
                    expect(stub).not.to.have.been.called;
                });
        });

        it('should delete an IBM instance', function () {
            waterline.ibms.needByIdentifier.resolves([]);
            stub = sinon.stub(waterline.nodes, 'getNodeById');
            waterline.ibms.destroyByIdentifier.resolves([]);

            return helper.request().delete('/api/2.0/ibms/123')
                .expect(204)
                .expect(function () {
                    expect(stub).to.have.been.called.once;
                });
        });

    });

});
