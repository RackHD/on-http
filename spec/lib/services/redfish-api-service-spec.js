// Copyright 2016, EMC, Inc.

'use strict';

require('../../helper');

describe("Redfish Api Service", function() {
    var redfish;
    var view;
    var _;
    var env;
    var waterline;
    var testObj = {
        '@odata.context': '/redfish/v1/$metadata#Systems',
        '@odata.id': '/redfish/v1/Systems/',
        '@odata.type': '#ComputerSystemCollection.ComputerSystemCollection',
        Oem: {},
        Name: 'Computer System Collection',
        'Members@odata.count': 1,
        Members: [
            {
                '@odata.id': '/redfish/v1/Systems/56c5ce6b283abbcb6c2b6037'
            }
        ]
    };

    before(function() {
        helper.setupInjector([
            helper.require("/lib/services/schema-api-service"),
            helper.require("/lib/services/redfish-api-service"),
            helper.require("/lib/api/view/view"),
            dihelper.simpleWrapper(function() { arguments[1](); }, 'rimraf'),
            dihelper.simpleWrapper({}, 'Services.Waterline')
        ]);
        redfish = helper.injector.get('Http.Api.Services.Redfish');
        view = helper.injector.get('Views');
        _ = helper.injector.get('_');

        env = helper.injector.get('Services.Environment');
        waterline = helper.injector.get('Services.Waterline');
        sinon.stub(env, "get").resolves();

        sinon.stub(view, "get").resolves({contents: JSON.stringify(testObj)});
        waterline.nodes = {
            getNodeById: sinon.stub()
        };
    });

    beforeEach(function() {
        view.get.reset();
    });

    after(function () {
        view.get.restore();
        env.get.restore();
    });

    it('should get and render without validation', function() {
        return redfish.get('templateName', {})
            .then(function(result) {
                expect(result).to.deep.equal(testObj);
            });
    });

    it('should get and render with validation', function() {
        return redfish.render('templateName', null, {})
            .then(function(result) {
                expect(result).to.deep.equal(testObj);
            });
    });

    describe("getVendorNameById", function() {

        beforeEach('getVendorNameById beforeEach', function(){
            waterline.nodes.getNodeById.reset();
        });

        it('should get Cisco vendor name by identifier', function() {
            var id = "599337d6ff99ed24305bc58a";
            var sampleDataInfo = {
                "id": id,
                "identifiers": [
                    "1.1.1.0:sys/rack-unit-2"
                ]
            };

            waterline.nodes.getNodeById.resolves(sampleDataInfo);
            return redfish.getVendorNameById(id)
                .then(function(result){
                    expect(result.vendor).to.equal("Cisco");
                    expect(result.node).to.deep.equal(sampleDataInfo);
                    expect(waterline.nodes.getNodeById).to.be.calledOnce;
                    expect(waterline.nodes.getNodeById).to.be
                        .calledWith("599337d6ff99ed24305bc58a");
                });
        });

        it('should get Dell vendor name by identifier', function() {
            var id = "5bc58a";
            var sampleDataInfo = {
                "id": id,
                "identifiers": [
                    "1234ABC"
                ]
            };

            waterline.nodes.getNodeById.resolves(sampleDataInfo);
            return redfish.getVendorNameById(id)
                .then(function(result){
                    expect(result.vendor).to.equal("Dell");
                    expect(result.node).to.deep.equal(sampleDataInfo);
                    expect(waterline.nodes.getNodeById).to.be.calledOnce;
                    expect(waterline.nodes.getNodeById).to.be.calledWith("5bc58a");
                });
        });

        it('should get undefined vendor name by Identifier', function() {
            var id = "5bc58a";
            var sampleDataInfo = {
                "id": id,
                "identifiers": [
                    "52:54:be:ef:17:57"
                ]
            };

            waterline.nodes.getNodeById.resolves(sampleDataInfo);
            return redfish.getVendorNameById(id)
                .then(function(result){
                    expect(result.vendor).to.equal(undefined);
                    expect(result.node).to.deep.equal(sampleDataInfo);
                    expect(waterline.nodes.getNodeById).to.be.calledOnce;
                    expect(waterline.nodes.getNodeById).to.be.calledWith("5bc58a");
                });
        });

        it('should not get vendor name by Identifier', function() {
            var id = "testid";
            waterline.nodes.getNodeById.resolves(null);
            return redfish.getVendorNameById(id)
                .then(function(){
                    throw new Error("Test should be failed in this case.");
                }, function(error){
                    expect(error.message).to.equal('invalid node id.');
                });
        });
    });
});
