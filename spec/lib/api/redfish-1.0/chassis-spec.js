// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Chassis Root', function () {
    var tv4;
    var redfish;
    var waterline;
    var Promise;
    var taskProtocol;
    var fs;
    var validator;
    var env;
    var nodeApi;
    var Errors;
    var enclosure = {
        id: '4567efgh4567efgh4567efgh',
        identifiers: ['ident'],
        name: 'Enclosure Node ABCDEFG',
        type: 'enclosure',
        obms: [],
        relations: [
            {
                relationType: 'encloses',
                targets: [
                    '1234abcd1234abcd1234abcd'
                ]
            }
        ]
    };
    var system = {
        id: '1234abcd1234abcd1234abcd',
        identifiers: ['ident'],
        name: 'name',
        type: 'compute',
        obmSettings: [
            {
                service: 'ipmi-obm-service',
                config: {
                    host: '1.2.3.4',
                    user: 'myuser',
                    password: 'mypass'
                }
            }
        ],
        relations: [
            {
                relationType: 'enclosedBy',
                targets: [ '4567efgh4567efgh4567efgh' ]
            }
        ]
    };

    var redfishNode =     {
        autoDiscover: false,
        catalogs: "/api/2.0/nodes/5a09dadfcd6a2a01006f4f87/catalogs",
        ibms: [],
        id: "5a09dadfcd6a2a01006f4f87",
        identifiers: [
            "System.Embedded.1",
            "http://172.23.0.1:8000/redfish/v1/Systems/System.Embedded.1",
            "NNRZST2-CN747517150043"
        ],
        name: "System",
        obms: [
            {
                "ref": "/api/2.0/obms/5a09dadfcd6a2a01006f4f88",
                "service": "redfish-obm-service"
            }
        ],
        pollers: "/api/2.0/nodes/5a09dadfcd6a2a01006f4f87/pollers",
        relations: [
            {
                info: null,
                relationType: "managedBy",
                targets: [
                    "5a09dadfcd6a2a01006f4f89"
                ]
            }
        ],
        tags: "/api/2.0/nodes/5a09dadfcd6a2a01006f4f87/tags",
        type: "redfish",
        workflows: "/api/2.0/nodes/5a09dadfcd6a2a01006f4f87/workflows"
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

    var ucsEnclosure = {
        id: 'aaaabbbbcccc111122223333',
        identifiers: ['10.240.19.70:sys/rack-unit-2'],
        name: 'sys/chassis-1',
        type: 'enclosure',
        obms: [],
        relations: [
            {
                relationType: 'encloses',
                targets: [
                    'ddddeeeeffff444455556666'
                ]
            }
        ]
    };

    var ucsSystem = {
        id: 'ddddeeeeffff444455556666',
        identifiers: ['10.240.19.70:sys/rack-unit-2'],
        name: 'name',
        type: 'compute',
        obmSettings: [
            {
                service: 'ucs-obm-service',
                config: {
                    uri: 'https://localhost:7080',
                    host: 'localhost',
                    root: '',
                    port: '7080',
                    protocol: 'https',
                    ucsUser: 'ucspe',
                    ucsHost: '1.2.3.4',
                    verifySSL: false,
                    dn: 'sys/chassis-1'
                }
            }
        ],
        relations: [
            {
                relationType: 'enclosedBy',
                targets: [ 'aaaabbbbcccc111122223333' ]
            }
        ]
    };

    var ucsCatalogData = {
        vendor: "Cisco",
        serial: "UCS_SN234",
        rn: "chassis-1",
        model: "UCS Chassis",
        power: "ok",
        oper_state: "on"
    };

    helper.httpServerBefore();

    before(function () {
        redfish = helper.injector.get('Http.Api.Services.Redfish');
        validator = helper.injector.get('Http.Api.Services.Schema');
        waterline = helper.injector.get('Services.Waterline');
        Promise = helper.injector.get('Promise');
        Errors = helper.injector.get('Errors');
        taskProtocol = helper.injector.get('Protocol.Task');
        env = helper.injector.get('Services.Environment');
        var nodeFs = helper.injector.get('fs');
        fs = Promise.promisifyAll(nodeFs);
        nodeApi = helper.injector.get('Http.Services.Api.Nodes');
        tv4 = require('tv4');
    });

    beforeEach('set up mocks', function () {
        this.sandbox.spy(tv4, "validate");
        this.sandbox.spy(redfish, 'render');
        this.sandbox.spy(redfish, 'handleError');
        this.sandbox.spy(validator, 'validate');
        this.sandbox.stub(waterline.nodes);
        this.sandbox.stub(waterline.catalogs);
        waterline.nodes.findByIdentifier.withArgs('4567efgh4567efgh4567efgh').resolves(enclosure);
        waterline.nodes.findByIdentifier.withArgs('1234abcd1234abcd1234abcd').resolves(system);
        waterline.nodes.findByIdentifier.withArgs('aaaabbbbcccc111122223333').resolves(ucsEnclosure);
        waterline.nodes.findByIdentifier.withArgs('ddddeeeeffff444455556666').resolves(ucsSystem);
        waterline.nodes.findByIdentifier.withArgs(redfishNode.id).resolves(redfishNode);
        waterline.nodes.findByIdentifier.resolves();
        waterline.nodes.needByIdentifier.withArgs('4567efgh4567efgh4567efgh').resolves(enclosure);
        waterline.nodes.needByIdentifier.withArgs('1234abcd1234abcd1234abcd').resolves(system);
        waterline.nodes.needByIdentifier.withArgs('aaaabbbbcccc111122223333').resolves(ucsEnclosure);
        waterline.nodes.needByIdentifier.withArgs('ddddeeeeffff444455556666').resolves(ucsSystem);
        waterline.nodes.needByIdentifier.withArgs(redfishNode.id).resolves(redfishNode);
        waterline.nodes.needByIdentifier.resolves();
        waterline.nodes.getNodeById.withArgs('4567efgh4567efgh4567efgh').resolves(enclosure);
        waterline.nodes.getNodeById.withArgs('1234abcd1234abcd1234abcd').resolves(system);
        waterline.nodes.getNodeById.withArgs('aaaabbbbcccc111122223333').resolves(ucsEnclosure);
        waterline.nodes.getNodeById.withArgs('ddddeeeeffff444455556666').resolves(ucsSystem);
        waterline.nodes.getNodeById.withArgs(redfishNode.id).resolves(redfishNode);
        waterline.nodes.getNodeById.resolves();
        this.sandbox.stub(taskProtocol);
        this.sandbox.stub(env, "get").resolves({});
        this.sandbox.stub(nodeApi, "getAllNodes");
        //this.sandbox.stub(nodeApi, "getNodeCatalogSourceById");
        this.sandbox.stub(nodeApi, "getPollersByNodeId");
        nodeApi.getAllNodes.resolves([enclosure]);
        waterline.catalogs.findLatestCatalogOfSource.rejects(new Errors.NotFoundError());
    });

    helper.httpServerAfter();

    it('should return a valid chassis root', function () {
        nodeApi.getAllNodes.resolves([enclosure]);
        return helper.request().get('/redfish/v1/Chassis')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal('/redfish/v1/Chassis/' + enclosure.id);
            });
    });

    it('should return a valid UCS chassis root', function () {
        nodeApi.getAllNodes.resolves([ucsEnclosure]);
        return helper.request().get('/redfish/v1/Chassis')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal('/redfish/v1/Chassis/' + ucsEnclosure.id);
            });
    });

    it('should return a valid Redfish chassis root', function () {
        nodeApi.getAllNodes.resolves([redfishNode]);
        return helper.request().get('/redfish/v1/Chassis')
            .expect(200)
            .expect('Content-Type', /^application\/json/)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal('/redfish/v1/Chassis/' + redfishNode.identifiers[2]);
            });
    });

    it('should return valid chassis and related targets', function () {
        waterline.catalogs.findLatestCatalogOfSource.resolves({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        });

        nodeApi.getPollersByNodeId.resolves([{
            config: { command: 'chassis' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            chassis: { power: "Unknown", uid: "Reserved"}
        }]);

        return helper.request().get('/redfish/v1/Chassis/' + enclosure.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return valid redfish chassis and related targets', function () {
        waterline.catalogs.findLatestCatalogOfSource.resolves({
            node: redfishNode.id,
            source: 'dummysource',
            data: {}
        });


        return helper.request().get('/redfish/v1/Chassis/' + redfishNode.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200);
    });

    it('should return 501 redfish chassis with no catalog', function () {
        waterline.catalogs.findLatestCatalogOfSource.rejects(new Errors.NotFoundError());

        return helper.request().get('/redfish/v1/Chassis/' + redfishNode.id)
            .expect('Content-Type', /^application\/json/)
            .expect(501);
    });

    it('should 404 an invalid chassis object', function () {
        //redfish.getVendorNameById.rejects(new Errors.NotFoundError('Not Found'));
        return helper.request().get('/redfish/v1/Chassis/ABCDEFG')
        .expect('Content-Type', /^application\/json/)
        .expect(404)
        .expect(function() {
             expect(redfish.render.called).to.be.true;
        });
    });


    describe('/redfish/v1/Chassis/<identifier>/Thermal', function () {
        var ucsPowerThermalPoller;
        var ucsFanPoller;


        before('/redfish/v1/Chassis/<identifier>/Thermal/', function() {
            ucsFanPoller = {
                "config": {
                    "command": "ucs.fan"
                },
                "failureCount": 18,
                "id": "59bafde8dbbbc7a378140554",
                "lastFinished": "2017-09-15T10:30:52.042Z",
                "lastStarted": "2017-09-15T10:30:31.651Z",
                "node": "/api/2.0/nodes/59bafdcadbbbc7a378140544",
                "paused": false,
                "pollInterval": 30000,
                "type": "ucs"
            };

            ucsPowerThermalPoller = {
                "config": {
                    "command": "ucs.powerthermal"
                },
                "failureCount": 18,
                "id": "59bafde8dbbbc7a37814054c",
                "lastFinished": "2017-09-15T10:31:12.057Z",
                "lastStarted": "2017-09-15T10:30:51.718Z",
                "node": "/api/2.0/nodes/59bafdcadbbbc7a378140542",
                "paused": false,
                "pollInterval": 30000,
                "type": "ucs"
            };
        });

        it('should return a valid UCS thermal object', function() {
            nodeApi.getPollersByNodeId.resolves([ucsPowerThermalPoller, ucsFanPoller]);
            //redfish.getVendorNameById.resolves({vendor: 'Cisco', node: ucsSystem});
            taskProtocol.requestPollerCache.withArgs('59bafde8dbbbc7a37814054c', { latestOnly: true })
            .resolves(
                [
                    {
                        "config": {
                            "command": "ucs.powerthermal"
                        },
                        "node": "59baadd5657662df52a37a0d",
                        "result": {
                            "computeMbTempStats": [
                                {
                                    "dn": "sys/chassis-3/blade-1/board/temp-stats",
                                    "fm_temp_sen_io": "20.000000",
                                    "fm_temp_sen_io_rear": "10.000000",
                                    "fm_temp_sen_io_rear_avg": "15.000000"
                                }
                            ],
                            "equipmentChassisStats":[]
                        }
                    }
                ]
            );

            taskProtocol.requestPollerCache.withArgs('59bafde8dbbbc7a378140554', { latestOnly: true })
            .resolves([
                {
                    "config": {
                        "command": "ucs.fan"
                    },
                    "node": "59baadd3657662df52a37a09",
                    "result": {
                        "equipmentFanStats": [
                            {
                              "dn": "sys/rack-unit-2/fan-module-1-5/fan-1/stats",
                              "intervals": "58982460",
                              "speed": "3317",
                            }
                        ]
                    }
                }]);

            return helper.request().get('/redfish/v1/Chassis/' + ucsSystem.id + '/Thermal')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.render.called).to.be.true;
                });
        });

        it('should 404 an invalid UCS chassis object', function() {
            //redfish.getVendorNameById.resolves({vendor: 'Cisco', node: ucsSystem});
            nodeApi.getPollersByNodeId.rejects('ERROR');
            return helper.request().get('/redfish/v1/Chassis/' + ucsSystem.id + '/Thermal')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function() {
                    expect(redfish.handleError.called).to.be.true;
                });
        });

        it('should return valid UCS chassis and related targets', function () {
            nodeApi.getPollersByNodeId.resolves([]);
            //redfish.getVendorNameById.resolves({vendor: 'Other', node: ucsEnclosure});
            waterline.catalogs.findLatestCatalogOfSource.onCall(0).returns(Promise.reject(new Errors.NotFoundError('geoff not found')));
            waterline.catalogs.findLatestCatalogOfSource.returns(Promise.resolve({
                node: '1234abcd1234abcd1234abcd',
                source: 'dummysource',
                data: ucsCatalogData
            }));

            return helper.request().get('/redfish/v1/Chassis/' + ucsEnclosure.id)
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.render.called).to.be.true;
                });
        });


        it('should return a valid thermal object', function () {
            //redfish.getVendorNameById.resolves({vendor: 'Other', node: enclosure});
            nodeApi.getPollersByNodeId.resolves([{
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
                    "Upper non-critical": "",
                    "entityId": "6.2"
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
                    "Upper non-critical": "50.000",
                    "entityId": "6.2"
                }]
            }]);

            return helper.request().get('/redfish/v1/Chassis/' + enclosure.id + '/Thermal')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.render.called).to.be.true;
                });
        });

        it('should return valid redfish thermal object', function () {
            waterline.catalogs.findLatestCatalogOfSource.resolves({
                node: redfishNode.id,
                source: 'dummysource',
                data: {}
            });


            return helper.request().get('/redfish/v1/Chassis/' + redfishNode.id + '/Thermal')
                .expect('Content-Type', /^application\/json/)
                .expect(200);
        });

        it('should return 501 redfish thermal with no catalog', function () {
            waterline.catalogs.findLatestCatalogOfSource.rejects(new Errors.NotFoundError());

            return helper.request().get('/redfish/v1/Chassis/' + redfishNode.id + '/Thermal')
                .expect('Content-Type', /^application\/json/)
                .expect(501);
        });

        it('should return a valid power object', function () {
            //redfish.getVendorNameById.resolves({vendor: 'Other', node: enclosure});
            nodeApi.getPollersByNodeId.resolves([{
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
                    "Upper non-critical": "",
                    "entityId": "6.2"
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
                    "Upper non-critical": "",
                    "entityId": "6.2"
                }]
            }]);

            return helper.request().get('/redfish/v1/Chassis/' + enclosure.id + '/Power')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.render.called).to.be.true;
                });
        });

        it('should return valid redfish power object', function () {
            waterline.catalogs.findLatestCatalogOfSource.resolves({
                node: redfishNode.id,
                source: 'dummysource',
                data: {}
            });


            return helper.request().get('/redfish/v1/Chassis/' + redfishNode.id + '/Power')
                .expect('Content-Type', /^application\/json/)
                .expect(200);
        });

        it('should return 501 redfish power with no catalog', function () {
            waterline.catalogs.findLatestCatalogOfSource.rejects(new Errors.NotFoundError());

            return helper.request().get('/redfish/v1/Chassis/' + redfishNode.id + '/Power')
                .expect('Content-Type', /^application\/json/)
                .expect(501);
        });


        it('should 404 an invalid chassis thermal object', function() {
            //redfish.getVendorNameById.rejects(new Errors.NotFoundError('Not Found'));
            return helper.request().get('/redfish/v1/Chassis/ABCDEFG/Thermal')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .expect(function() {
                    expect(redfish.render.called).to.be.true;
                });
        });
    });

    describe('/redfish/v1/Chassis/<identifier>/Power', function () {
        var ucsPowerThermalPoller;
        var ucsPsuPoller;


        before('/redfish/v1/Chassis/<identifier>/Power/', function() {
            ucsPowerThermalPoller = {
                "config": {
                    "command": "ucs.powerthermal"
                },
                "failureCount": 18,
                "id": "59bafde8dbbbc7a37814054c",
                "node": "/api/2.0/nodes/59bafdcadbbbc7a378140542",
                "type": "ucs"
            };

            ucsPsuPoller = {
                "config": {
                    "command": "ucs.psu"
                },
                "failureCount": 18,
                "id": "59bafde8dbbbc7a37811111c",
                "node": "/api/2.0/nodes/59bafde8dbbbc7a37811111c",
                "type": "ucs"
            };
        });

        it('should return a valid UCS power object', function() {
            nodeApi.getPollersByNodeId.resolves([ucsPowerThermalPoller, ucsPsuPoller]);
            //redfish.getVendorNameById.resolves({vendor: 'Cisco', node: ucsSystem});
            taskProtocol.requestPollerCache.withArgs('59bafde8dbbbc7a37814054c', {latestOnly: true})
            .resolves([
                {
                    "config": {
                        "command": 'ucs.powerthermal'
                    },
                    "node": "59bafde8dbbbc7a37814054c",
                    "result": {
                        "computeMbPowerStats": [
                            {
                                "dn": "sys/chassis-3/blade-1/board/power-stats",
                                "input_voltage": "110.000000"
                            }
                        ]
                    }
                }
            ]);
            taskProtocol.requestPollerCache.withArgs('59bafde8dbbbc7a37811111c', { latestOnly: true })
            .resolves([
               {
                   "config": {
                       "command": "ucs.psu"
                   },
                   "node": "59bafde8dbbbc7a37811111c",
                   "result": {
                       "equipmentPsuStats": [
                           {
                               "dn" : "sys/chassis-5/psu-3",
                               "psu_wattage" : "110"
                           }
                       ]
                   }
               }
            ]);

            return helper.request().get('/redfish/v1/Chassis/' + ucsSystem.id + '/Power')
               .expect('Content-Type', /^application\/json/)
               .expect(200)
               .expect(function() {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.render.called).to.be.true;
               });

        });

        it('should 404 an invalid UCS power object', function() {
            //redfish.getVendorNameById.resolves({vendor: 'Cisco', node: ucsSystem});
            nodeApi.getPollersByNodeId.rejects('ERROR');
            return helper.request().get('/redfish/v1/Chassis/' + ucsSystem.id + '/Power')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect(function() {
                    expect(redfish.handleError.called).to.be.true;
                });
        });

        it('should return a valid non-ucs power object', function () {
            //redfish.getVendorNameById.resolves({vendor: 'Other', node: enclosure});
            nodeApi.getPollersByNodeId.resolves([{
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
                    "Upper non-critical": "",
                    "entityId": "6.2"
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
                    "Upper non-critical": "",
                    "entityId": "6.2"
                }]
            }]);

            return helper.request().get('/redfish/v1/Chassis/' + enclosure.id + '/Power')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.render.called).to.be.true;
                });
        });

        it('should 404 an invalid chassis power object', function() {
            //redfish.getVendorNameById.rejects(new Errors.NotFoundError('Not Found'));
            return helper.request().get('/redfish/v1/Chassis/ABCDEFG/Power')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .expect(function() {
                    expect(redfish.render.called).to.be.true;
                });
        });

    });
});
