// Copyright 2015, EMC, Inc.

'use strict';

require('../../helper');

describe("SKU Pack Service", function() {
    var skuService;
    var fs;

    before(function() {
        helper.setupInjector([
            helper.require("/lib/services/sku-pack-service"),
            dihelper.simpleWrapper(function() { arguments[1](); }, 'rimraf')
        ]);

        skuService = helper.injector.get('Http.Services.SkuPack');

        fs = helper.injector.get('fs');
        sinon.stub(fs, 'writeFileAsync');
        sinon.stub(fs, 'readFileAsync');
        sinon.stub(fs, 'readdirAsync');
        sinon.stub(fs, 'statAsync');
        sinon.stub(fs, 'mkdirAsync');
        sinon.stub(fs, 'renameAsync');
        sinon.stub(fs, 'unlinkAsync');
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
    });

    helper.after(function () {
        fs.writeFileAsync.restore();
        fs.readFileAsync.restore();
        fs.readdirAsync.restore();
        fs.statAsync.restore();
        fs.mkdirAsync.restore();
        fs.renameAsync.restore();
        fs.unlinkAsync.restore();
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

    it('should load a valid configuration file', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates'
        };
        fs.readdirAsync.withArgs('./valid').resolves(['a.json']);
        fs.statAsync.withArgs('./valid/a.json').resolves({ isDirectory: function() {
            return false;
        }
        });
        fs.readFileAsync.withArgs('./valid/a.json').resolves(JSON.stringify(data));
        fs.readdirAsync.withArgs('./valid/a/templates').resolves([]);

        return skuService.start('./valid').then(function(vals) {
            expect(vals.length).to.equal(1);
            expect(('a' in skuService.skuHandlers)).to.equal(true);
            expect(fs.readdirAsync.called).to.be.true;
            expect(fs.statAsync.called).to.be.true;
            expect(fs.readFileAsync.called).to.be.true;
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
            expect(vals.length).to.equal(1);
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
            httpTemplateRoot: 'templates'
        };
        fs.readdirAsync.withArgs('./valid').resolves(['static', 'templates']);
        return skuService.validatePack(JSON.stringify(data), './valid').then(function(res) {
            expect(res).to.be.true;
            expect(fs.readdirAsync.called).to.be.true;
        });
    });

    it('should reject an invalid pack', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates'
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
        fs.readdirAsync.withArgs('./valid').resolves(['static', 'templates']);
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

    it('should unregister a pack', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates'
        };
        fs.readdirAsync.withArgs('./root/skuid/templates').resolves([]);
        return skuService.start('./root').then(function() {
            return skuService.unregisterPack('skuid', JSON.stringify(data));
        })
        .then(function() {
            expect(fs.readdirAsync.called).to.be.true;
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
});
