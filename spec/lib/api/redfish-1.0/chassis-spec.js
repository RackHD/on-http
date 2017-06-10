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
        name: 'Enclosure Node ABCDEFG',
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

    var system = {
        id: '1234abcd1234abcd1234abcd',
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
        name: 'sys/chassis-1',
        type: 'enclosure',
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

    before('start HTTP server', function () {
        var self = this;
        this.timeout(5000);
        this.sandbox = sinon.sandbox.create();

        return helper.startServer([]).then(function () {
            redfish = helper.injector.get('Http.Api.Services.Redfish');
            self.sandbox.spy(redfish, 'render');

            validator = helper.injector.get('Http.Api.Services.Schema');
            self.sandbox.spy(validator, 'validate');

            waterline = helper.injector.get('Services.Waterline');
            self.sandbox.stub(waterline.nodes);
            waterline.nodes.findByIdentifier.withArgs('4567efgh4567efgh4567efgh').resolves(enclosure);
            waterline.nodes.findByIdentifier.withArgs('1234abcd1234abcd1234abcd').resolves(system);
            waterline.nodes.findByIdentifier.withArgs('aaaabbbbcccc111122223333').resolves(ucsEnclosure);
            waterline.nodes.findByIdentifier.withArgs('ddddeeeeffff444455556666').resolves(ucsSystem);
            waterline.nodes.findByIdentifier.resolves();

            Promise = helper.injector.get('Promise');
            Errors = helper.injector.get('Errors');

            taskProtocol = helper.injector.get('Protocol.Task');
            self.sandbox.stub(taskProtocol);

            env = helper.injector.get('Services.Environment');
            self.sandbox.stub(env, "get").resolves({});

            var nodeFs = helper.injector.get('fs');
            fs = Promise.promisifyAll(nodeFs);

            nodeApi = helper.injector.get('Http.Services.Api.Nodes');
            self.sandbox.stub(nodeApi, "getAllNodes");
            self.sandbox.stub(nodeApi, "getNodeCatalogSourceById");
            self.sandbox.stub(nodeApi, "getPollersByNodeId");
            self.sandbox.stub(nodeApi, "getNodeById");
            nodeApi.getNodeById.withArgs('4567efgh4567efgh4567efgh').resolves(enclosure);
            nodeApi.getNodeById.withArgs('1234abcd1234abcd1234abcd').resolves(system);
            nodeApi.getNodeById.withArgs('aaaabbbbcccc111122223333').resolves(ucsEnclosure);
            nodeApi.getNodeById.withArgs('ddddeeeeffff444455556666').resolves(ucsSystem);

            nodeApi.getNodeById.rejects(new Errors.NotFoundError('Not Found'));
        });

    });

    beforeEach('set up mocks', function () {
        tv4 = require('tv4');
        sinon.spy(tv4, "validate");

        this.sandbox.reset();
        nodeApi.getAllNodes.resolves([enclosure]);
    });

    afterEach('tear down mocks', function () {
        tv4.validate.restore();
    });

    after('stop HTTP server', function () {
        this.sandbox.restore();
        return helper.stopServer();
    });

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

    it('should return valid chassis and related targets', function() {
        nodeApi.getNodeCatalogSourceById.resolves({
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
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return valid UCS chassis and related targets', function() {
        nodeApi.getPollersByNodeId.resolves([]);

        nodeApi.getNodeCatalogSourceById.onCall(0).returns(Promise.reject(new Errors.NotFoundError('geoff not found')));
        nodeApi.getNodeCatalogSourceById.returns(Promise.resolve({
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
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid power object', function () {
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
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid chassis object', function() {
        return helper.request().get('/redfish/v1/Chassis/ABCDEFG')
            .expect('Content-Type', /^application\/json/)
            .expect(404)
            .expect(function() {
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid chassis thermal object', function() {
        return helper.request().get('/redfish/v1/Chassis/ABCDEFG/Thermal')
            .expect('Content-Type', /^application\/json/)
            .expect(404)
            .expect(function() {
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid chassis power object', function() {
        return helper.request().get('/redfish/v1/Chassis/ABCDEFG/Power')
            .expect('Content-Type', /^application\/json/)
            .expect(404)
            .expect(function() {
                expect(redfish.render.called).to.be.true;
            });
    });

});
