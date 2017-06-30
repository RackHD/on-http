// Copyright © 2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

describe('Redfish Update Service', function () {
    var redfish;
    var waterline;
    var workflow;
    var obmSettings = [
        {
            service: 'ipmi-obm-service',
            config: {
                host: '1.2.3.4',
                user: 'myuser',
                password: 'mypass'
            }
        }
    ];
    var badPayload = {"junk": "junk"};
    var goodPayload = {
        "ImageURI": "/home/rackhd/tmp/installer.exe",
        "Targets": ["58a4799ebaaafbe005dd0bc6"]
    };
    var mockNode = {id: '58a4799ebaaafbe005dd0bc6', type: 'compute'};

    var mockCatalogRACADM = {
        "node": "593acc7e5aa5beed6f1f3082",
        "source": "racadm-firmware-list-catalog",
        "data": {
            "PSU1": {
                "elementName": "Power Supply.Slot.1",
                "FQDD": "PSU.Slot.1",
                "installationDate": "2016-08-31T04:18:55Z",
                "currentVersion": "00.24.7A",
                "rollbackVersion": "",
                "availableVersion": "",
                "componentType": "FIRMWARE"
            },
            "PSU2": {
                "elementName": "Power Supply.Slot.2",
                "FQDD": "PSU.Slot.2",
                "installationDate": "2017-03-10T08:24:14Z",
                "currentVersion": "00.24.7A",
                "rollbackVersion": "",
                "availableVersion": "",
                "componentType": "FIRMWARE"
            },
            "iDRAC": {
                "elementName": "Integrated Remote Access Controller",
                "FQDD": "iDRAC.Embedded.1-1",
                "installationDate": "2017-03-30T09:10:51Z",
                "currentVersion": "2.40.40.40",
                "rollbackVersion": "2.30.30.30",
                "availableVersion": "",
                "componentType": "FIRMWARE"
            },
            "NIC1": {
                "elementName": "Intel(R) Gigabit 4P X520/I350 rNDC - 24:6E:96:1F:51:8D",
                "currentVersion": "21.1",
                "FQDD": "NIC.Integrated.1-4-1",
                "componentType": "APPLICATION"
            },
            "NIC2": {
                "elementName": "Intel(R) Gigabit 4P X520/I350 rNDC - 24:6E:96:1F:51:8c",
                "currentVersion": "21.1",
                "FQDD": "NIC.Integrated.1-4-2",
                "componentType": "APPLICATION"
            }
        }
    };

    var mockCatalogDMI = {
        "node": "5947d2cfe6b9b3e113d81984",
        "source": "dmi",
        "data": {
            "BIOS Information": {
                "Vendor": "American Megatrends Inc.",
                "Version": "S2S_3A14",
                "Release Date": "09/18/2014",
                "Address": "0xF0000",
                "Runtime Size": "64 kB",
                "ROM Size": "8192 kB",
                "BIOS Revision": "5.6",
                "Firmware Revision": "3.16"
            }
        }
    };

    var mockCatalogIPMI = {
        "node": "5947d2cfe6b9b3e113d81984",
        "source": "ipmi-mc-info",
        "data": {
            "Device ID": "0",
            "Device Revision": "3",
            "Firmware Revision": "9.08",
            "IPMI Version": "2.0",
            "Manufacturer ID": "4753",
            "Manufacturer Name": "Unknown (0x1291)",
            "Product ID": "3842 (0x0f02)",
            "Product Name": "Unknown (0xF02)",
            "Device Available": "yes",
            "Provides Device SDRs": "no",
            "Additional Device Support": [
                "Sensor Device",
                "SDR Repository Device",
                "SEL Device",
                "FRU Inventory Device",
                "IPMB Event Receiver",
                "Chassis Device"
            ]
        }
    };

    var mockCatalogSMART = {
        "node": "5947d2cfe6b9b3e113d81984",
        "source": "smart",
        "data": [
            {
                "OS Device Name": "/dev/sda scsi",
                "smartctl Version": "6.2",
                "SMART": {
                    "Identity": {
                        "Device Model": "QEMU HARDDISK",
                        "Serial Number": "QM00001",
                        "Firmware Version": "2.2.1",
                        "User Capacity": "9,006,219,264 bytes [9.00 GB]",
                        "Sector Size": "512 bytes logical/physical",
                        "Device is": "Not in smartctl database [for details use: -P showall]",
                        "ATA Version is": "ATA/ATAPI-7, ATA/ATAPI-5 published, ANSI NCITS 340-2000",
                        "Local Time is": "Mon Jun 19 13:35:44 2017 UTC",
                        "SMART support is": [
                            "Available - device has SMART capability.",
                            "Enabled"
                        ]
                    }
                }
            }
        ]
    };

    var node1 = {
        "sku": null,
        "autoDiscover": false,
        "createdAt": "2017-06-09T16:27:42.262Z",
        "identifiers": [
            "24:6e:96:1f:51:8d"
        ],
        "name": "24:6e:96:1f:51:8d",
        "relations": [
            {
                "relationType": "enclosedBy",
                "targets": [
                    "593accd15a45b5dd76e24adf"
                ]
            }
        ],
        "tags": [],
        "type": "compute",
        "updatedAt": "2017-06-09T16:29:06.016Z",
        "id": "593acc7e5aa5beed6f1f3082"
    };

    var node2 =  {
        "autoDiscover": false,
        "catalogs": "/api/2.0/nodes/5947d2cfe6b9b3e113d81984/catalogs",
        "id": "5947d2cfe6b9b3e113d81984",
        "identifiers": [
            "52:54:be:ef:91:ca"
        ],
        "name": "52:54:be:ef:91:ca",
        "obms": [
            {
                "service": "ipmi-obm-service",
                "ref": "/api/2.0/obms/5947d34f4cf6a0db13ac6352"
            }
        ],
        "relations": [
            {
                "relationType": "enclosedBy",
                "info": null,
                "targets": [
                    "5947d3404cf6a0db13ac6345"
                ]
            }
        ],
        "sku": null,
        "type": "compute"
    };

    before('start HTTP server', function () {
        var self = this;
        this.timeout(15000);
        this.sandbox = sinon.sandbox.create();

        return helper.startServer([], {authEnabled: false})
            .then(function () {
                redfish = helper.injector.get('Http.Api.Services.Redfish');
                waterline = helper.injector.get('Services.Waterline');
                workflow = helper.injector.get('Http.Services.Api.Workflows');

                self.sandbox.spy(redfish, 'validateSchema');
                self.sandbox.spy(redfish, 'handleError');
                self.sandbox.stub(waterline.obms, 'findAllByNode');
                self.sandbox.stub(waterline.nodes, 'getNodeById');
                self.sandbox.stub(waterline.nodes, 'findByIdentifier');
                self.sandbox.stub(waterline.catalogs, 'find');
                self.sandbox.stub(waterline.catalogs, 'findMostRecent');
                self.sandbox.stub(workflow, 'createAndRunGraph');
            });
    });

    afterEach('tear down mocks', function () {
        this.sandbox.reset();
    });

    after('stop HTTP server', function () {
        this.sandbox.restore();
        return helper.stopServer();
    });

    it('should run a graph', function () {
        waterline.nodes.getNodeById.resolves(mockNode);
        waterline.obms.findAllByNode.resolves(obmSettings);
        workflow.createAndRunGraph.resolves();
        return helper.request().post(
            '/redfish/v1/UpdateService/Actions/UpdateService.SimpleUpdate'
        )
            .send(goodPayload)
            .expect(201)
            .expect(function () {
                expect(workflow.createAndRunGraph).to.have.been.calledOnce;
            });
    });

    it('should validate a bad request payload', function () {
        return helper.request().post(
            '/redfish/v1/UpdateService/Actions/UpdateService.SimpleUpdate'
        )
            .send(badPayload)
            .expect('Content-Type', /^application\/json/)
            .expect(400)
            .expect(function (response) {
                expect(response.body).to.have.property('errors');
            });
    });

    it('should return an error if a node is not found', function () {
        waterline.nodes.getNodeById.resolves(undefined);
        return helper.request().post(
            '/redfish/v1/UpdateService/Actions/UpdateService.SimpleUpdate'
        )
            .send(goodPayload)
            .expect('Content-Type', /^application\/json/)
            .expect(400)
            .expect(function (response) {
                expect(response.body).to.have.property('error');
                expect(redfish.handleError).to.have.been.calledOnce;
            });
    });


    it('should return a valid list of Firmware Inventory from RACADM catalog', function () {
        waterline.catalogs.find.resolves([mockCatalogRACADM]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogRACADM);
        waterline.nodes.findByIdentifier.resolves(node1);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(2);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/PSU-00.24.7A");
                expect(res.body.Members[1]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/iDRAC-2.40.40.40");
            });
    });

    it('should return a valid list of Firmware Inventory from DMI catalog', function () {
        waterline.catalogs.find.resolves([mockCatalogDMI]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogDMI);
        waterline.nodes.findByIdentifier.resolves(node2);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/BIOS-S2S_3A14");
            });
    });

    it('should return a valid list of Firmware Inventory from IPMI-MC-Info catalog', function () {
        waterline.catalogs.find.resolves([mockCatalogIPMI]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogIPMI);
        waterline.nodes.findByIdentifier.resolves(node2);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/BMC-9.08");
            });
    });

    it('should return a valid list of Firmware Inventory from SMART catalog', function () {
        waterline.catalogs.find.resolves([mockCatalogSMART]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogSMART);
        waterline.nodes.findByIdentifier.resolves(node2);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/Disk-2.2.1");
            });
    });

    it('should return a valid root to RACADM Firmware Inventory by Id (Complex)', function () {
        waterline.catalogs.find.resolves([mockCatalogRACADM]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogRACADM);
        waterline.nodes.findByIdentifier.resolves(node1);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/PSU-00.24.7A')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(2);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Chassis/593accd15a45b5dd76e24adf/Power#/PowerSupplies/0");
                expect(res.body.RelatedItem[1]['@odata.id'])
                    .to.equal("/redfish/v1/Chassis/593accd15a45b5dd76e24adf/Power#/PowerSupplies/1");
            });
    });
    it('should return a valid root to RACADM Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.catalogs.find.resolves([mockCatalogRACADM]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogRACADM);
        waterline.nodes.findByIdentifier.resolves(node1);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/iDRAC-2.40.40.40')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(1);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Managers/593acc7e5aa5beed6f1f3082.0");
            });
    });

    it('should return a valid root to IPMI Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.catalogs.find.resolves([mockCatalogIPMI]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogIPMI);
        waterline.nodes.findByIdentifier.resolves(node2);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/BMC-9.08')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(1);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Managers/5947d2cfe6b9b3e113d81984.0");
            });
    });

    it('should return a valid root to DMI Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.catalogs.find.resolves([mockCatalogDMI]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogDMI);
        waterline.nodes.findByIdentifier.resolves(node2);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/BIOS-S2S_3A14')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(1);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Systems/5947d2cfe6b9b3e113d81984");
            });
    });

    it('should return a valid root to SMART Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.catalogs.find.resolves([mockCatalogSMART]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogSMART);
        waterline.nodes.findByIdentifier.resolves(node2);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/Disk-2.2.1')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(1);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Systems/5947d2cfe6b9b3e113d81984/SimpleStorage/");
            });
    });

    it('should return a valid list of Software Inventory from RACADM catalog', function () {
        waterline.catalogs.find.resolves([mockCatalogRACADM]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogRACADM);
        waterline.nodes.findByIdentifier.resolves(node1);
        return helper.request().get('/redfish/v1/UpdateService/SoftwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/SoftwareInventory/NIC-21.1");
            });
    });


    it('should return a valid list of Software Inventory from DMI catalog', function () {
        waterline.catalogs.find.resolves([mockCatalogDMI]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogDMI);
        waterline.nodes.findByIdentifier.resolves(node2);
        return helper.request().get('/redfish/v1/UpdateService/SoftwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/SoftwareInventory/BIOS-S2S_3A14");
            });
    });

    it('should return a valid root to RACADM Software Inventory by Id (Non enumeratable Entity)', function () {
        waterline.catalogs.find.resolves([mockCatalogRACADM]);
        waterline.catalogs.findMostRecent.resolves(mockCatalogRACADM);
        waterline.nodes.findByIdentifier.resolves(node1);
        return helper.request().get('/redfish/v1/UpdateService/SoftwareInventory/NIC-21.1')
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(2);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Systems/593acc7e5aa5beed6f1f3082/EthernetInterfaces/NIC.Integrated.1-4-1");
            });
    });

});
