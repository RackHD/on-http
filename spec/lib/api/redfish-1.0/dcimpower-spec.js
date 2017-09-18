// Copyright © 2017 Dell Inc. or its subsidiaries.  All Rights Reserved.
/* jshint node:true */

'use strict';

describe('Redfish Power', function () {
    var redfish;
    var waterline;
    var Promise;
    var view;
    var fs;

    var powerNode = {
        id : '59b842950fd2170100ecd04a',
        type : 'power',
        name : 'PDU0',
        identifiers : [
            'PDU0',
            'http://172.20.0.3:8000/redfish/v1',
            'default',
            'PDU'
        ],
        relations : [ ],
        autoDiscover : false,
        tags : [ ],
        createdAt : '2017-09-12T20:24:53.085Z',
        updatedAt : '2017-09-13T19:25:09.562Z'
    };

    // Skip reading the entry from Mongo and return the entry directly
    function redirectGet(entry) {
        if( entry !== 'error.2.0.json') {
            entry = 'redfish-1.0/' + entry;
        }
        return fs.readFileAsync(__dirname + '/../../../../data/views/' + entry, 'utf-8')
            .then(function(contents) {
                return { contents: contents };
            });
    }

    helper.httpServerBefore();

    before(function () {
        view = helper.injector.get('Views');
        redfish = helper.injector.get('Http.Api.Services.Redfish');
        waterline = helper.injector.get('Services.Waterline');
        Promise = helper.injector.get('Promise');
        var nodeFs = helper.injector.get('fs');
        fs = Promise.promisifyAll(nodeFs);
    });

    beforeEach('set up mocks', function () {
        this.sandbox.stub(view, "get", redirectGet);
        this.sandbox.spy(redfish, 'render');
        this.sandbox.spy(redfish, 'validateSchema');
        this.sandbox.spy(redfish, 'handleError');
        this.sandbox.stub(redfish, 'getRedfishCatalog');
        this.sandbox.stub(waterline.nodes);
        this.sandbox.stub(waterline.catalogs);

        waterline.nodes.needByIdentifier.resolves();
        waterline.nodes.find.resolves();
    });

    helper.httpServerAfter();

    var PduCatalog = {
        "@odata.context": "/redfish/v1/$metadata#PDU.PDU",
        "@odata.id": "/redfish/v1/DCIMPower/default/PDU/0",
        "@odata.type": "#PDU.v1_0_0.PDU",
        "ID": "PDU0",
        "Name": "PDU0",
        "FirmwareRevision": "1.0.0",
        "DateOfManufacture": "01012017",
        "Manufacturer": "Manufacturer",
        "Model": "Model",
        "SerialNumber": "SerialNum",
        "PartNumber": "PartNum",
        "AssetTag": "AssetTag",
        "PhysicalLocation": "Location",
        "InputSourceStatus": 0,
        "OutputSourceStatus": 0,
        "AcInputSelectOverride": "A",
        "AcInput": [
            {
                "@odata.id": "/redfish/v1/DCIMPower/default/PDU/0/#AcInput/0",
                "RealPower": 10,
                "Energy": 10,
                "RMSUnderOverVoltage": 100,
                "Sensors": {
                    "@odata.id": "/redfish/v1/DCIMPower/default/PDU/0/#AcInput/0/Sensors",
                    "@odata.type": "SensorCollection.SensorCollection",
                    "@odata.context": "/redfish/v1/$metadata#SensorCollection.SensorCollection",
                    "Name": "SensorCollection",
                    "Members": [
                        {
                            "@odata.id": "/redfish/v1/DCIMPower/default/PDU/0/Sensors/AcInput0Voltage0",
                            "@odata.type": "Sensor.v1_0_0.Sensor",
                            "@odata.context": "/redfish/v1/$metadata#Sensor.Sensor",
                            "MemberId": "0",
                            "SensorType": "Voltage",
                            "Name": "AC Input 1 - RMS Voltage Sensor",
                            "SensorNumber": 0,
                            "Status": {
                                "State": "Enabled",
                                "Health": "OK"
                            },
                            "SensorReading": 12,
                            "UpperThresholdNonCritical": 12.5,
                            "UpperThresholdCritical": 13,
                            "UpperThresholdFatal": 15,
                            "LowerThresholdNonCritical": 11.5,
                            "LowerThresholdCritical": 11,
                            "LowerThresholdFatal": 10,
                            "MinReadingRange": 0,
                            "MaxReadingRange": 20,
                            "PhysicalContext": "AC Input 1",
                            "Oem": {}
                        },
                        {
                            "@odata.id": "/redfish/v1/DCIMPower/default/PDU/0/Sensors/AcInput0Current0",
                            "@odata.type": "Sensor.v1_0_0.Sensor",
                            "@odata.context": "/redfish/v1/$metadata#Sensor.Sensor",
                            "MemberId": "1",
                            "SensorType": "Current",
                            "Name": "AC Input 1 - RMS Current Sensor",
                            "SensorNumber": 1,
                            "Status": {
                                "State": "Enabled",
                                "Health": "OK"
                            },
                            "SensorReading": 12,
                            "UpperThresholdNonCritical": 12.5,
                            "UpperThresholdCritical": 13,
                            "UpperThresholdFatal": 15,
                            "LowerThresholdNonCritical": 11.5,
                            "LowerThresholdCritical": 11,
                            "LowerThresholdFatal": 10,
                            "MinReadingRange": 0,
                            "MaxReadingRange": 20,
                            "PhysicalContext": "AC Input 1",
                            "Oem": {}
                        },
                        {
                            "@odata.id": "/redfish/v1/DCIMPower/default/PDU/0/Sensors/AcInput0Frequency0",
                            "@odata.type": "Sensor.v1_0_0.Sensor",
                            "@odata.context": "/redfish/v1/$metadata#Sensor.Sensor",
                            "MemberId": "2",
                            "SensorType": "Frequency",
                            "Name": "AC Input 1 - Frequency Sensor",
                            "SensorNumber": 2,
                            "Status": {
                                "State": "Enabled",
                                "Health": "OK"
                            },
                            "SensorReading": 12,
                            "UpperThresholdNonCritical": 12.5,
                            "UpperThresholdCritical": 13,
                            "UpperThresholdFatal": 15,
                            "LowerThresholdNonCritical": 11.5,
                            "LowerThresholdCritical": 11,
                            "LowerThresholdFatal": 10,
                            "MinReadingRange": 0,
                            "MaxReadingRange": 20,
                            "PhysicalContext": "AC Input 1",
                            "Oem": {}
                        }
                    ]
                }
            }
        ]
    };

    it('/DCIMPower should return a valid power root', function () {
        waterline.nodes.find.resolves([powerNode]);
        return helper.request().get('/redfish/v1/DCIMPower')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id']).to.equal(
                    '/redfish/v1/DCIMPower/' + powerNode.identifiers[2]);
            });
    });

    it('/DCIMPower/{domain} should return a valid power domain', function () {
        waterline.nodes.find.resolves([powerNode]);
        var domain = powerNode.identifiers[2];
        var type = powerNode.identifiers[3];
        return helper.request().get('/redfish/v1/DCIMPower/' + domain)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.true;
                expect(res.body[type]['@odata.id']).to.equal(
                    '/redfish/v1/DCIMPower/' + domain + '/' + type);
            });
    });

    it('/DCIMPower/{domain}/{type} should return a valid power type', function () {
        waterline.nodes.find.resolves([powerNode]);
        var domain = powerNode.identifiers[2];
        var type = powerNode.identifiers[3];
        return helper.request().get('/redfish/v1/DCIMPower/' + domain + '/' + type)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.true;
                expect(res.body.Members[0]['@odata.id']).to.equal(
                    '/redfish/v1/DCIMPower/' + domain + '/' + type +
                    '/' + powerNode.identifiers[0] + '-' + powerNode.id);
            });
    });

    it('/DCIMPower/{domain}/{type}/{identifier} should return a valid power id', function () {
        waterline.nodes.needByIdentifier.resolves([powerNode]);
        var domain = powerNode.identifiers[2];
        var type = powerNode.identifiers[3];
        redfish.getRedfishCatalog.resolves(PduCatalog);

        return helper.request().get('/redfish/v1/DCIMPower/' + domain + '/' +
            type +'/' + powerNode.identifiers[0] + '-'+powerNode.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.false;
                expect(res.body).to.deep.equal(PduCatalog);
            });
    });
});
