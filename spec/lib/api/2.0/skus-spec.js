// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Skus.2.0', function() {
    var waterline;
    var workflowApiService;
    var Promise;
    var Constants;
    var Errors;
    var skuApiService;

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([
        ]).then(function() {
            waterline = helper.injector.get('Services.Waterline');
            sinon.stub(waterline.skus);
            workflowApiService = helper.injector.get('Http.Services.Api.Workflows');

            skuApiService = helper.injector.get('Http.Services.SkuPack');
            Promise = helper.injector.get('Promise');
            Constants = helper.injector.get('Constants');
            Errors = helper.injector.get('Errors');

            sinon.stub(skuApiService, 'getSkus');
            sinon.stub(skuApiService, 'postSku');
            sinon.stub(skuApiService, 'getSkusById');
            sinon.stub(skuApiService, 'upsertSku');
            sinon.stub(skuApiService, 'patchSku');
            sinon.stub(skuApiService, 'getNodesSkusById');
            sinon.stub(skuApiService, 'regenerateSkus');
            sinon.stub(skuApiService, 'deleteSkuById');

            sinon.stub(workflowApiService, 'createAndRunGraph');
        });
    });

    afterEach('reset stubs', function () {
        function resetStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].reset) {
                    obj[method].reset();
                }
            }).value();
        }
        resetStubs(waterline.skus);
        resetStubs(workflowApiService);
    });

    after('stop HTTP server', function () {
        skuApiService.getSkus.restore();
        skuApiService.postSku.restore();
        skuApiService.getSkusById.restore();
        skuApiService.upsertSku.restore();
        skuApiService.patchSku.restore();
        skuApiService.regenerateSkus.restore();
        skuApiService.getNodesSkusById.restore();
        skuApiService.deleteSkuById.restore();
        workflowApiService.createAndRunGraph.restore();

        return helper.stopServer();
    });

    var node = {
        id: '1234abcd1234abcd1234abcd',
        name: 'sku test node',
        type: 'compute',
        obmSettings: [
            {
                service: 'ipmi-obm-service',
                config: {
                    host: '1.2.3.4',
                    user: 'myuser',
                    password: 'mypass'
                }
            }
        ],
        autoDiscover: "false",
        identifiers: [],
        createdAt: '010101',
        updatedAt: '010101',
        tags: [],
        sku: '0987'
    };

    var record = {
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
        discoveryGraphOptions: { test: 1 },
        id: '0987'
    };

    it('should return an empty array from GET /skus', function () {
        skuApiService.getSkus.resolves([]);
        return helper.request().get('/api/2.0/skus')
            .expect('Content-Type', /^application\/json/)
            .expect(200, [])
            .then(function () {
                expect(skuApiService.getSkus).to.have.been.called;
            });
    });

    describe('created SKU', function () {
        var sku;

        it('should create a sku', function(){
            skuApiService.postSku.resolves(_.assign({}, record));
            return helper.request().post('/api/2.0/skus')
                .send(_.omit(record, 'id'))
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .then(function (req) {
                    sku = req.body;
                    expect(sku).to.have.property('name').that.equals(record.name);
                    expect(sku).to.have.property('rules').that.deep.equals(record.rules);
                    expect(sku).to.have.property('discoveryGraphName')
                        .that.equals(record.discoveryGraphName);
                    expect(sku).to.have.property('discoveryGraphOptions')
                        .that.deep.equals(record.discoveryGraphOptions);
                });
        });

        it('should contain the new sku in GET /skus', function () {
            skuApiService.getSkus.resolves([_.assign({}, record)]);
            return helper.request().get('/api/2.0/skus')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function (res) {
                    expect(skuApiService.getSkus).to.have.been.called;
                    var checkSku = res.body;
                    expect(res.body).to.have.lengthOf(1);
                    expect(res.body[0]).to.have.property('name').that.equals(record.name);
                    expect(res.body[0]).to.have.property('rules').that.deep.equals(record.rules);
                    expect(res.body[0]).to.have.property('discoveryGraphName')
                        .that.equals(record.discoveryGraphName);
                    expect(res.body[0]).to.have.property('discoveryGraphOptions')
                        .that.deep.equals(record.discoveryGraphOptions);
            });
        });

        it('should return the same sku from GET /skus/:id', function () {
            skuApiService.getSkusById.resolves(_.assign({}, record));
            return helper.request().get('/api/2.0/skus/' + sku.id)
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .then(function (res) {
                    expect(skuApiService.getSkusById).to.have.been.called;
                    var checkSku = res.body;
                    expect(checkSku).to.have.property('name').that.equals(record.name);
                });
        });

        it('should 201 reputting the same sku', function() {
            skuApiService.upsertSku.resolves(_.assign({}, record));
            return helper.request().put('/api/2.0/skus')
                .send(_.omit(record, 'id'))
                .expect(201)
                .then(function () {
                    expect(skuApiService.upsertSku).to.have.been.called;
                });
        });

        describe('PATCH /skus/:id', function () {
            var updated;
            var updatedInput = {
                name: 'updated sku name',
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
                discoveryGraphOptions: {test: 1},
                id: '0987'
            };

            beforeEach('reset createAndRunGraph stub', function () {
                workflowApiService.createAndRunGraph.reset();
            });

            it('should Patch updated name to the sku', function () {
                sku.name = 'updated sku name';
                skuApiService.patchSku.resolves(updatedInput);
                return helper.request().patch('/api/2.0/skus/0987')
                    .send(_.omit(record, 'id'))
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .then(function (res) {
                        expect(skuApiService.patchSku).to.have.been.called;
                        updated = res.body;
                        expect(updated).to.have.property('name').that.equals(sku.name);
                        expect(updated).to.have.property('rules').that.deep.equals(sku.rules);
                    });
            });
        });

        describe('GET /skus/:id/nodes', function () {
            it('should contain the node', function () {
                skuApiService.getNodesSkusById.resolves([node]);
                return helper.request().get('/api/2.0/skus/' + sku.id + '/nodes')
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .expect(function (res) {
                        expect(skuApiService.getNodesSkusById).to.have.been.called;
                        expect(res.body).to.be.an.instanceof(Array);
                        expect(res.body).to.have.length(1);
                        expect(res.body[0]).to.have.property('id').that.equals(node.id);
                    });
            });
        });

        describe('DELETE /skus/:id', function () {
            beforeEach('DELETE /skus/:id', function () {
                skuApiService.deleteSkuById.resolves();
                return helper.request().delete('/api/2.0/skus/' + sku.id)
                    .expect(204)
                    .then(function () {
                        expect(skuApiService.deleteSkuById).to.have.been.called;
                    });
            });

            it('should 404 with GET /skus/:id ', function () {
                skuApiService.getSkusById.rejects(new Errors.NotFoundError('Not Found'));
                return helper.request().get('/api/2.0/skus/0987')
                    .expect(404)
                    .then(function () {
                        expect(skuApiService.getSkusById).to.have.been.called;
                    });
            });

            it('should return an empty array from GET /skus', function () {
                skuApiService.getSkus.resolves([]);
                return helper.request().get('/api/2.0/skus')
                    .expect('Content-Type', /^application\/json/)
                    .expect(200, [])
                    .then(function () {
                        expect(skuApiService.getSkus).to.have.been.called;
                    });
            });
        });

        describe('Process file for sku pack', function () {
            var skuService;

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

            it('should process a .tar.gz file', function (done) {
                var skus = helper.injector.get('Http.Services.SkuPack');
                var fs = helper.injector.get('fs');
                var req = fs.createReadStream('spec/lib/services/sku-static/pack.tar.gz');
                var res = {};
                req.on('open', function() {
                    req.headers = {
                        'content-type': 'application/x-www-form-urlencoded'
                    };
                    skus.skuPackHandler(req, res).then(function(obj) {
                        expect(obj.id).equals("filename");
                        done();
                    });
                });
            });
        });

        describe('POST sku pack', function () {
            beforeEach('setup', function () {
                sinon.stub(skuApiService, 'skuPackHandler');
                skuApiService.skuPackHandler.resolves();
            });
            afterEach('teardown', function () {
                skuApiService.skuPackHandler.restore();
            });
            it('should post a sku pack', function (done) {
                var fs = helper.injector.get('fs');
                var skuPack = {id: 'sku name test'};
                skuApiService.skuPackHandler.resolves({
                    id: "sku name test"
                });
                var tarz = fs.createReadStream('spec/lib/services/sku-static/pack.tar.gz');
                tarz.on('open', function() {
                    return helper.request().post('/api/2.0/skus/pack')
                        .set('Content-Type',  'application/x-www-form-urlencoded')
                        .send(tarz)
                        .expect(201)
                        .end(function (err,res) {
                            expect(skuApiService.skuPackHandler).to.have.been.called;
                            expect(res.body).to.have.property('id').that.equals(skuPack.id);
                            done();
                        });
                });
            });
        });

        describe('PUT sku pack', function () {
            beforeEach('setup', function () {
                sinon.stub(skuApiService, 'putPackBySkuId');
                skuApiService.putPackBySkuId.resolves();
            });
            afterEach('teardown', function () {
                skuApiService.putPackBySkuId.restore();
            });
            it('should put a sku pack', function (done) {
                var fs = helper.injector.get('fs');
                var skuPack = {id : 'sku name test'};
                waterline.skus.needByIdentifier.resolves({id: 'abc', sku: 'sku'});
                skuApiService.putPackBySkuId.resolves({
                    id: "sku name test"
                });
                var tarz = fs.createReadStream('spec/lib/services/sku-static/pack.tar.gz');
                tarz.on('open', function() {
                    return helper.request().put('/api/2.0/skus/' + skuPack.id + '/pack')
                        .set('Content-Type',  'application/x-www-form-urlencoded')
                        .send(tarz)
                        .expect(200)
                        .end(function (err,res) {
                            expect(skuApiService.putPackBySkuId).to.have.been.called;
                            expect(res.body).to.have.property('id').that.equals(skuPack.id);
                            done();
                        });
                });
            });
        });
    });
});

