// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Chassis Root', function () {
    var tv4;
    var validator;
    var waterline;
    var Promise;
    var taskProtocol;
    var fs;

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]).then(function () {
            validator = helper.injector.get('Http.Api.Services.Redfish');
            sinon.spy(validator, 'validate');
            sinon.spy(validator, 'render');

            waterline = helper.injector.get('Services.Waterline');
            sinon.stub(waterline.nodes);
            sinon.stub(waterline.catalogs);
            sinon.stub(waterline.workitems);

            Promise = helper.injector.get('Promise');

            taskProtocol = helper.injector.get('Protocol.Task');
            sinon.stub(taskProtocol);

            var nodeFs = helper.injector.get('fs');
            fs = Promise.promisifyAll(nodeFs);
        });

    });

    beforeEach('set up mocks', function () {
        tv4 = require('tv4');
        sinon.spy(tv4, "validate");

        validator.validate.reset();
        validator.render.reset();

        function resetStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].reset) {
                  obj[method].reset();
                }
            }).value();
        }

        resetStubs(waterline.nodes);
        resetStubs(waterline.catalogs);
        resetStubs(waterline.workitems);
        resetStubs(taskProtocol);
    });

    afterEach('tear down mocks', function () {
        tv4.validate.restore();
    });

    after('stop HTTP server', function () {
        validator.validate.restore();
        validator.render.restore();
        
        function restoreStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].restore) {
                  obj[method].restore();
                }
            }).value();
        }

        restoreStubs(waterline.nodes);
        restoreStubs(waterline.catalogs);
        restoreStubs(waterline.workitems);
        restoreStubs(taskProtocol);
        return helper.stopServer();
    });
    
    var enclosure = {
        id: '4567efgh4567efgh4567efgh',
        name: 'name',
        type: 'enclosure',
        relations: [
            {
                relationType: 'encloses',
                targets: [ 
                    '1234abcd1234abcd1234abcd' 
                ]
            }
        ]
    };

    var catalogData = {
        dmi: {
            chassis : {
                asset_tag: 'test',
                type: 'Rack Mount',
                manufacturer: 'test',
                product_name: 'test',
                serial_number: 'test',
                uuid: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'
            },
            system : {
                product_name: 'test'
            }
        }
    };

    it('should return a valid chassis root', function () {
        waterline.nodes.find.resolves([enclosure]);   
        return helper.request().get('/redfish/v1/Chassis')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(validator.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal('/redfish/v1/Chassis/' + enclosure.id);
            });
    });

    it('should return valid chassis and related targets', function() {
        waterline.nodes.needByIdentifier.resolves(Promise.resolve(enclosure));
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        waterline.workitems.findPollers.resolves([{
            config: { command: 'chassis' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            chassis: { power: "Unknown", uid: "Unknown"}
        }]);

        return helper.request().get('/redfish/v1/Chassis/' + enclosure.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(validator.render.called).to.be.true;
            });
    });
    
    it('should return a valid thermal object', function () {
        waterline.nodes.needByIdentifier.resolves(Promise.resolve(enclosure));
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sdr', inCondition: {} }
        }]);
        
        taskProtocol.requestPollerCache.resolves([{
            sdr: [{
                "Lower critical": "100.00",
                "Lower non-critical": "",
                "Nominal Reading": "",
                "Normal Maximum": "",
                "Normal Minimum": "",
                "Sensor Id": "Fan_1",
                "Sensor Reading": "1000",
                "Sensor Reading Units": "% RPM",
                "Sensor Type": "Fan",
                "Upper critical": "",
                "Upper non-critical": ""            
            },
            {
                "Lower critical": "",
                "Lower non-critical": "",
                "Nominal Reading": "",
                "Normal Maximum": "",
                "Normal Minimum": "",
                "Sensor Id": "Temp1",
                "Sensor Reading": "24",
                "Sensor Reading Units": "% degrees C",
                "Sensor Type": "Temperature",
                "Upper critical": "55.000",
                "Upper non-critical": "50.000"
            }]
        }]);
        
        return helper.request().get('/redfish/v1/Chassis/' + enclosure.id + '/Thermal')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(validator.render.called).to.be.true;
            });
    });
    
    it('should return a valid power object', function () {
        waterline.nodes.needByIdentifier.resolves(Promise.resolve(enclosure));
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sdr', inCondition: {} }
        }]);
        
        taskProtocol.requestPollerCache.resolves([{
            sdr: [{
                "Lower critical": "10.00",
                "Lower non-critical": "",
                "Nominal Reading": "",
                "Normal Maximum": "",
                "Normal Minimum": "",
                "Sensor Id": "Volt12V",
                "Sensor Reading": "12",
                "Sensor Reading Units": "% Volts",
                "Sensor Type": "Voltage",
                "Upper critical": "12.600",
                "Upper non-critical": ""       
            },
            {
                "Lower critical": "0.000",
                "Lower non-critical": "",
                "Nominal Reading": "",
                "Normal Maximum": "",
                "Normal Minimum": "",
                "Sensor Id": "Input",
                "Sensor Reading": "27",
                "Sensor Reading Units": "Watts",
                "Sensor Type": "Current",
                "Upper critical": "",
                "Upper non-critical": ""
            }]
        }]);
        
        return helper.request().get('/redfish/v1/Chassis/' + enclosure.id + '/Power')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(validator.render.called).to.be.true;
            });
    });
    
});