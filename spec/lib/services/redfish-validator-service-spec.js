// Copyright 2016, EMC, Inc.

'use strict';

require('../../helper');

describe("Redfish Validator Service", function() {
    var redfish;
    var view;
    var _;
    var env;
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
            helper.require("/lib/services/redfish-validator-service"),
            helper.require("/lib/api/view/view"),
            dihelper.simpleWrapper(function() { arguments[1](); }, 'rimraf')
        ]);
        redfish = helper.injector.get('Http.Api.Services.Redfish');
        view = helper.injector.get('Views');
        _ = helper.injector.get('_');

        env = helper.injector.get('Services.Environment');
        sinon.stub(env, "get").resolves();

        sinon.stub(view, "get").resolves({contents: JSON.stringify(testObj)});
    });

    beforeEach(function() {
        view.get.reset();
    });

    helper.after(function () {
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


});
