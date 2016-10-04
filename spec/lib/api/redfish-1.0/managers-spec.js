// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Managers', function () {
    var tv4;
    var validator;
    var redfish;
    var waterline;
    var Promise;
    var view;
    var fs;
    var Errors;

    // Skip reading the entry from Mongo and return the entry directly
    function redirectGet(entry) {
        return fs.readFileAsync(__dirname + '/../../../../data/views/redfish-1.0/' + entry, 'utf-8')
            .then(function(contents) {
                return { contents: contents };
            });
    }

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]).then(function () {
            view = helper.injector.get('Views');
            sinon.stub(view, "get", redirectGet);

            redfish = helper.injector.get('Http.Api.Services.Redfish');
            sinon.spy(redfish, 'render');

            validator = helper.injector.get('Http.Api.Services.Schema');
            sinon.spy(validator, 'validate');

            waterline = helper.injector.get('Services.Waterline');
            sinon.stub(waterline.nodes);
            sinon.stub(waterline.catalogs);

            Promise = helper.injector.get('Promise');
            Errors = helper.injector.get('Errors');

            var nodeFs = helper.injector.get('fs');
            fs = Promise.promisifyAll(nodeFs);
        });

    });

    beforeEach('set up mocks', function () {
        tv4 = require('tv4');
        sinon.spy(tv4, "validate");

        validator.validate.reset();
        redfish.render.reset();

        function resetStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].reset) {
                  obj[method].reset();
                }
            }).value();
        }

        resetStubs(waterline.nodes);
        resetStubs(waterline.catalogs);

        waterline.nodes.needByIdentifier.withArgs('1234abcd1234abcd1234abcd')
        .resolves(Promise.resolve({
            id: '1234abcd1234abcd1234abcd',
            name: '1234abcd1234abcd1234abcd'
        }));
        waterline.nodes.getNodeById.withArgs('1234abcd1234abcd1234abcd')
        .resolves(Promise.resolve({
            id: '1234abcd1234abcd1234abcd',
            name: '1234abcd1234abcd1234abcd'
        }));
        waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));
        waterline.nodes.getNodeById.resolves([]);
        waterline.catalogs.findLatestCatalogOfSource.rejects(new Errors.NotFoundError());
    });

    afterEach('tear down mocks', function () {
        tv4.validate.restore();
    });

    after('stop HTTP server', function () {
        validator.validate.restore();
        redfish.render.restore();
        view.get.restore();
        
        function restoreStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].restore) {
                  obj[method].restore();
                }
            }).value();
        }

        restoreStubs(waterline.nodes);
        restoreStubs(waterline.catalogs);
        return helper.stopServer();
    });

    var node = {
        id: '1234abcd1234abcd1234abcd',
        name: 'name',
        type: 'compute',
        obms: [{
            id: "574dcd5794ab6e2506fd107a",
            node: "1234abcd1234abcd1234abcd",
            service: 'ipmi-obm-service',
            config: {
                host: '1.2.3.4',
                user: 'myuser',
                password: 'mypass'
           }
        }],
        relations: [
            {
                relationType: 'enclosedBy',
                targets: [ '4567efgh4567efgh4567efgh' ]
            }
        ]
    };

    var catalogData = {
        'IP Address Source' : 'DHCP Address',
        'IP Address' : '127.0.0.1',
        'Subnet Mask' : '255.255.252.0',
        'MAC Address' : '00:01:02:03:04:05',
        'Default Gateway IP' : '0.0.0.0',
        '802_1q VLAN ID' : 'Disabled',
        'Firmware Revision' : '9.08',
        'Manufacturer Name' : 'Unknown (0x1291)',
        'Product Name' : 'Unknown (0xF02)'
    };

    it('should return a valid manager root', function () {
        waterline.nodes.find.resolves([node]);
        return helper.request().get('/redfish/v1/Managers')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid manager', function() {
        waterline.nodes.needByIdentifier.withArgs('1234abcd1234abcd1234abcd').resolves(node);
        waterline.nodes.getNodeById.withArgs('1234abcd1234abcd1234abcd').resolves(node);
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Managers/' + node.id + '.0')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });
    
    it('should 404 an invalid manager', function() {
        return helper.request().get('/redfish/v1/Managers/invalid')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid manager ethernet interface collection', function() {
        waterline.nodes.needByIdentifier.withArgs('1234abcd1234abcd1234abcd').resolves(node);
        waterline.nodes.getNodeById.withArgs('1234abcd1234abcd1234abcd').resolves(node);
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Managers/' + node.id + '.0/EthernetInterfaces')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });
    
    it('should 404 an invalid manager ethernet interface collection', function() {
        return helper.request().get('/redfish/v1/Managers/invalid.0/EthernetInterfaces')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid manager ethernet interface', function() {
        waterline.nodes.needByIdentifier.withArgs('1234abcd1234abcd1234abcd').resolves(node);
        waterline.nodes.getNodeById.withArgs('1234abcd1234abcd1234abcd').resolves(node);
        waterline.catalogs.findLatestCatalogOfSource.resolves(Promise.resolve({
            node: '1234abcd1234abcd1234abcd',
            source: 'dummysource',
            data: catalogData
        }));

        return helper.request().get('/redfish/v1/Managers/' + node.id + '.0/EthernetInterfaces/0')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });
    
    it('should 404 an invalid manager ethernet interface', function() {
        return helper.request().get('/redfish/v1/Managers/invalid.0/EthernetInterfaces/0')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return the RackHD manager', function() {
        return helper.request().get('/redfish/v1/Managers/RackHD')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should patch the RackHD manager', function() {
        waterline.nodes.find.resolves([node]);
        return helper.request().patch('/redfish/v1/Managers/RackHD')
            .send({ NetworkProtocol: { SSDP: { ProtocolEnabled: false }}})
            .expect(204);
    });

    it('should 405 a patch when it is not the RackHD manager', function() {
        return helper.request().patch('/redfish/v1/Managers/RackHD1')
            .expect('Content-Type', /^application\/json/)
            .send({ NetworkProtocol: { SSDP: { ProtocolEnabled: false }}})
            .expect(405);
    });

    it('should return the RackHD manager ethernet interface collection', function() {
        return helper.request().get('/redfish/v1/Managers/RackHD/EthernetInterfaces')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return the RackHD manager ethernet interface', function() {
        return helper.request().get('/redfish/v1/Managers/RackHD/EthernetInterfaces')
        .then(function(res) {
            return Promise.map(res.body.Members, function(member) {
                return helper.request().get(member['@odata.id'])
                    .expect('Content-Type', /^application\/json/)
                    .expect(200);
            });
        });
    });

});

