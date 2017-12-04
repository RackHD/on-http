// Copyright © 2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

describe('Redfish Update Service', function () {
    var tv4;
    var validator;
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
        "ImageURI": "http://192.111.111.111/installer.exe",
        "Targets": ["58a4799ebaaafbe005dd0bc6"]
    };
    var mockNode = {id: '58a4799ebaaafbe005dd0bc6', type: 'compute'};

    var node1WsmanSoftwareInventory = {
        "node": "59ca21d73a0bb58304df131d",
        "source": "software",
        "data": [
            {
                "componentType": {
                    "value": "FRMW",
                    "otherAttributes": {}
                },
                "elementName": {
                    "value": "Integrated Dell Remote Access Controller",
                    "otherAttributes": {}
                },
                "identityInfoValue": [
                    {
                        "value": "DCIM:firmware:25227",
                        "otherAttributes": {}
                    }
                ],
                "installationDate": {
                    "value": "NA",
                    "otherAttributes": {}
                },
                "instanceID": {
                    "value": "DCIM:PREVIOUS#iDRAC.Embedded.1-1#IDRACinfo",
                    "otherAttributes": {}
                },
                "versionString": {
                    "value": "2.30.30.30",
                    "otherAttributes": {}
                },
                "any": [
                    "<?xml version=\"1.0\" encoding=\"UTF-16\"?>\n<n1:FQDD xmlns:n1=\"http://schemas.dell.com/wbem/wscim/1/cim-schema/2/DCIM_SoftwareIdentity\" xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:wsa=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:wsen=\"http://schemas.xmlsoap.org/ws/2004/09/enumeration\" xmlns:wsman=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">iDRAC.Embedded.1-1</n1:FQDD>"
                ],
                "otherAttributes": {}
            },
            {
                "componentType": {
                    "value": "FRMW",
                    "otherAttributes": {}
                },
                "elementName": {
                    "value": "Intel(R) Ethernet 10G X520 LOM - 7C:D3:0A:B0:52:9E",
                    "otherAttributes": {}
                },
                "identityInfoValue": [
                    {
                        "value": "DCIM:firmware:8086:10FB:1028:06EE",
                        "otherAttributes": {}
                    }
                ],
                "installationDate": {
                    "value": "2016-05-13T03:59:52Z",
                    "otherAttributes": {}
                },
                "instanceID": {
                    "value": "DCIM:INSTALLED#701__NIC.Embedded.1-1-1",
                    "otherAttributes": {}
                },
                "versionString": {
                    "value": "16.5.0",
                    "otherAttributes": {}
                },
                "any": [
                    "<?xml version=\"1.0\" encoding=\"UTF-16\"?>\n<n1:FQDD xmlns:n1=\"http://schemas.dell.com/wbem/wscim/1/cim-schema/2/DCIM_SoftwareIdentity\" xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:wsa=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:wsen=\"http://schemas.xmlsoap.org/ws/2004/09/enumeration\" xmlns:wsman=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">NIC.Embedded.1-1-1</n1:FQDD>"
                ],
                "otherAttributes": {}
            },
            {
                "componentType": {
                    "value": "APAC",
                    "otherAttributes": {}
                },
                "elementName": {
                    "value": "Lifecycle Controller",
                    "otherAttributes": {}
                },
                "identityInfoValue": [
                    {
                        "value": "DCIM:firmware:28897",
                        "otherAttributes": {}
                    }
                ],
                "installationDate": {
                    "value": "2016-05-13T04:36:14Z",
                    "otherAttributes": {}
                },
                "instanceID": {
                    "value": "DCIM:INSTALLED#802__USC.Embedded.1:LC.Embedded.1",
                    "otherAttributes": {}
                },
                "versionString": {
                    "value": "2.30.30.30",
                    "otherAttributes": {}
                },
                "any": [
                    "<?xml version=\"1.0\" encoding=\"UTF-16\"?>\n<n1:FQDD xmlns:n1=\"http://schemas.dell.com/wbem/wscim/1/cim-schema/2/DCIM_SoftwareIdentity\" xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:wsa=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:wsen=\"http://schemas.xmlsoap.org/ws/2004/09/enumeration\" xmlns:wsman=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">USC.Embedded.1:LC.Embedded.1</n1:FQDD>"
                ],
                "otherAttributes": {}
            },
            {
                "componentType": {
                    "value": "FRMW",
                    "otherAttributes": {}
                },
                "elementName": {
                    "value": "SGPIO 0:0",
                    "otherAttributes": {}
                },
                "identityInfoValue": [
                    {
                        "value": "DCIM:firmware:0",
                        "otherAttributes": {}
                    }
                ],
                "installationDate": {
                    "value": "1969-12-31T18:00:00Z",
                    "otherAttributes": {}
                },
                "instanceID": {
                    "value": "DCIM:INSTALLED#308_C_Enclosure.Internal.0-0:RAID.Slot.1-1",
                    "otherAttributes": {}
                },
                "versionString": {
                    "value": "NA",
                    "otherAttributes": {}
                },
                "any": [
                    "<?xml version=\"1.0\" encoding=\"UTF-16\"?>\n<n1:FQDD xmlns:n1=\"http://schemas.dell.com/wbem/wscim/1/cim-schema/2/DCIM_SoftwareIdentity\" xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:wsa=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:wsen=\"http://schemas.xmlsoap.org/ws/2004/09/enumeration\" xmlns:wsman=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">Enclosure.Internal.0-0:RAID.Slot.1-1</n1:FQDD>"
                ],
                "otherAttributes": {}
            },
            {
                "componentType": {
                    "value": "FRMW",
                    "otherAttributes": {}
                },
                "elementName": {
                    "value": "SGPIO 0:0",
                    "otherAttributes": {}
                },
                "identityInfoValue": [
                    {
                        "value": "DCIM:firmware:0",
                        "otherAttributes": {}
                    }
                ],
                "installationDate": {
                    "value": "1969-12-31T18:00:00Z",
                    "otherAttributes": {}
                },
                "instanceID": {
                    "value": "DCIM:INSTALLED#308_C_Enclosure.Internal.0-0:RAID.Slot.1-1",
                    "otherAttributes": {}
                },
                "versionString": {
                    "value": "N A",
                    "otherAttributes": {}
                },
                "any": [
                    ""
                ],
                "otherAttributes": {}
            }
        ],
        "createdAt": "2017-09-28T08:59:09.959Z",
        "updatedAt": "2017-09-28T08:59:09.959Z",
        "id": "b478fa7d-63a7-46c3-8f9b-932d2fec7b7a"
    };

    var node2WsmanSoftwareInventory = {
        "node": "5947d2cfe6b9b3e113d81984",
        "source": "software",
        "data": [
            {
                "componentType": {
                    "value": "FRMW",
                    "otherAttributes": {}
                },
                "elementName": {
                    "value": "Integrated Dell Remote Access Controller",
                    "otherAttributes": {}
                },
                "identityInfoValue": [
                    {
                        "value": "DCIM:firmware:25227",
                        "otherAttributes": {}
                    }
                ],
                "installationDate": {
                    "value": "NA",
                    "otherAttributes": {}
                },
                "instanceID": {
                    "value": "DCIM:PREVIOUS#iDRAC.Embedded.1-1#IDRACinfo",
                    "otherAttributes": {}
                },
                "versionString": {
                    "value": "2.30.30.30",
                    "otherAttributes": {}
                },
                "any": [
                    "<?xml version=\"1.0\" encoding=\"UTF-16\"?>\n<n1:FQDD xmlns:n1=\"http://schemas.dell.com/wbem/wscim/1/cim-schema/2/DCIM_SoftwareIdentity\" xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:wsa=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:wsen=\"http://schemas.xmlsoap.org/ws/2004/09/enumeration\" xmlns:wsman=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">iDRAC.Embedded.1-1</n1:FQDD>"
                ],
                "otherAttributes": {}
            }
        ],
        "createdAt": "2017-10-19T06:50:06.762Z",
        "updatedAt": "2017-10-19T06:50:06.762Z",
        "id": "82d6ca0d-0c25-43a4-951f-fe972280a2f5"
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
                    "59ca21d73a0bb58304df131d"
                ]
            }
        ],
        "tags": [],
        "type": "compute",
        "updatedAt": "2017-06-09T16:29:06.016Z",
        "id": "59ca21d73a0bb58304df131d"
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

    helper.httpServerBefore([], {authEnabled: false});

    before(function () {
        redfish = helper.injector.get('Http.Api.Services.Redfish');
        waterline = helper.injector.get('Services.Waterline');
        workflow = helper.injector.get('Http.Services.Api.Workflows');
        validator = helper.injector.get('Http.Api.Services.Schema');
        tv4 = require('tv4');
    });

    beforeEach('set up mocks', function() {
        this.sandbox.spy(tv4, "validate");
        this.sandbox.spy(validator, 'validate');
        this.sandbox.spy(redfish, 'validateSchema');
        this.sandbox.spy(redfish, 'handleError');
        this.sandbox.spy(redfish, 'render');
        this.sandbox.stub(waterline.nodes, 'find');
        this.sandbox.stub(waterline.obms, 'findAllByNode');
        this.sandbox.stub(waterline.nodes, 'getNodeById');
        this.sandbox.stub(waterline.nodes, 'findByIdentifier');
        this.sandbox.stub(waterline.catalogs, 'find');
        this.sandbox.stub(waterline.catalogs, 'findMostRecent');
        this.sandbox.stub(waterline.catalogs, 'findLatestCatalogOfSource');
        this.sandbox.stub(workflow, 'createAndRunGraph');
    });

    helper.httpServerAfter();

    it('should return a valid updateService root', function () {
        return helper.request().get('/redfish/v1/UpdateService')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should handle error while rendering result', function() {
        redfish.render.restore();
        this.sandbox.stub(redfish, 'render').rejects('test');
        return helper.request().get('/redfish/v1/UpdateService')
            .expect('Content-Type', /^application\/json/)
            .expect(400)
            .expect(function (response) {
                expect(response.body).to.have.property('message', 'test');
            });
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
        waterline.nodes.find.resolves([node1, node2]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node1.id, "software").resolves(node1WsmanSoftwareInventory);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node2.id, "software").resolves(node2WsmanSoftwareInventory);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(3);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/iDRAC-2.30.30.30");
                expect(res.body.Members[1]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/NIC-16.5.0");
                expect(res.body.Members[2]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/Enclosure-NA");
            });
    });

    it('should handle error while rendering update service', function() {
        waterline.nodes.find.resolves([node1]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node1.id, "software").resolves(node1WsmanSoftwareInventory);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        redfish.render.restore();
        this.sandbox.stub(redfish, 'render').rejects('test');
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(400)
            .expect(function (response) {
                expect(response.body).to.have.property('message', 'test');
            });
    });

    it('should return a valid list of Software Inventory from RACADM catalog', function () {
        waterline.nodes.find.resolves([node1]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node1.id, "software").resolves(node1WsmanSoftwareInventory);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/SoftwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/SoftwareInventory/USC-2.30.30.30");
            });
    });

    it('should handle error while rendering result', function() {
        waterline.nodes.find.resolves([node1]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node1.id, "software").resolves(node1WsmanSoftwareInventory);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        redfish.render.restore();
        this.sandbox.stub(redfish, 'render').rejects('test');
        return helper.request().get('/redfish/v1/UpdateService/SoftwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(400)
            .expect(function (response) {
                expect(response.body).to.have.property('message', 'test');
            });
    });

    it('should return a valid list of Firmware Inventory from DMI catalog', function () {
        waterline.catalogs.findLatestCatalogOfSource.resolves(mockCatalogDMI);
        waterline.nodes.find.resolves([node2]);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/BIOS-S2S_3A14");
            });
    });

    it('should return a valid list of Firmware Inventory from IPMI-MC-Info catalog', function () {
        waterline.catalogs.findLatestCatalogOfSource.resolves(mockCatalogIPMI);
        waterline.nodes.find.resolves([node2]);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/BMC-9.08");
            });
    });

    it('should return a valid list of Firmware Inventory from SMART catalog', function () {
        waterline.catalogs.findLatestCatalogOfSource.resolves(mockCatalogSMART);
        waterline.nodes.find.resolves([node2]);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body['Members@odata.count']).to.equal(1);
                expect(res.body.Members[0]['@odata.id'])
                    .to.equal("/redfish/v1/UpdateService/FirmwareInventory/Disk-2.2.1");
            });
    });

    it('should return a valid root to RACADM Firmware Inventory by Id (Complex)', function () {
        waterline.nodes.find.resolves([node1]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node1.id, "software").resolves(node1WsmanSoftwareInventory);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        waterline.nodes.findByIdentifier.resolves(node1);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/Enclosure-NA')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(1);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Chassis/59ca21d73a0bb58304df131d");
            });
    });

    it('should return a invalid root to RACADM Firmware Inventory by Id ', function () {
        waterline.nodes.find.resolves([node1]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node1.id, "software").resolves(node1WsmanSoftwareInventory);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        waterline.nodes.findByIdentifier.resolves(node1);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/iDRAC-2.30.30.31')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid root to RACADM Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.nodes.find.resolves([node1]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node1.id, "software").resolves(node1WsmanSoftwareInventory);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/NIC-16.5.0')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(1);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Systems/59ca21d73a0bb58304df131d/EthernetInterfaces/NIC.Embedded.1-1-1");
            });
    });

    it('should return a valid root to RACADM Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.nodes.find.resolves([node1]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node1.id, "software").resolves(node1WsmanSoftwareInventory);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/iDRAC-2.30.30.30')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(1);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Managers/59ca21d73a0bb58304df131d");
            });
    });

    it('should return a invalid root to RACADM Firmware Inventory by Id ', function () {
        waterline.nodes.find.resolves([node1]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node1.id, "software").resolves(node1WsmanSoftwareInventory);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/iDRAC2.40.40.40')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });


    it('should return a valid root to IPMI Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.nodes.find.resolves([node2]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node2.id, "ipmi-mc-info").resolves(mockCatalogIPMI);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/BMC-9.08')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(1);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Managers/5947d2cfe6b9b3e113d81984");
            });
    });

    it('should return a invalid root to IPMI Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.nodes.find.resolves([node2]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node2.id, "ipmi-mc-info").resolves(mockCatalogIPMI);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/SoftwareInventory/BC-9.08')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });


    it('should return a valid root to DMI Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.nodes.find.resolves([node2]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node2.id, "dmi").resolves(mockCatalogDMI);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/BIOS-S2S_3A14')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(1);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Systems/5947d2cfe6b9b3e113d81984");
            });
    });

    it('should return a invalid root to DMI Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.nodes.find.resolves([node2]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node2.id, "dmi").resolves(mockCatalogDMI);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/-S2S_3A14')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

    it('should return a valid root to SMART Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.nodes.find.resolves([node2]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node2.id, "smart").resolves(mockCatalogSMART);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/Disk-2.2.1')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(res.body.RelatedItem.length).to.equal(1);
                expect(res.body.RelatedItem[0]['@odata.id'])
                    .to.equal("/redfish/v1/Systems/5947d2cfe6b9b3e113d81984/SimpleStorage");
            });
    });

    it('should return a invalid root to SMART Firmware Inventory by Id (Non enumeratable Entity)', function () {
        waterline.nodes.find.resolves([node2]);
        waterline.catalogs.findLatestCatalogOfSource.withArgs(node2.id, "smart").resolves(mockCatalogSMART);
        waterline.catalogs.findLatestCatalogOfSource.resolves(undefined);
        return helper.request().get('/redfish/v1/UpdateService/FirmwareInventory/disk-2.2.1')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

});
