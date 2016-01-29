// Copyright 2016, EMC, Inc.
/* jshint node:true */

"use strict";

describe("Http.Services.Api.Catalogs", function () {
    var catalogService;
    var waterline;
    var needByIdentifier;
    var find;

    before("Http.Services.Api.Catalogs before", function() {
        helper.setupInjector([
            helper.require("/lib/services/catalogs-api-service.js")
        ]);

        waterline = helper.injector.get('Services.Waterline');
        waterline.catalogs = {
            needByIdentifier: sinon.stub().resolves(),
            find: sinon.stub().resolves([])
        };

        catalogService = helper.injector.get("Http.Services.Api.Catalogs");

    });

    describe("getCatalog", function() {
        it('should expose the appropriate methods', function() {
            catalogService.should.have.property('getCatalog')
                        .that.is.a('function').with.length(1);
                });
        it('Run getCatalog', function() {
            var mock_catalog = [{ id: 'foobar' }];
            waterline.catalogs.find.resolves([mock_catalog]);
            return catalogService.getCatalog().then(function (catalogs) {
                  expect(catalogs).to.deep.equal([mock_catalog]);
            });

        });

        it('should return empty array if no catalog informations are found', function () {
            waterline.catalogs.find.resolves([]);
            var mock_catalog = [];

            return catalogService.getCatalog().should.eventually.become(mock_catalog);
            });


    });

    describe("getCatalogById", function() {
        it('should expose the appropriate methods', function() {
            catalogService.should.have.property('getCatalogById')
                .that.is.a('function').with.length(1);
        });
        it('Run getCatalogById', function() {
            var mock_catalog = { id: 'foobar' };
            waterline.catalogs.needByIdentifier.resolves([mock_catalog]);
            return catalogService.getCatalogById().then(function (catalogs) {
                expect(catalogs).to.deep.equal([mock_catalog]);
            });

        });

        it('should return empty array if no specific catalog information are found', function () {
            waterline.catalogs.find.resolves({});
            var mock_catalog = {};

            return catalogService.getCatalog().should.eventually.become(mock_catalog);
        });

    });

});
