// Copyright 2015, EMC, Inc.

'use strict';

require('../../helper');

describe("SKU Pack Service", function() {
    var skuService;
    var fs;
    var waterline;
    var workflowApiService;
    var Templates;
    var Profiles;
    var Env;
    var Errors;
    var sandbox;
    var self = this;

    before(function() {
        helper.setupInjector([
            dihelper.simpleWrapper({}, 'TaskGraph.Store'),
            dihelper.simpleWrapper({}, 'TaskGraph.TaskGraph'),
            helper.require("/lib/services/workflow-api-service"),
            helper.require("/lib/services/sku-pack-service"),
            dihelper.requireWrapper('os-tmpdir', 'osTmpdir', undefined, __dirname),
            dihelper.simpleWrapper(function() { arguments[1](); }, 'rimraf'),
            dihelper.requireWrapper('fs-extra', 'fs', undefined, __dirname)
        ]);
        waterline = helper.injector.get('Services.Waterline');
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        skuService = helper.injector.get('Http.Services.SkuPack');
        Templates = helper.injector.get('Templates');
        Profiles = helper.injector.get('Profiles');
        Env = helper.injector.get('Services.Environment');
        Errors = helper.injector.get('Errors');
        fs = helper.injector.get('fs');

        waterline.skus = {
            needByIdentifier: function() {},
            find: function() {},
            create: function() {},
            findOne: function() {},
            destroyByIdentifier: function(){},
            updateByIdentifier: function(){},
            update: function() {}
        };

        waterline.nodes = {
            find: function() {}
        };

        self.sandbox = sinon.sandbox.create();
        self.sandbox.stub(waterline.skus, 'needByIdentifier');
        self.sandbox.stub(waterline.skus, 'find');
        self.sandbox.stub(waterline.skus, 'create');
        self.sandbox.stub(waterline.skus, 'findOne');
        self.sandbox.stub(waterline.skus, 'update');
        self.sandbox.stub(waterline.nodes, 'find');
        self.sandbox.stub(waterline.skus, 'destroyByIdentifier');
        self.sandbox.stub(waterline.skus, 'updateByIdentifier');
        self.sandbox.stub(fs, 'writeFileAsync');
        self.sandbox.stub(fs, 'readFileAsync');
        self.sandbox.stub(fs, 'readdirAsync');
        self.sandbox.stub(fs, 'statAsync');
        self.sandbox.stub(fs, 'mkdirAsync');
        self.sandbox.stub(fs, 'moveAsync');
        self.sandbox.stub(fs, 'unlinkAsync');
        self.sandbox.stub(fs, 'statSync');
    });

    beforeEach(function() {
        skuService.skuHandlers = {};
        self.sandbox.reset();
    });

    helper.after(function () {
        self.sandbox.restore();
    });

    it('should get the skus', function() {
        waterline.skus.find.resolves({id: 'abc', sku: 'sku'});
        return skuService.getSkus({}).then(function(val){
            expect(waterline.skus.find).to.have.been.called;
            expect(val.id).equal('abc');
            expect(val.sku).equal('sku');
        });
    });

    describe('should get a sku by id', function(){
        before(function(){
            sinon.stub(skuService, 'getPackInfo');
        });
        after(function(){
            skuService.getPackInfo.restore();
        });
        it('should get a sku by id', function() {
            waterline.skus.needByIdentifier.resolves({id: 'abc', sku: 'sku'});
            skuService.getPackInfo.resolves({
                description: 'descrpt',
                version: 'vers'
            });
            return skuService.getSkusById('123').then(function(val){
                expect(waterline.skus.needByIdentifier).to.have.been.called;
                expect(val.id).equal('abc');
                expect(val.sku).equal('sku');
                expect(val.packInfo.description).equal('descrpt');
                expect(val.packInfo.version).equal('vers');
            });
        });
    });

    describe('should put a skupack', function(){
        before(function(){
            sinon.stub(skuService, 'skuPackHandler');
        });
        after(function(){
            skuService.skuPackHandler.restore();
        });
        it('should put a skupack', function() {
            waterline.skus.needByIdentifier.resolves({id: 'abc', sku: 'sku'});
            skuService.skuPackHandler.resolves({
                id: "sku name test"
            });
            var req = {swagger:{params:{identifier:{value:123}}}};
            var res = {};
            return skuService.putPackBySkuId (req, res).then(function(val){
                expect(waterline.skus.needByIdentifier).to.have.been.called;
                expect(val.id).equal("sku name test");
            });
        });
    });

    describe('should delete a sku pack', function(){
        before(function(){
            sinon.stub(skuService, 'deletePack');
        });
        after(function(){
            skuService.deletePack.restore();
        });
        it('should delete a sku pack', function() {
            waterline.skus.needByIdentifier.resolves({id: 'abc', sku: 'sku'});
            skuService.deletePack.resolves();
            return skuService.deleteSkuPackById ('123').then(function(){
                expect(waterline.skus.needByIdentifier).to.have.been.called;
                expect(skuService.deletePack).to.have.been.called;
            });
        });
    });

    it('should get the nodes with a certain sku id ', function() {
        waterline.skus.needByIdentifier.resolves({id: 'abc', sku: 'sku'});
        waterline.nodes.find.resolves('123');
        return skuService.getNodesSkusById('456').then(function(val){
            expect(waterline.skus.needByIdentifier).to.have.been.called;
            expect(val).equal('123');
        });
    });

    describe('should post a sku', function(){
        before(function(){
            sinon.stub(skuService, 'regenerateSkus');
        });
        after(function(){
            skuService.regenerateSkus.restore();
        });
        it('should post a sku ', function() {
          var sku =
          {
              "name": "my test sku",
              "rules": [
                  {
                      "path": "dmi.Base Board Information.Manufacturer",
                      "contains": "Intel"
                  },
                  {
                      "path": "ohai.dmi.memory.total",
                      "equals": "32946864kB"
                  }
              ],
              "discoveryGraphName": "Graph.InstallCoreOS",
              "discoveryGraphOptions": {
                  "username": "testuser",
                  "password": "hello",
                  "hostname": "mycoreos"
              },
              "createdAt": "2016-04-07T12:25:18.529Z",
              "updatedAt": "2016-04-07T12:25:18.529Z",
              "id": "570651ae87b3579d76508d26"
          };
          waterline.skus.create.resolves(sku);
          waterline.skus.findOne.resolves();
          skuService.regenerateSkus.resolves();
          return skuService.postSku(sku).then(function(val){
              expect(waterline.skus.create).to.have.been.called;
              expect(val.rules).equal(sku.rules);
              expect(val.discoveryGraphName).equal(sku.discoveryGraphName);
              expect(val.username).equal(sku.username);
              expect(val.password).equal(sku.password);
              expect(val.hostname).equal(sku.hostname);
          });
        });

        it('should return an error Duplicate name found', function() {
            var sku =
            {"name": "my test sku"};
            waterline.skus.findOne.resolves({});
            return skuService.postSku(sku)
                .then(function() {
                    throw new Error('postSku should be rejected!');
                })
                .catch(function (err) {
                    expect(err.status).equal(409);
                });
        });
    });

    describe('should patch a sku', function() {
        before(function () {
            sinon.stub(skuService, 'regenerateSkus');
        });
        after(function () {
            skuService.regenerateSkus.restore();
        });
        it('should patch a sku ', function () {
            var sku =
            {
                "name": "my test sku",
                "rules": [
                    {
                        "path": "dmi.Base Board Information.Manufacturer",
                        "contains": "Intel"
                    },
                    {
                        "path": "ohai.dmi.memory.total",
                        "equals": "32946864kB"
                    }
                ],
                "discoveryGraphName": "Graph.InstallCoreOS",
                "discoveryGraphOptions": {
                    "username": "testuser",
                    "password": "hello",
                    "hostname": "mycoreos"
                },
                "createdAt": "2016-04-07T12:25:18.529Z",
                "updatedAt": "2016-04-07T12:25:18.529Z",
                "id": "570651ae87b3579d76508d26"
            };
            waterline.skus.updateByIdentifier.resolves({id: '570651ae87b3579d76508d26',
                name: 'updatedSkuName'});
            skuService.regenerateSkus.resolves();
            return skuService.patchSku(sku.id).then(function (val) {
                expect(waterline.skus.updateByIdentifier).to.have.been.called;
                expect(val.name).equal('updatedSkuName');
            });
        });
    });

    describe('should upsert a sku', function() {
        before(function () {
            sinon.stub(skuService, 'postSku');
            sinon.stub(skuService, 'patchSku');

        });
        after(function () {
            skuService.postSku.restore();
            skuService.patchSku.restore();
        });
        var sku =
        {
            "name": "my test sku",
            "rules": [
                {
                    "path": "dmi.Base Board Information.Manufacturer",
                    "contains": "Intel"
                },
                {
                    "path": "ohai.dmi.memory.total",
                    "equals": "32946864kB"
                }
            ],
            "discoveryGraphName": "Graph.InstallCoreOS",
            "discoveryGraphOptions": {
                "username": "testuser",
                "password": "hello",
                "hostname": "mycoreos"
            },
            "createdAt": "2016-04-07T12:25:18.529Z",
            "updatedAt": "2016-04-07T12:25:18.529Z",
            "id": "570651ae87b3579d76508d26"
        };

        it('should return sku if a sku is posted', function(){
            skuService.postSku.resolves(sku);
            return skuService.upsertSku(sku).then(function (val) {
                expect(val.rules).equal(sku.rules);
                expect(val.discoveryGraphName).equal(sku.discoveryGraphName);
                expect(val.username).equal(sku.username);
                expect(val.password).equal(sku.password);
                expect(val.hostname).equal(sku.hostname);
            });
        });

        it('should return err status if postSku fails a non-409', function(){
            return skuService.upsertSku(sku)
                .then(function() {
                    throw new Error('internal server error');
                })
                .catch(function (err) {
                    var err = new Errors.BaseError('internal server error');
                    err.status = 500; //Checking if not 409
                    expect(err.status).equal(500);
                });
        });

        it('should patch sku if post failed due to Duplicate error', function(){
            var err = new Errors.BaseError('duplicate name found');
            err.status = 409;
            skuService.postSku.rejects(err);
            waterline.skus.findOne.resolves(sku);
            skuService.patchSku.resolves(sku);
            return skuService.upsertSku(sku).then(function () {
                expect(waterline.skus.findOne).to.have.been.called;
                expect(skuService.patchSku).to.have.been.called;
            });
        });
    });

    describe('should delete sku by ID', function(){
        before(function(){
            sinon.stub(skuService, 'regenerateSkus');
            sinon.stub(skuService, 'deletePack');
        });
        after(function(){
            skuService.regenerateSkus.restore();
            skuService.deletePack.restore();
        });
        it('should delete sku by ID', function(){
            var emptySku = [];
            waterline.skus.destroyByIdentifier.resolves(emptySku);
            skuService.regenerateSkus.resolves();
            skuService.deletePack.resolves();
            return skuService.deleteSkuById().then(function(sku){
                expect(sku).to.deep.equal(emptySku);
                expect(waterline.skus.destroyByIdentifier).to.have.been.called;
                expect(skuService.regenerateSkus).to.have.been.calledOnce;
            });
        });

    });

    it('should expose the appropriate methods', function() {
        skuService.should.have.property('start')
            .that.is.a('function').with.length(1);

        skuService.should.have.property('static')
            .that.is.a('function').with.length(3);

        skuService.should.have.property('registerPack')
            .that.is.a('function').with.length(2);
    });

    it('should fail to start with an invalid root', function() {
        fs.readdirAsync.rejects();
        //SKU service swallowes the exception, so it should not throw error even for invalid root
        return skuService.start('./invalid').should.not.be.rejected;
    });

    it('should start with a valid root', function() {
        fs.readdirAsync.withArgs('./valid').resolves([]);
        return skuService.start('./valid').should.be.fulfilled;
    });

    describe('configuration file', function() {
        var skuAData = {
            id: 'a',
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates',
            workflowRoot: 'workflows',
            taskRoot: 'tasks',
            httpProfileRoot: 'profiles',
            skuConfig: {
                key: 'value'
            },
            description: 'sku package',
            version: '1.0.0'
        };

        before(function() {
            waterline.skus.find.resolves([skuAData]);
            waterline.skus.findOne.withArgs({id: 'a'}).resolves(skuAData);
            waterline.skus.findOne.resolves();
            fs.readdirAsync.withArgs('./valid/a/templates').resolves(['template.file']);
            fs.readdirAsync.withArgs('./valid/a/profiles').resolves(['profile.ipxe']);
            fs.readdirAsync.withArgs('./valid/a/workflows').resolves(['graph.json']);
            fs.readdirAsync.withArgs('./valid/a/tasks').resolves(['task.json']);
            fs.readFileAsync.withArgs('./valid/a/tasks/task.json')
                .resolves('{ "injectableName": "Task.ABC"}');
            fs.readFileAsync.withArgs('./valid/a/workflows/graph.json')
                .resolves('{ "injectableName": "Graph.ABC"}');
            fs.readFileAsync.withArgs('./valid/a/profiles/profile.ipxe')
                .resolves('content');
            fs.readFileAsync.withArgs('./valid/a/templates/template.file')
                .resolves('content');
            fs.statSync.returns({ isFile: function() { return true; }});
            fs.statAsync.resolves({ isDirectory: function() { return false; }});

            waterline.taskdefinitions = {
                findOne: sinon.stub(),
                destroy: sinon.stub()
            };

            waterline.graphdefinitions = {
                findOne: sinon.stub(),
                destroy: sinon.stub()
            };

            waterline.templates = {
                findOne: sinon.stub(),
                destroy: sinon.stub(),
                create: sinon.stub()
            };

            waterline.profiles = {
                findOne: sinon.stub(),
                destroy: sinon.stub(),
                create: sinon.stub()
            };

            sinon.stub(workflowApiService, "defineTask");
            sinon.stub(workflowApiService, "defineTaskGraph");
            sinon.stub(Templates, "put");
            sinon.stub(Profiles, "put");
            sinon.stub(Env, "set");
        });

        beforeEach(function() {
            workflowApiService.defineTask.reset();
            workflowApiService.defineTaskGraph.reset();
            waterline.templates.findOne = sinon.stub().resolves();
            waterline.profiles.findOne = sinon.stub().resolves();
            waterline.templates.destroy = sinon.stub().resolves([]);
            waterline.profiles.destroy = sinon.stub().resolves([]);
        });

        after(function() {
            workflowApiService.defineTask.restore();
            workflowApiService.defineTaskGraph.restore();
            Templates.put.restore();
            Profiles.put.restore();
            Env.set.restore();
            ['taskdefinitions','graphdefinitions','templates','profiles'].forEach(function(db) {
                delete waterline[db];
            });
        });
        
        it('should load a configuration file', function() {
            waterline.taskdefinitions.findOne.resolves();
            waterline.graphdefinitions.findOne.resolves();
            waterline.templates.findOne.resolves();
            waterline.profiles.findOne.resolves();
            workflowApiService.defineTask.resolves();
            workflowApiService.defineTaskGraph.resolves();
            return skuService.start('./valid').then(function() {
                expect(('a' in skuService.skuHandlers)).to.equal(true);
                workflowApiService.defineTask.should.have.been.calledWith({
                    injectableName: 'Task.ABC::a'
                });
                workflowApiService.defineTaskGraph.should.have.been.calledWith({
                    injectableName: 'Graph.ABC::a'
                });
                Env.set.should.have.been.calledWith('config', _.merge({}, skuAData.skuConfig,
                                                   {Graph: { ABC : 'Graph.ABC::a'}}), 'a');
            });
        });

        it('should 404 registering an invalid sku', function() {
            return skuService.registerPack('invalid').should.be.rejectedWith(Errors.NotFoundError);
        });

        it('should unregister a pack', function() {
            waterline.taskdefinitions.destroy.resolves();
            waterline.graphdefinitions.destroy.resolves();
            waterline.templates.destroy.resolves([ { path: 'template' } ]);
            waterline.profiles.destroy.resolves([ { path: 'profile' } ]);
            waterline.templates.findOne.onCall(1).resolves({ path: 'template' });
            waterline.profiles.findOne.onCall(1).resolves({ path: 'profile' });
            return skuService.start('./valid').then(function() {
                return skuService.unregisterPack('a', skuAData);
            })
            .then(function() {
                expect(fs.readdirAsync.called).to.be.true;
                expect(waterline.taskdefinitions.destroy).to.have.been.called;
                expect(waterline.graphdefinitions.destroy).to.have.been.called;
                expect(waterline.profiles.destroy).to.have.been.called;
                expect(waterline.templates.destroy).to.have.been.called;
            });
        });

        it('should get details on a pack', function() {
            var newdata = _.omit(skuAData, ['description', 'version']);
            waterline.skus.findOne.withArgs({id: 'a'}).resolves(newdata);
            return skuService.start('./valid').then(function() {
                return skuService.getPackInfo('a');
            }).then(function(obj) {
                expect(obj.description).to.be.null;
                expect(obj.version).to.be.null;
            });
        });
        
        it('should get details on a pack', function() {
            waterline.skus.findOne.withArgs({id: 'a'}).resolves(skuAData);
            return skuService.start('./valid').then(function() {
                return skuService.getPackInfo('a');
            }).then(function(obj) {
                expect(obj.description).to.be.a.string;
                expect(obj.description).to.equal(skuAData.description);
                expect(obj.version).to.be.a.string;
                expect(obj.version).to.equal(skuAData.version);
            });
        });
    });

    it('should accept a valid pack', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates',
            workflowRoot: 'workflows',
            taskRoot: 'tasks',
            httpProfileRoot: 'profiles'
        };
        fs.readdirAsync.withArgs('./valid').resolves(
            ['static', 'templates', 'workflows', 'tasks', 'profiles']);
        return skuService.validatePack(JSON.stringify(data), './valid').should.not.be.rejected;
    });

    it('should reject an invalid pack', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates',
        };
        fs.readdirAsync.withArgs('./valid').resolves(['static']);
        return skuService.validatePack(JSON.stringify(data), './valid')
            .should.be.rejectedWith(Errors.BadRequestError);
    });

    it('should install a pack', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates',
            name: 'my test sku',
            rules: [
                { 
                    path: 'dmi.Base Board Information.Manufacturer',
                    contains: 'Intel'
                }
            ]
        };
        waterline.skus.find.resolves([]);
        waterline.skus.findOne.withArgs({id: 'skuid'}).resolves(data);
        fs.readFileAsync.withArgs('./valid/config.json').resolves(JSON.stringify(data));
        fs.readdirAsync.withArgs('./valid').resolves(['static', 'templates', 'config.json']);
        fs.statAsync.withArgs('./root/skuid').rejects();
        fs.mkdirAsync.resolves();
        fs.moveAsync.resolves();
        return skuService.start('./root').then(function() {
            return skuService.installPack('./valid', 'skuid');
        })
        .spread(function(name, contents) {
            expect(name).to.equal('skuid');
            expect(contents).to.equal(JSON.stringify(data));
            expect(fs.readFileAsync.called).to.be.true;
            expect(fs.readdirAsync.called).to.be.true;
            expect(fs.statAsync.called).to.be.true;
            expect(fs.mkdirAsync.called).to.be.true;
            expect(fs.moveAsync.called).to.be.true;
        });
    });

    it('should delete a pack', function() {
        fs.readdirAsync.withArgs('./root/skuid/templates').resolves([]);
        return skuService.start('./root').then(function() {
            skuService.skuHandlers.skuid = {};
            return skuService.deletePack('skuid');
        })
        .then(function(skuid) {
            expect(skuid).to.equal('skuid');
            expect(('skuid' in skuService.skuHandlers)).to.be.false;
            expect(fs.readdirAsync.called).to.be.true;
        });
    });

    it('should skip the static handler if id is undefined', function(done) {
        skuService.skuHandlers.skuid = {};
        skuService.static(undefined, { locals: {} }, function() {
            done();
        });
    });

    it('should call the static handler if id is defined', function(done) {
        skuService.skuHandlers.skuid = {
            abc: function(req,res,next) { next(); }
        };
        waterline.nodes = {
            needByIdentifier: sinon.stub()
        };
        waterline.nodes.needByIdentifier.resolves({id: 'abc', sku: 'sku'});
        skuService.static(undefined, { locals: { identifier: 'abc'} }, function() {
            done();
        });
    });




});
