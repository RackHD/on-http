// Copyright 2016, EMC, Inc.

'use strict';

require('../../helper');

describe("Redfish Validator Service", function() {
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

    before(function() {
        helper.setupInjector([
            helper.require("/lib/services/redfish-validator-service"),
            dihelper.simpleWrapper(function() { arguments[1](); }, 'rimraf')
        ]);
        validator = helper.injector.get('Http.Api.Services.Redfish');
        template = helper.injector.get('Templates');
        _ = helper.injector.get('_');

        sinon.stub(template, "get").resolves({contents: JSON.stringify(testObj)});
    });

    beforeEach(function() {
        template.get.reset();
    });

    helper.after(function () {
        template.get.restore();
    });

    it('should have an empty missing', function(done) {
        expect(validator.missing()).to.be.empty;
        done();
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
        var schemaName = 'ComputerSystemCollection.json#/definitions/ComputerSystemCollection';
        return validator.validate(obj, schemaName)
            .then(function(result) {
                expect(result.error).have.length(2);
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

    it('should fail an invalid object with a valid schema', function() {
        var obj = _.merge({}, testObj, { extraParam: 'bad' });
        return validator.validate(obj)
            .then(function(result) {
                expect(result.error).to.have.length(1);
                expect(result.missing).to.be.empty;
                expect(result.valid).to.be.false;
            });
    });

    it('should get and render without validation', function() {
        return validator.get('templateName', {})
            .then(function(result) {
                expect(result).to.deep.equal(testObj);
            });
    });

    it('should get and render with validation', function() {
        return validator.render('templateName', null, {})
            .then(function(result) {
                expect(result).to.deep.equal(testObj);
            });
    });


});
