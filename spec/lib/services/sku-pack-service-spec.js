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

    before(function() {
        helper.setupInjector([
            dihelper.simpleWrapper({}, 'TaskGraph.Store'),
            dihelper.simpleWrapper({}, 'TaskGraph.TaskGraph'),
            helper.require("/lib/services/workflow-api-service"),
            helper.require("/lib/services/sku-pack-service"),
            dihelper.requireWrapper('os-tmpdir', 'osTmpdir', undefined, __dirname),
            dihelper.simpleWrapper(function() { arguments[1](); }, 'rimraf')
        ]);
        waterline = helper.injector.get('Services.Waterline');
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        skuService = helper.injector.get('Http.Services.SkuPack');
        Templates = helper.injector.get('Templates');
        Profiles = helper.injector.get('Profiles');
        Env = helper.injector.get('Services.Environment');

        waterline.skus = {
            needByIdentifier: sinon.stub(),
            find: sinon.stub(),
            create: sinon.stub()
        };
        waterline.nodes = {
            find: sinon.stub()
        };

        fs = helper.injector.get('fs');
        sinon.stub(fs, 'writeFileAsync');
        sinon.stub(fs, 'readFileAsync');
        sinon.stub(fs, 'readdirAsync');
        sinon.stub(fs, 'statAsync');
        sinon.stub(fs, 'mkdirAsync');
        sinon.stub(fs, 'renameAsync');
        sinon.stub(fs, 'unlinkAsync');
        sinon.stub(fs, 'statSync');
    });

    beforeEach(function() {
        skuService.skuHandlers = {};
        fs.writeFileAsync.reset();
        fs.readFileAsync.reset();
        fs.readdirAsync.reset();
        fs.statAsync.reset();
        fs.mkdirAsync.reset();
        fs.renameAsync.reset();
        fs.unlinkAsync.reset();
        fs.statSync.reset();
    });

    helper.after(function () {
        fs.writeFileAsync.restore();
        fs.readFileAsync.restore();
        fs.readdirAsync.restore();
        fs.statAsync.restore();
        fs.mkdirAsync.restore();
        fs.renameAsync.restore();
        fs.unlinkAsync.restore();
        fs.statSync.restore();
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

    describe('hould post a sku', function(){
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
        var data = {
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
            fs.readdirAsync.withArgs('./valid').resolves(['a.json']);
            fs.statAsync.withArgs('./valid/a.json')
                .resolves({ isDirectory: function() { return false; } });
            fs.readFileAsync.withArgs('./valid/a.json').resolves(JSON.stringify(data));
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
                expect(fs.readdirAsync.called).to.be.true;
                expect(fs.statAsync.called).to.be.true;
                expect(fs.readFileAsync.called).to.be.true;
                workflowApiService.defineTask.should.have.been.calledWith({
                    injectableName: 'Task.ABC::a'
                });
                workflowApiService.defineTaskGraph.should.have.been.calledWith({
                    injectableName: 'Graph.ABC::a'
                });
                Env.set.should.have.been.calledWith('config', data.skuConfig, 'a');
            });
        });

        it('should not load a task if it is already loaded', function() {
            waterline.taskdefinitions.findOne.resolves({injectableName: 'Task.ABC::a'});
            waterline.graphdefinitions.findOne.resolves();
            workflowApiService.defineTask.resolves();
            workflowApiService.defineTaskGraph.resolves();
            return skuService.start('./valid').then(function() {
                expect(('a' in skuService.skuHandlers)).to.equal(true);
                expect(fs.readdirAsync.called).to.be.true;
                expect(fs.statAsync.called).to.be.true;
                expect(fs.readFileAsync.called).to.be.true;
                workflowApiService.defineTask.should.not.have.been.called;
                workflowApiService.defineTaskGraph.should.have.been.calledWith({
                    injectableName: 'Graph.ABC::a'
                });
            });
        });

        it('should not load a graph if it is already loaded', function() {
            waterline.taskdefinitions.findOne.resolves();
            waterline.graphdefinitions.findOne.resolves({injectableName: 'Graph.ABC::a'});
            workflowApiService.defineTask.resolves();
            workflowApiService.defineTaskGraph.resolves();
            return skuService.start('./valid').then(function() {
                expect(('a' in skuService.skuHandlers)).to.equal(true);
                expect(fs.readdirAsync.called).to.be.true;
                expect(fs.statAsync.called).to.be.true;
                expect(fs.readFileAsync.called).to.be.true;
                workflowApiService.defineTask.should.have.been.calledWith(
                    {
                        injectableName: 'Task.ABC::a'
                    }
                );
                workflowApiService.defineTaskGraph.should.not.have.been.called;
            });
        });

        it('should unregister a pack', function() {
            waterline.taskdefinitions.destroy.resolves();
            waterline.graphdefinitions.destroy.resolves();
            waterline.templates.destroy.resolves();
            waterline.profiles.destroy.resolves();
            return skuService.start('./valid').then(function() {
                return skuService.unregisterPack('a', JSON.stringify(data));
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
            var newdata = _.omit(data, ['description', 'version']);
            fs.readFileAsync.withArgs('./valid/a.json').resolves(JSON.stringify(newdata));
            return skuService.start('./valid').then(function() {
                return skuService.getPackInfo('a');
            }).then(function(obj) {
                expect(obj.description).to.be.null;
                expect(obj.version).to.be.null;
            });
        });
        
        it('should get details on a pack', function() {
            fs.readFileAsync.withArgs('./valid/a.json').resolves(JSON.stringify(data));
            return skuService.start('./valid').then(function() {
                return skuService.getPackInfo('a');
            }).then(function(obj) {
                expect(obj.description).to.be.a.string;
                expect(obj.description).to.equal(data.description);
                expect(obj.version).to.be.a.string;
                expect(obj.version).to.equal(data.version);
            });
        });
    });

    it('should not load an invalid configuration file', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates'
        };
        fs.readdirAsync.withArgs('./valid').resolves(['a.json', 'b.json']);
        fs.statAsync.resolves({ isDirectory: function() { return false; } });
        fs.readFileAsync.withArgs('./valid/a.json').resolves('{invalidjson}');
        fs.readFileAsync.withArgs('./valid/b.json').resolves(JSON.stringify(data));
        fs.readdirAsync.withArgs('./valid/a/templates').resolves([]);
        fs.readdirAsync.withArgs('./valid/b/templates').resolves([]);

        return skuService.start('./valid').then(function(vals) {
            expect(vals.length).to.equal(2);
            expect(('a' in skuService.skuHandlers)).to.equal(false);
            expect(('b' in skuService.skuHandlers)).to.equal(true);
            expect(fs.readdirAsync.called).to.be.true;
            expect(fs.statAsync.called).to.be.true;
            expect(fs.readFileAsync.called).to.be.true;
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
        return skuService.validatePack(JSON.stringify(data), './valid').then(function(res) {
            expect(res).to.be.true;
            expect(fs.readdirAsync.called).to.be.true;
        });
    });

    it('should reject an invalid pack', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates',
        };
        fs.readdirAsync.withArgs('./valid').resolves(['static']);
        return skuService.validatePack(JSON.stringify(data), './valid').then(function(res) {
            expect(res).to.be.false;
            expect(fs.readdirAsync.called).to.be.true;
        });
    });

    it('should install a pack', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates'
        };
        fs.readFileAsync.withArgs('./valid/config.json').resolves(JSON.stringify(data));
        fs.readdirAsync.withArgs('./valid').resolves(['static', 'templates', 'config.json']);
        fs.readdirAsync.withArgs('./root').resolves([]);
        fs.statAsync.withArgs('./root/skuid').rejects();
        fs.mkdirAsync.resolves();
        fs.renameAsync.resolves();
        return skuService.start('./root').then(function() {
            return skuService.installPack('./valid', 'skuid');
        })
        .spread(function(name, contents) {
            expect(name).to.equal('./root/skuid.json');
            expect(contents).to.equal(JSON.stringify(data));
            expect(fs.readFileAsync.called).to.be.true;
            expect(fs.readdirAsync.called).to.be.true;
            expect(fs.statAsync.called).to.be.true;
            expect(fs.mkdirAsync.called).to.be.true;
            expect(fs.renameAsync.called).to.be.true;
        });
    });

    it('should delete a pack', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates'
        };
        fs.readdirAsync.withArgs('./root/skuid/templates').resolves([]);
        fs.readFileAsync.withArgs('./root/skuid.json').resolves(JSON.stringify(data));
        return skuService.start('./root').then(function() {
            skuService.skuHandlers.skuid = {};
            return skuService.deletePack('skuid');
        })
        .then(function(skuid) {
            expect(skuid).to.equal('skuid');
            expect(('skuid' in skuService.skuHandlers)).to.be.false;
            expect(fs.readFileAsync.called).to.be.true;
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
