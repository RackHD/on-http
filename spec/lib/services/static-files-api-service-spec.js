// Copyright 2016, EMC, Inc.
/* jshint node:true */

"use strict";

describe("Http.Services.Api.StaticFiles", function () {
    var path;
    var staticFilesApiService;
    var waterline;

    before("Http.Services.Api.StaticFiles before", function() {
        helper.setupInjector([
            helper.require("/lib/services/static-files-api-service.js")
        ]);
        staticFilesApiService = helper.injector.get("Http.Services.Api.StaticFiles");
        path = helper.injector.get('path');
        waterline = helper.injector.get('Services.Waterline');
        waterline.skus = {
            findOne:function() {}
        };
        this.sandbox = sinon.sandbox.create();
    });

    afterEach("Http.Services.Api.StaticFiles afterEach", function() {
        this.sandbox.restore();
    });


    describe("pairSkupackIds", function() {
        var nodeFs;
        before(function() {
            nodeFs = helper.injector.get('fs');
            sinon.stub(nodeFs, 'lstatAsync');
            sinon.stub(nodeFs, 'readdirAsync');
            this.sandbox.stub(waterline.skus, 'findOne');
        });

        beforeEach(function() {
            nodeFs.lstatAsync.reset();
            nodeFs.readdirAsync.reset();
        });

        after(function () {
            nodeFs.lstatAsync.restore();
            nodeFs.readdirAsync.restore();
        });


        it('should return an id:sku pair given valid directories and database', function() {
            nodeFs.readdirAsync.resolves(['567432']);
            nodeFs.lstatAsync.resolves({ isDirectory: function() { return true; }});
            waterline.skus.findOne.resolves({
                id: '567432',
                name: 'testSku'
            });
            return staticFilesApiService.pairSkupackIds([]).then(function(value) {
                expect(nodeFs.readdirAsync).to.have.been.called;
                expect(nodeFs.lstatAsync).to.have.been.called;
                expect(waterline.skus.findOne).to.have.been.called;
                expect(value).to.deep.equal({'567432': 'testSku'});
            });

        });

        it('returns {} when there is no sku data in the database', function() {
            nodeFs.readdirAsync.resolves(['123']);
            nodeFs.lstatAsync.resolves({ isDirectory: function() { return true; }});
            var stubFind = sinon.stub(waterline.skus, "findOne");
            stubFind.rejects(new Error('Error: no available sku in the db'));
            return staticFilesApiService.pairSkupackIds([]).then(function(value) {
                expect(nodeFs.readdirAsync).to.have.been.called;
                expect(nodeFs.lstatAsync).to.have.been.called;
                expect(waterline.skus.findOne).to.have.been.called;
                expect(value).to.deep.equal({});
            });
        });

    });


    describe("walkDirectory", function() {

        it('returns an array of file names following "static" in the path', function() {
            var dirPath = path.join("spec/mocks/static");
            var result = [ 
                { uri: 'found' },
                { uri: 'foundFile2' }
            ];
            return staticFilesApiService.walkDirectory(dirPath).then(function(value) {
                expect(value).to.deep.equal(result);
            });
        });

        it('returns an array of file names following "skupack.d" in the path', function() {
            var dirPath = "spec/mocks/skupack.d";
            var result = [
                {
                    sku: "mocks",
                    uri: "sku-id/static/found-2"
                },
                {
                    sku: "mocks",
                    uri: "sku-id/static/common/found-3"
                }
            ];
            return staticFilesApiService.walkDirectory(dirPath).then(function(value) {
                expect(value).to.deep.equal(result);
            });
        });

        it('returns [] when provided a bad path', function() {
            var dirPath;
            var result = [];
            return staticFilesApiService.walkDirectory(dirPath).then(function(value) {
                expect(value).to.deep.equal(result);
            });
        });

    });


    describe("getAllStaticFiles", function() {

        var nodeFs;
        before(function() {
            nodeFs = helper.injector.get('fs');
            sinon.stub(nodeFs, 'lstatAsync');
            sinon.stub(staticFilesApiService, 'pairSkupackIds');
            sinon.stub(staticFilesApiService, 'walkDirectory');
        });

        beforeEach(function() {
            nodeFs.lstatAsync.reset();
        });

        after(function () {
            nodeFs.lstatAsync.restore();
        });


        it('returns a single array of objects with static file data', function() {
            var result = [
                {
                    "uri": "found"
                },
                {
                    "uri": "foundFile2"
                },
                {
                    "sku": "testSku",
                    "uri": "found-2"
                },
                {
                    "sku": "testSku",
                    "uri": "common/found-3"
                }
            ];
            var pair = {
                '567432': 'testSku'
            };
            var walkFirst = [
                {
                    uri: 'found'
                },
                {
                    uri: 'foundFile2'
                }
            ];
            var walkSecond = [
                {
                    sku: "567432",
                    uri: "found-2"
                },
                {
                    sku: "567432",
                    uri: "common/found-3"
                }
            ];
            var walkThird = [];

            staticFilesApiService.pairSkupackIds.resolves(pair);
            staticFilesApiService.walkDirectory
                .onFirstCall().resolves(walkFirst)
                .onSecondCall().resolves(walkSecond)
                .onThirdCall().resolves(walkThird);
            return staticFilesApiService.getAllStaticFiles().then(function(value) {
                expect(value).to.deep.equal(result);
            });
        });

        it('returns [] given no valid dirs to walk or those dirs are empty', function() {
            nodeFs.lstatAsync.resolves({ isDirectory: function() { return false; }});
            staticFilesApiService.walkDirectory.resolves([]);
            return staticFilesApiService.getAllStaticFiles().then(function(value) {
                expect(value).to.deep.equal([]);
            });
        });
    });

});
