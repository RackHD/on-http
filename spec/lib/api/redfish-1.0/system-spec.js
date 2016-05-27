// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Systems Root', function () {
    var tv4;
    var validator;
    var redfish;
    var waterline;
    var Promise;
    var taskProtocol;
    var template;
    var fs;
    var nodeApi;
    var Errors;

    // Skip reading the entry from Mongo and return the entry directly
    function redirectGet(entry) {
        return fs.readFileAsync(__dirname + '/../../../../data/templates/' + entry, 'utf-8')
            .then(function(contents) {
                return { contents: contents };
            });
    }

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]).then(function () {
            template = helper.injector.get('Templates');
            sinon.stub(template, "get", redirectGet);

            redfish = helper.injector.get('Http.Api.Services.Redfish');
            sinon.spy(redfish, 'render');

            validator = helper.injector.get('Http.Api.Services.Schema');
            sinon.spy(validator, 'validate');

            waterline = helper.injector.get('Services.Waterline');
            sinon.stub(waterline.nodes);
            sinon.stub(waterline.catalogs);
            sinon.stub(waterline.workitems);

            Promise = helper.injector.get('Promise');
            Errors = helper.injector.get('Errors');

            taskProtocol = helper.injector.get('Protocol.Task');
            sinon.stub(taskProtocol);

            nodeApi = helper.injector.get('Http.Services.Api.Nodes');
            sinon.stub(nodeApi, "setNodeWorkflowById");

            var nodeFs = helper.injector.get('fs');
            fs = Promise.promisifyAll(nodeFs);
        });

    });

    beforeEach('set up mocks', function () {
        tv4 = require('tv4');
        sinon.spy(tv4, "validate");

        validator.validate.reset();
        redfish.render.reset();
        nodeApi.setNodeWorkflowById.reset();

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

        waterline.nodes.needByIdentifier.withArgs('1234abcd1234abcd1234abcd')
        .resolves(Promise.resolve({
            id: '1234abcd1234abcd1234abcd',
            name: '1234abcd1234abcd1234abcd'
        }));
        waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));
        waterline.catalogs.findLatestCatalogOfSource.rejects(new Errors.NotFoundError());
        nodeApi.setNodeWorkflowById.resolves({instanceId: 'abcdef'});
    });

    afterEach('tear down mocks', function () {
        tv4.validate.restore();
    });

    after('stop HTTP server', function () {
        validator.validate.restore();
        redfish.render.restore();
        template.get.restore();
        nodeApi.setNodeWorkflowById.restore();
        
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

    var node = {
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
                asset_tag: 'test'
            },
            system: {
                Manufacturer: 'test',
                sku_number: 'test',
                product_name: 'test',
                serial_number: 'test',
                uuid: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'
            },
            bios: {
                version : "S2S_3A14         ",
                release_date : "09/18/2014",
                bios_revision : "5.6"
            },
            processor: {
                version: 'test'
            }
        },
        cpu: {
            real: "1",
            0: {
                vendor_id: 'test'
            }
        },
        kernel: {
            machine: 'x86_64'
        },
        'Memory Device': [
            {
                Size: '16384 MB'
            }
        ],
        'Processor Information' : [
            { 
                'Socket Designation': 'test',
                Manufacturer: 'test',
                'Max Speed': '2300 MHz',
                'Core Count': '10',
                'Thread Count': '20',
                Version: 'Intel(R) Xeon(R) CPU E5-2650 v3 @ 2.30GHz',
                ID: 'test',
                Family: 'test'
            }
        ],
    };

    var smartCatalog = [
        {
            SMART: {
                Identity: {
                }
            },
            Controller: {
                controller_PCI_BDF : "0000:00:01.1"
            }
        }
    ];

    it('should return a valid system root', function () {
        waterline.nodes.find.resolves([node]);
        return helper.request().get('/redfish/v1/Systems')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id']).to.equal('/redfish/v1/Systems/' + node.id);
            });
    });

    it('should return a valid system', function() {
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        waterline.workitems.findPollers.resolves([{
            config: { command: 'chassis' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            chassis: { power: "Unknown", uid: "Reserved"}
        }])

        return helper.request().get('/redfish/v1/Systems/' + node.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid system with sku', function() {
        waterline.nodes.needByIdentifier.withArgs('1234abcd1234abcd1234abcd')
        .resolves(Promise.resolve({
            id: '1234abcd1234abcd1234abcd',
            name: '1234abcd1234abcd1234abcd',
            sku: 'sku-value'
        }));

        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        waterline.workitems.findPollers.resolves([{
            config: { command: 'chassis' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            chassis: { power: "Unknown", uid: "Reserved"}
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });
    
    it('should 404 an invalid system', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id)
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid processor list', function() {
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));
        
        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Processors')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid processor list', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id + '/Processors')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid processor', function() {
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));
        
        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Processors/0')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid processor', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id + '/Processors/bad')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid simple storage list', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node.id, 'smart').resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: smartCatalog
        }));

        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Systems/' + node.id + '/SimpleStorage')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid simple storage', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id + '/SimpleStorage')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid simple storage device', function() {
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node.id, 'smart')
        .resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: smartCatalog
        }));

        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Systems/' + node.id + 
                                    '/SimpleStorage/0000_00_01_1')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid simple storage device', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id + 
                                    '/SimpleStorage/bad')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid log service', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id + 
                                    '/LogServices')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid sel log service', function() {
        waterline.workitems.findPollers.resolves([{
            config: { command: 'selInformation' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            selInformation: { '# of Alloc Units': 10, uid: "Reserved"}
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id + 
                                    '/LogServices/sel')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid sel log service', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id + 
                                    '/LogServices/sel')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid sel log service entry collection', function() {
        waterline.nodes.find.resolves([node]);
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sel' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            sel: [{
                logId: 'abcd',
                value: 'Assert',
                sensorType: 'Temperature',
                event: 'thermal event',
                sensorNumber: '#0x01',
                date: '01/01/1970',
                time: '01:01:01'
            }]
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id + 
                                    '/LogServices/sel/Entries')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });
    
    it('should return an empty sel log service entry collection', function() {
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sel' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            sel: undefined
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id + 
                                    '/LogServices/sel/Entries')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });



    it('should 404 an invalid sel log service entry list', function() {
        return helper.request().get('/redfish/v1/Systems/bad' + node.id + 
                                    '/LogServices/sel/Entries')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid sel log service entry', function() {
        waterline.nodes.find.resolves([node]);
        waterline.workitems.findPollers.resolves([{
            config: { command: 'sel' }
        }]);

        taskProtocol.requestPollerCache.resolves([{
            sel: [{
                logId: 'abcd',
                value: 'Assert',
                sensorType: 'Temperature',
                event: 'Thermal Event',
                sensorNumber: '#0x01',
                date: '01/01/1970',
                time: '01:01:01'
            }]
        }]);

        return helper.request().get('/redfish/v1/Systems/' + node.id + 
                                    '/LogServices/sel/Entries/abcd')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid sel log service entry', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id + 
                                    '/LogServices/sel/Entries/abcdefg')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid reset type list', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/Actions/ComputerSystem.Reset')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(template.get.called).to.be.true;
            });
    });

    it('should perform the specified valid reset', function() {
        return helper.request().post('/redfish/v1/Systems/' + node.id +
                                    '/Actions/ComputerSystem.Reset')
            .send({ reset_type: "ForceRestart"})
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(res.body['@odata.id']).to.equal('/redfish/v1/TaskService/Tasks/abcdef');
            });
    });

    it('should 400 an invalid reset type', function() {
        return helper.request().post('/redfish/v1/Systems/' + node.id +
                                    '/Actions/ComputerSystem.Reset')
            .send({ reset_type: "HalfForceRestart"})
            .expect('Content-Type', /^application\/json/)
            .expect(400);
    });

    it('should return a valid boot image list', function() {
        return helper.request().get('/redfish/v1/Systems/' + node.id +
                                    '/Actions/RackHD.BootImage')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(template.get.called).to.be.true;
            });
    });

    it('should perform the specified boot image installation', function() {
        var minimumValidBody = {
            domain: "rackhd.com",
            hostname: "rackhd",
            osName: "ESXi",
            repo: "http://172.31.128.1:9080/esxi/5.5",
            version: "6.0",
            rootPassword: "passw0rd",
            dnsServers: [ "172.31.128.1" ],
            installDisk: "firstdisk"
        };
        return Promise.map(['CentOS', 'CentOS+KVM', 'ESXi', 'RHEL', 'RHEL+KVM'], function(osName) {
            return helper.request().post('/redfish/v1/Systems/' + node.id +
                                        '/Actions/RackHD.BootImage')
                .send( _.merge(minimumValidBody, {osName: osName}) )
                .expect('Content-Type', /^application\/json/)
                .expect(201)
                .expect(function(res) {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(res.body['@odata.id']).to.equal('/redfish/v1/TaskService/Tasks/abcdef');
                });
        });
    });

    it('should 400 an invalid boot image installation', function() {
        var minimumInvalidBody = {
            domain: "rackhd.com",
            hostname: "rackhd",
            osName: "notESXi",
            repo: "http://172.31.128.1:9080/esxi/5.5",
            version: "6.0",
            rootPassword: "passw0rd",
            dnsServers: [ "172.31.128.1" ],
            installDisk: "firstdisk"
        };

        return helper.request().post('/redfish/v1/Systems/' + node.id +
                                    '/Actions/RackHD.BootImage')
            .send(minimumInvalidBody)
            .expect('Content-Type', /^application\/json/)
            .expect(400);
    });

});

