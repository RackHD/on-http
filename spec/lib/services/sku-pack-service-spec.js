// Copyright 2015, EMC, Inc.

'use strict';

require('../../helper');

describe("SKU Pack Service", function() {
    var skuService;
    var fs;

    before(function() {
        helper.setupInjector([
            helper.require("/lib/services/sku-pack-service")
        ]);

        skuService = helper.injector.get('Http.Services.SkuPack');

        fs = helper.injector.get('fs');
        sinon.stub(fs, 'writeFileAsync');
        sinon.stub(fs, 'readFileAsync');
        sinon.stub(fs, 'readdirAsync');
        sinon.stub(fs, 'statAsync');
    });

    beforeEach(function() {
        skuService.skuHandlers = {};
        fs.writeFileAsync.reset();
        fs.readFileAsync.reset();
        fs.readdirAsync.reset();
        fs.statAsync.reset();
    });

    helper.after(function () {
        console.log('helper.after');
        fs.writeFileAsync.restore();
        fs.readFileAsync.restore();
        fs.readdirAsync.restore();
        fs.statAsync.restore();
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
        skuService.start('./invalid').should.be.rejected;
    });

    it('should start with a valid root', function() {
        fs.readdirAsync.withArgs('./valid').resolves([]);
        skuService.start('./valid').should.be.fulfilled;
    });

    it('should load a valid configuration file', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates'
        };
        fs.readdirAsync.withArgs('./valid').resolves(['a.js']);
        fs.statAsync.withArgs('./valid/a.js').resolves({ isDirectory: function() { return false; } });
        fs.readFileAsync.withArgs('./valid/a.js').resolves(JSON.stringify(data));
        fs.readdirAsync.withArgs('./valid/a/templates').resolves([]);

        skuService.start('./valid').then(function(vals) {
            expect(vals.length).to.equal(1);
            expect(('a' in skuService.skuHandlers)).to.equal(true);
        });
    });

    it('should not load an invalid configuration file', function() {
        var data = {
            httpStaticRoot: 'static',
            httpTemplateRoot: 'templates'
        };
        fs.readdirAsync.withArgs('./valid').resolves(['a.js', 'b.js']);
        fs.statAsync.resolves({ isDirectory: function() { return false; } });
        fs.readFileAsync.withArgs('./valid/a.js').resolves('{invalidjson}');
        fs.readFileAsync.withArgs('./valid/b.js').resolves(JSON.stringify(data));
        fs.readdirAsync.withArgs('./valid/a/templates').resolves([]);
        fs.readdirAsync.withArgs('./valid/b/templates').resolves([]);

        skuService.start('./valid').then(function(vals) {
            expect(vals.length).to.equal(1);
            expect(('a' in skuService.skuHandlers)).to.equal(false);
            expect(('b' in skuService.skuHandlers)).to.equal(true);
        });
    });
});
