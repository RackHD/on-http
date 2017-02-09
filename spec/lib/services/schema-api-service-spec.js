// Copyright 2016, EMC, Inc.

'use strict';

require('../../helper');

describe("Schema API Service", function() {
    var validator;
    var template;
    var _;
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
    var testObjBad = {
        '@odata.type': '#ComputerSystem.v1_3_0.ComputerSystem'
    };

    before(function() {
        helper.setupInjector([
            helper.require("/lib/services/schema-api-service"),
            dihelper.simpleWrapper(function() { arguments[1](); }, 'rimraf')
        ]);
        validator = helper.injector.get('Http.Api.Services.Schema');
        template = helper.injector.get('Templates');
        _ = helper.injector.get('_');

        sinon.stub(template, "get").resolves({contents: JSON.stringify(testObj)});

        var path = helper.injector.get('path');
        return validator.addNamespace(path.resolve(__dirname, '../../../static/DSP8010_2016.3/json-schema'),
            'http://redfish.dmtf.org/schemas/v1/');
    });

    beforeEach(function() {
        template.get.reset();
    });

    helper.after(function () {
        template.get.restore();
    });

    it('should validate an object against a valid schema', function() {
        var schemaName = 'ComputerSystemCollection.json#/definitions/ComputerSystemCollection';
        return validator.validate(testObj, schemaName)
            .then(function(result) {
                expect(result.error).to.be.empty;
                expect(result.missing).to.be.empty;
                expect(result.valid).to.be.true;
            });
    });

    it('should fail an invalid object with a valid schema', function() {
        var obj = _.merge({}, testObj, { extraParam: 'bad' });
        var schemaName = 'ComputerSystem.v1_3_0.json#/definitions/ComputerSystem';
        return validator.validate(obj, schemaName)
            .then(function(result) {
                expect(result.error).have.length(1);
                expect(result.missing).to.be.empty;
                expect(result.valid).to.be.false;
            });
    });

    it('should validate an object', function() {
        return validator.validate(testObj)
            .then(function(result) {
                expect(result.error).to.be.empty;
                expect(result.missing).to.be.empty;
                expect(result.valid).to.be.true;
            });
    });

    it('should fail an invalid object', function() {
        var obj = _.merge({}, testObj, { extraParam: 'bad' });
        return validator.validate(testObjBad)
            .then(function(result) {
                expect(result.error).to.have.length(1);
                expect(result.missing).to.be.empty;
                expect(result.valid).to.be.false;
            });
    });

});
