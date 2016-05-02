// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Skus', function () {
    var workflowApiService;
    var _;
    before('start HTTP server', function () {
        this.timeout(5000);
        workflowApiService = {
            createAndRunGraph: sinon.stub()
        };
        helper.setupInjector([
            helper.require("/lib/services/sku-pack-service"),
            dihelper.simpleWrapper(function() { arguments[1](); }, 'rimraf')
        ]);
        return helper.startServer([
            dihelper.simpleWrapper(workflowApiService, 'Http.Services.Api.Workflows')
        ]).then(function() {
            _ = helper.injector.get('_');
        });
    });

    beforeEach('reset test DB', function () {
        return helper.reset();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    it('should return an empty array from GET /skus', function () {
        return helper.request().get('/api/1.1/skus')
            .expect('Content-Type', /^application\/json/)
            .expect(200, []);
    });

    describe('created SKU', function () {
        var input;
        var sku;
        var node;

        beforeEach('create node', function () {
            var waterline = helper.injector.get('Services.Waterline');
            return waterline.nodes.create({ name: 'sku test node' }).then(function (node_) {
                node = node_;
            });
        });

        beforeEach('reset createAndRunGraph stub', function () {
            workflowApiService.createAndRunGraph.reset();
        });

        beforeEach('POST /sku', function () {
            input = {
                name: 'my test sku',
                rules: [
                    {
                        path: 'dmi.dmi.base_board.manufacturer',
                        contains: 'Intel'
                    },
                    {
                        path: 'dmi.memory.total',
                        equals: '32946864kB'
                    }
                ],
                discoveryGraphName: 'TestGraph.Dummy',
                discoveryGraphOptions: { test: 1 }
            };

            return helper.request().post('/api/1.1/skus')
            .send(input)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .then(function (req) {
                sku = req.body;
            });
        });

        it('should have the correct name', function () {
            expect(sku).to.have.property('name').that.equals(input.name);
        });

        it('should have the correct rules', function () {
            expect(sku).to.have.property('rules').that.deep.equals(input.rules);
        });

        it('should have the correct discoveryGraphName', function () {
            expect(sku).to.have.property('discoveryGraphName')
            .that.equals(input.discoveryGraphName);
        });

        it('should have the correct discoveryGraphOptions', function () {
            expect(sku).to.have.property('discoveryGraphOptions')
            .that.deep.equals(input.discoveryGraphOptions);
        });

        it('should have regenerated SKUs', function () {
            expect(workflowApiService.createAndRunGraph).to.have.been.calledOnce;
            expect(workflowApiService.createAndRunGraph)
                .to.have.been.calledWith({
                    name: 'Graph.GenerateSku',
                    options: {
                        defaults: {
                            nodeId: node.id
                        }
                    }
                });
        });

        it('should contain the new sku in GET /skus', function () {
            return helper.request().get('/api/1.1/skus')
            .expect('Content-Type', /^application\/json/)
            .expect(200, [sku]);
        });

        it('should return the same sku from GET /skus/:id', function () {
            return helper.request().get('/api/1.1/skus/' + sku.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200, _.merge({}, sku, { packInfo: { description: null, version: null } }) );
        });

        describe('PATCH /skus/:id', function () {
            var updated;

            beforeEach('reset createAndRunGraph stub', function () {
                workflowApiService.createAndRunGraph.reset();
            });

            beforeEach('PATCH /skus/:id', function () {
                sku.name = 'updated sku name';
                return helper.request().patch('/api/1.1/skus/' + sku.id)
                .send(sku)
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function (res) {
                    updated = res.body;
                });
            });

            it('should have an updated name', function () {
                expect(updated).to.have.property('name').that.equals(sku.name);
            });

            it('should have the same rules', function () {
                expect(updated).to.have.property('rules').that.deep.equals(sku.rules);
            });

            it('should have regenerated SKUs', function () {
                expect(workflowApiService.createAndRunGraph).to.have.been.calledOnce;
                expect(workflowApiService.createAndRunGraph)
                    .to.have.been.calledWith({
                        name: 'Graph.GenerateSku',
                        options: {
                            defaults: {
                                nodeId: node.id
                            }
                        }
                    });
            });
        });

        describe('GET /skus/:id/nodes', function () {
            beforeEach('assign the SKU to the node', function () {
                var waterline = helper.injector.get('Services.Waterline');
                return waterline.nodes.update(node.id, { sku: sku.id });
            });

            it('should contain the node', function () {
                return helper.request().get('/api/1.1/skus/' + sku.id + '/nodes')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an.instanceof(Array);
                    expect(res.body).to.have.length(1);
                    expect(res.body[0]).to.have.property('id').that.equals(node.id);
                });
            });
        });

        describe('DELETE /skus/:id', function () {
            beforeEach('reset createAndRunGraph stub', function () {
                workflowApiService.createAndRunGraph.reset();
            });

            beforeEach('DELETE /skus/:id', function () {
                return helper.request().delete('/api/1.1/skus/' + sku.id)
                .expect(204);
            });

            it('should have regenerated SKUs', function () {
                expect(workflowApiService.createAndRunGraph).to.have.been.calledOnce;
                expect(workflowApiService.createAndRunGraph)
                    .to.have.been.calledWith({
                        name: 'Graph.GenerateSku',
                        options: {
                            defaults: {
                                nodeId: node.id
                            }
                        }
                    });
            });

            it('should 404 with GET /skus/:id ', function () {
                return helper.request().get('/api/1.1/skus/' + sku.id)
                .expect(404);
            });

            it('should 404 with PATCH /skus/:id', function () {
                return helper.request().patch('/api/1.1/skus/' + sku.id)
                .send({})
                .expect(404);
            });

            it('should 404 with DELETE /skus/:id', function () {
                return helper.request().delete('/api/1.1/skus/' + sku.id)
                .expect(404);
            });

            it('should return an empty array from GET /skus', function () {
                return helper.request().get('/api/1.1/skus')
                .expect('Content-Type', /^application\/json/)
                .expect(200, []);
            });
        });

        describe('PUT /skus/pack', function () {
            var skuService;
            var _resolve, _reject;

            beforeEach('setup', function () {
                skuService = helper.injector.get('Http.Services.SkuPack');
                sinon.stub(skuService, 'installPack');
                sinon.stub(skuService, 'registerPack');
                skuService.installPack.resolves(['filename', 'contents']);
                skuService.registerPack.resolves();
            });

            beforeEach('reset createAndRunGraph stub', function () {
                workflowApiService.createAndRunGraph.resolves();
            });

            afterEach('teardown', function () {
                skuService.installPack.restore();
                skuService.registerPack.restore();
            });

            it('should process a .tar.gz file', function () {
                var skus = helper.injector.get('Http.Services.SkuPack');
                var fs = helper.injector.get('fs');
                var req = fs.createReadStream('spec/lib/services/sku-static/pack.tar.gz');
                var Promise = helper.injector.get('Promise');
                var promise = new Promise(function(resolve, reject) {
                    _resolve = resolve;
                    _reject = reject;
                });

                req.on('open', function() {
                    req.headers = {
                        'content-type': 'application/x-www-form-urlencoded'
                    };
                    skus.skuPackHandler(req)
                    .then(function() {
                        _resolve(201);
                    })
                    .catch(function(err) {
                        _reject( err );
                    });
                });

                return promise.then(function(code) {
                    expect(code).to.equal(201);
                    expect(skuService.installPack.called).to.be.true;
                    expect(skuService.registerPack.called).to.be.true;
                });
            });

            it('should process a .tar.gz file with a sku', function() {
                var skus = helper.injector.get('Http.Services.SkuPack');
                var fs = helper.injector.get('fs');
                var req = fs.createReadStream('spec/lib/services/sku-static/pack.tar.gz');
                var Promise = helper.injector.get('Promise');
                var promise = new Promise(function(resolve, reject) {
                    _resolve = resolve;
                    _reject = reject;
                });

                req.on('open', function() {
                    req.headers = {
                        'content-type': 'application/x-www-form-urlencoded'
                    };
                    skus.skuPackHandler(req, {}, 'skuid')
                    .then(function() {
                        _resolve(201);
                    })
                    .catch(function(err) {
                        _reject( err );
                    });
                });

                return promise.then(function(code) {
                    expect(code).to.equal(201);
                    expect(skuService.installPack.called).to.be.true;
                    expect(skuService.registerPack.called).to.be.true;
                });
            });
        });

        describe('DELETE /skus/:id/pack', function () {
            beforeEach('create node', function () {
                var waterline = helper.injector.get('Services.Waterline');
                return waterline.nodes.create({ name: 'sku test node' }).then(function (node_) {
                    node = node_;
                });
            });

            beforeEach('reset createAndRunGraph stub', function () {
                workflowApiService.createAndRunGraph.reset();
            });

            beforeEach('POST /sku', function () {
                input = {
                    name: 'my test sku',
                    rules: [
                        {
                            path: 'dmi.dmi.base_board.manufacturer',
                            contains: 'Intel'
                        },
                        {
                            path: 'dmi.memory.total',
                            equals: '32946864kB'
                        }
                    ],
                    discoveryGraphName: 'TestGraph.Dummy',
                    discoveryGraphOptions: { test: 1 }
                };

                return helper.request().post('/api/1.1/skus')
                .send(input)
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function (req) {
                    sku = req.body;
                });
            });


        });

    });

});

