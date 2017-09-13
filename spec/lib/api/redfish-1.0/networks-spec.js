// Copyright © 2017 Dell Inc. or its subsidiaries.  All Rights Reserved.
/* jshint node:true */

'use strict';

describe('Redfish Networks', function () {
    var redfish;
    var waterline;
    var Promise;
    var view;
    var fs;
    var wsman;
    var systems;

    var dellNodeObm ={
        id: "DELL574dcd5794ab6e2506fd107a",
        node: "DELLabcd1234abcd1234abcd",
        service: 'dell-wsman-obm-service',
        config: {
            host: '1.2.3.4',
            user: 'myuser',
            password: 'mypass'
        }
    };

    var dellNode = {
        autoDiscover: false,
        id: 'DELLabcd1234abcd1234abcd',
        name: 'dell node',
        identifiers: ['ABCDEFG'],
        tags: [],
        obms: [{ obm: '/api/2.0/obms/DELL574dcd5794ab6e2506fd107a'}],
        type: 'compute',
        relations: [
            {
                relationType: 'enclosedBy',
                targets: [ '4567efgh4567efgh4567efgh' ]
            }
        ]
    };
    var NetworksNode = {
        id : '59b842950fd2170100ecd05c',
        type : 'switch',
        name : 'Ethernet Switch',
        identifiers : [
            'SW_15',
            'http://172.20.0.5:8000/redfish/v1/NetworkDevices/SW_15'
        ],
        relations : [
            {
                relationType : 'enclosedBy',
                targets : [
                    '59b842950fd2170100ecd05a'
                ]
            }
        ],
        autoDiscover : false,
        tags : [ ],
        createdAt : '2017-09-12T20:24:53.401Z',
        updatedAt : '2017-09-13T19:25:09.752Z'
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
        wsman = helper.injector.get('Http.Services.Wsman');
        systems = require('../../../../lib/api/redfish-1.0/systems.js');
    });

    beforeEach('set up mocks', function () {
        this.sandbox.stub(view, 'get', redirectGet);
        //this.sandbox.spy(redfish, 'render');
        this.sandbox.spy(redfish, 'validateSchema');
        this.sandbox.spy(redfish, 'handleError');
        this.sandbox.stub(redfish, 'getRedfishNetworkCatalog');
        this.sandbox.stub(waterline.nodes);
        this.sandbox.stub(waterline.catalogs);
        this.sandbox.stub(wsman, 'isDellSystem');
        this.sandbox.stub(systems, 'dataFactory');

        waterline.nodes.needByIdentifier.resolves();
        waterline.nodes.find.resolves();
        wsman.isDellSystem.resolves();
    });

    afterEach('restore sanbox', function(){
        this.sandbox.restore();
    });
    helper.httpServerAfter();

    var networkSwitchCatalog =
        {
            "node": "59b842950fd2170100ecd05c",
            "source": "/redfish/v1/NetworkDevices/SW_15",
            "data": {
                "@Redfish_Copyright": "Copyright 2014-2017 Distributed Management Task Force, Inc. (DMTF). All rights reserved.",
                "@odata_context": "/redfish/v1/$metadata#NetworkDevice.NetworkDevice",
                "@odata_type": "#NetworkDevice.v1_0_0.NetworkDevice",
                "@odata_id": "/redfish/v1/NetworkDevices/SW_15",
                "Id": "SW_15",
                "Name": "Ethernet Switch",
                "NetworkDeviceType": "BaselineEthernetSwitch",
                "AssetTag": "xxx",
                "Manufacturer": "Manufacturer Name",
                "Model": "Model Name",
                "SKU": "67B",
                "SerialNumber": "2M220100SL",
                "PartNumber": "76-88883",
                "IndicatorLED": "Off",
                "FirmwareVersion": "1.2.4",
                "Status": {
                    "State": "Enabled",
                    "Health": "OK",
                    "HealthRollup": "OK"
                },
                "LogServices": {
                    "@odata_id": "/redfish/v1/NetworkDevices/SW_15/LogServices"
                },
                "IetfInterfaces": {
                    "@odata_id": "/redfish/v1/NetworkDevices/SW_15/ietf_interfaces"
                },
                "IetfSystem": {
                    "@odata_id": "/redfish/v1/NetworkDevices/SW_15/ietf_system"
                },
                "Links": {
                    "Chassis": [
                        {
                            "@odata_id": "/redfish/v1/Chassis/SW_15"
                        }
                    ],
                    "ManagedBy": [
                        {
                            "@odata_id": "/redfish/v1/Managers/EthernetSwitchManager"
                        }
                    ]
                },
                "Actions": {
                    "#NetworkDevice_Reset": {
                        "target": "/redfish/v1/NetworkDevices/SW_15/Actions/NetworkDevice.Reset",
                        "@Redfish_ActionInfo": "/redfish/v1/NetworkDevices/SW_15/ResetActionInfo"
                    }
                }
            },
            "createdAt": "2017-09-13T19:25:10.600Z",
            "updatedAt": "2017-09-13T19:25:10.600Z",
            "id": "38480ce4-77ee-42f3-8282-4126d8594003"
        };

    it('/NetworkDevices should return a valid networks root', function () {
        waterline.nodes.find.resolves([NetworksNode]);
        this.sandbox.spy(redfish, 'render');
        return helper.request().get('/redfish/v1/NetworkDevices')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id']).to.equal(
                    '/redfish/v1/NetworkDevices/' + NetworksNode.identifiers[0] + '-' + NetworksNode.id );
            });
    });

    it('/NetworkDevices/{identifier} should return a valid network device id for Redfish endpoints', function () {
        waterline.nodes.find.resolves([NetworksNode]);
        this.sandbox.spy(redfish, 'render');
        redfish.getRedfishNetworkCatalog.resolves(networkSwitchCatalog);
        wsman.isDellSystem.resolves({node: NetworksNode, isDell: false, isRedfishCapable: false});
        return helper.request().get('/redfish/v1/NetworkDevices/' +
            NetworksNode.identifiers[0] + '-' + NetworksNode.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.false;

            });
    });

    it('/NetworkDevices/{identifier} should return a valid network device id for Dell endpoints', function () {
        this.sandbox.stub(redfish, 'render');
        waterline.nodes.find.resolves([NetworksNode]);
        redfish.getRedfishNetworkCatalog.resolves(networkSwitchCatalog);
        wsman.isDellSystem.resolves({node: dellNode, isDell: true, isRedfishCapable: false});
        return helper.request().get('/redfish/v1/NetworkDevices/' +
            NetworksNode.identifiers[0] + '-' + NetworksNode.id)
            .expect(200)
            .expect(function(res) {
                expect(systems.dataFactory).to.be.called.once;
                expect(redfish.render.called).to.be.true;

            });
    });

    it('/NetworkDevices/{identifier} should return a valid network device id for Quanta endpoints', function () {
        waterline.nodes.find.resolves([NetworksNode]);
        this.sandbox.stub(redfish, 'render');
        redfish.getRedfishNetworkCatalog.resolves(networkSwitchCatalog);
        wsman.isDellSystem.resolves({node: NetworksNode, isDell: false, isRedfishCapable: false});
        return helper.request().get('/redfish/v1/NetworkDevices/' + NetworksNode.id)
            .expect(200)
            .expect(function(res) {
                expect(systems.dataFactory).to.be.called.once;
                expect(redfish.render.called).to.be.true;
            });
    });

});
