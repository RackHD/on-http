// Copyright © 2017 Dell Inc. or its subsidiaries.  All Rights Reserved.
/* jshint node:true */

'use strict';

describe('Redfish Cooling', function () {
    var redfish;
    var waterline;
    var Promise;
    var view;
    var fs;

    var coolingNode = {
        id: '59b842950fd2170100ecd04c',
        type  : 'cooling',
        name : 'AirHandlingUnit0',
        identifiers : [
            'AirHandlingUnit0',
            'http://172.20.0.4:8000/redfish/v1',
            'default',
            'AirHandlingUnit'
        ],
        relations : [ ],
        autoDiscover : false,
        tags : [ ],
        createdAt : '2017-09-12T20:24:53.146Z',
        updatedAt : '2017-09-13T19:25:09.632Z'
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

    var airHandlingUnit0Catalog =
        {
            "node": "59b842950fd2170100ecd04c",
            "source": "/redfish/v1/DCIMCooling/default/AirHandlingUnit/0",
            "data": {
                "@odata_context": "/redfish/v1/$metadata#AirHandlingUnit.AirHandlingUnit",
                "@odata_id": "/redfish/v1/DCIMCooling/default/AirHandlingUnit/0",
                "@odata_type": "#AirHandlingUnit.v1_0_0.AirHandlingUnit",
                "ID": "AirHandlingUnit0",
                "Name": "AirHandlingUnit0",
                "FirmwareRevision": "1.0.0",
                "DateOfManufacture": "01012017",
                "Manufacturer": "Manufacturer",
                "Model": "Model",
                "SerialNumber": "SerialNum",
                "PartNumber": "PartNum",
                "AssetTag": "AssetTag",
                "PhysicalLocation": "Location",
                "FanStart": "A",
                "FanStop": "A",
                "FanStatus": "A",
                "FanVSDControlPro": "A",
                "TemperatureSetPoint": 0,
                "RelativeHumiditySetPoint": 50,
                "SupplyFanSpeedSetPoint": 50,
                "ExhaustFanSpeedSetPoint": 50,
                "StaticPressureSetPoint": 10,
                "AHUStartStop": "Start",
                "ExhaustFanStartStop": "Start",
                "SupplyFanStartStop": "Start",
                "MinimumFanSpeed": 20,
                "MaximumFanSpeed": 80,
                "DehumidificationFanSpeed": 50,
                "HighHumidityAlarm": 60,
                "LowHumidityAlarm": 40,
                "UnitHiTempAlarmSetpoint": 10,
                "UnitLoTempAlarmSetpoint": -10,
                "HiSupplyAirStaticPressureAlarmSetpoint": 10,
                "HiReturnAirStaticPressureAlarmSetpoint": 50,
                "MinimumOADamperPosition": 30,
                "MaximumOADamperPosition": 70,
                "TemperatureControlDeadband": 0,
                "HumidityControlDeadband": 50,
                "FanControlDeadband": 50,
                "ResetAllAlarms": "No",
                "PauseUnit": "No",
                "HighWaterTempAlarmSetting": 20,
                "LowWaterTempAlarmSetting": 0,
                "UnitChilledWaterFlushCycle": "A",
                "FanRunTime": 2,
                "CoolingCapacity": 100,
                "HeatingOutput": 50,
                "CoolingOutput": 50,
                "UnitStatus": "On",
                "UnitOperationStatus": "On",
                "ExhaustFanStatus": "Off",
                "SupplyFanStatus": "On",
                "DehumidifyingStatus": "On",
                "ElectricPreheatStage": "A",
                "HumidifyingStatus": "On",
                "UnitCoolingStatus": "A",
                "UnitHeatingStatus": "B",
                "ChilledWaterValveCommand": "C",
                "FanAlarmOn": "True",
                "FanOverloadAlarmOn": "False",
                "AirflowLossAlarmOn": "False",
                "DirtyFilterAlarmOn": "False",
                "FanRunTimeAlarmOn": "False",
                "HighWaterTempAlarmOn": "True",
                "LowWaterTempAlarmOn": "False",
                "HiHumidityAlarmOn": "False",
                "LoHumidityAlarmOn": "True",
                "ReturnAirHighTempAlarmOn": "False",
                "ReturnAirLowTempAlarmOn": "True",
                "ReturnAirTempSensorAlarmOn": "False",
                "SupplyAirHighTempAlarmOn": "True",
                "SupplyAirLowTempAlarmOn": "False",
                "SupplyAirTempSensorAlarmOn": "True",
                "RemoteSensorAlarmOn": "False",
                "UnitMaintenanceDueAlarmOn": "True",
                "UnitOffAlarmOn": "True",
                "UnitOnAlarmOn": "False",
                "UnitPowerLossAlarmOn": "False",
                "UnitServiceRequestAlarmOn": "False",
                "UnitShutdownAlarmOn": "False",
                "UnitShutdownHighPowerAlarmOn": "False",
                "UnitShutdownPartialAlarmOn": "False",
                "UnitStandbyAlarmOn": "False",
                "UnitCommunicationLossAlarmOn": "False",
                "WaterUnderFloorAlarmOn": "False",
                "ManualOverrideAlarmOn": "False",
                "LossOfWaterFlowAlarmOn": "False",
                "SupplyAirSmokeDetectorAlarmOn": "False",
                "ReturnAirSmokeDetectorAlarmOn": "False",
                "Oem": {}
            }
        };

    it('/DCIMCooling should return a valid cooling root', function () {
        waterline.nodes.find.resolves([coolingNode]);
        return helper.request().get('/redfish/v1/DCIMCooling')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id']).to.equal(
                    '/redfish/v1/DCIMCooling/' + coolingNode.identifiers[2]);
            });
    });

    it('/DCIMCooling/{domain} should return a valid cooling domain', function () {
        waterline.nodes.find.resolves([coolingNode]);
        var domain = coolingNode.identifiers[2];
        var type = coolingNode.identifiers[3];
        return helper.request().get('/redfish/v1/DCIMCooling/' + domain)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.true;
                expect(res.body[type]['@odata.id']).to.equal(
                    '/redfish/v1/DCIMCooling/' + domain + '/' + type);
            });
    });

    it('/DCIMCooling/{domain}/{type} should return a valid cooling type', function () {
        waterline.nodes.find.resolves([coolingNode]);
        var domain = coolingNode.identifiers[2];
        var type = coolingNode.identifiers[3];
        return helper.request().get('/redfish/v1/DCIMCooling/' + domain + '/' + type)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.true;
                expect(res.body.Members[0]['@odata.id']).to.equal(
                    '/redfish/v1/DCIMCooling/' + domain + '/' + type +
                    '/' + coolingNode.identifiers[0] + '-' + coolingNode.id);
            });
    });

    it('/DCIMCooling/{domain}/{type}/{identifier} should return a valid cooling id', function () {
        waterline.nodes.needByIdentifier.resolves([coolingNode]);
        var domain = coolingNode.identifiers[2];
        var type = coolingNode.identifiers[3];
        redfish.getRedfishCatalog.resolves(airHandlingUnit0Catalog);

        return helper.request().get('/redfish/v1/DCIMCooling/' + domain + '/' +
            type +'/' + coolingNode.identifiers[0] + '-'+coolingNode.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.false;
                expect(res.body).to.deep.equal(airHandlingUnit0Catalog);
            });
    });
});
