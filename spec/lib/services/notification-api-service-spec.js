// Copyright © 2016-2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

describe('Http.Api.Notification', function () {
    var notificationApiService;
    var graphProgressService;
    var eventsProtocol;
    var waterline;
    var _;
    var needByIdentifier;
    var postNodeNotification;
    var postBroadcastNotification;
    var lookup;

    var nodeNotificationMessage = {
        nodeId: '57a86b5c36ec578876878294',
        data: 'dummy data'
    };
    var broadcastNotificationMessage = {
        data: 'dummy data'
    };
    var node = {_id: nodeNotificationMessage.nodeId};

    var bmc = {
        'IP Address': '10.240.19.130',
        node: "abc",
        data: {'MAC Address': "jill"}
    };
    var deviceInfoCatalog = {
        data: {
            'Builtin FRU Device (ID 0)': {
                'Board Product': "bernie",
                'Product Serial': "hillary",
                'Board Serial': "theDonald"
            }
        }
    };
    var ooc =  "NonDisk.Direct.0-0:AHCI.Embedded.1-1";
    var catalogFqdd = "Disk.Direct.0-0:AHCI.Embedded.1-1";

    var wsmanCatalog =
    {
        "data": {
            "storage": {
                "physicalDisks": [
                    {
                        "fqdd": catalogFqdd,
                        "mediaType": "0",
                        "serialNumber": "9XG9PVW3",
                        "instanceID": null,
                        "sasaddress": "5000C50087FA4387",
                        "deviceDescription": "Disk 0 on Embedded AHCI Controller 1",
                        "manufacturer": "SEAGATE",
                        "model": "ST91000640NS"
                    }
                ]
            }
        }
    };
    var alert = {
        "Severity": "Critical",
        "OriginOfCondition": ooc
    };
    var amqpMessage = {
        action: "alerts",
        data: {
            ChassisName: "bernie",
            SN: "theDonald",
            ServiceTag: "hillary",
            Severity: "Critical",
            sourceMacAddress: "jill",
            nodeId: "abc",
            sourceIpAddress: "127.0.0.1",
            OriginOfCondition: "NonDisk.Direct.0-0:AHCI.Embedded.1-1",
            originOfConditionPartNumber: null,
            originOfConditionSerialNumber: null
        },
        severity: "critical",
        type: "node",
        typeId: "abc"
    };

    var req = {
        headers : {
            'x-forwarded-for' :"127.0.0.1"
        },
        swagger: { query: alert}
    };

    var graphId;
    var taskId;
    var progressData;
    var message;

    before('Setup mocks', function () {
        helper.setupInjector([
            onHttpContext.prerequisiteInjectables,
            helper.require("/lib/services/notification-api-service.js")
        ]);
        notificationApiService = helper.injector.get('Http.Services.Api.Notification');
        graphProgressService = helper.injector.get('Services.GraphProgress');
        _ = helper.injector.get('_');
        eventsProtocol = helper.injector.get('Protocol.Events');
        lookup = helper.injector.get('Services.Lookup');
        waterline = helper.injector.get('Services.Waterline');
        waterline.nodes = {
            needByIdentifier: function() {}
        };
        sinon.stub(eventsProtocol, 'publishNodeNotification').resolves();
        sinon.stub(eventsProtocol, 'publishBroadcastNotification').resolves();
        sinon.stub(eventsProtocol, 'publishExternalEvent').resolves();
        this.sandbox = sinon.sandbox.create();
        needByIdentifier = sinon.stub(waterline.nodes, 'needByIdentifier');
        needByIdentifier.resolves(node);
        postNodeNotification = sinon.spy(notificationApiService, 'postNodeNotification');
        postBroadcastNotification = sinon.spy(notificationApiService, 'postBroadcastNotification');
        var uuid = helper.injector.get('uuid');
        graphId = uuid.v4();
        taskId = uuid.v4();

        waterline.catalogs = {
            findMostRecent: sinon.stub()
        };
        waterline.obms = {
            findOne: sinon.stub()
        };
    });

    beforeEach(function() {
        progressData = {
            description: 'test',
            maximum: 100,
            value: 10,
        };
        message = {
            taskId: taskId,
            description: 'test',
            maximum: '100',
            value: '10',
        };
        waterline.catalogs.findMostRecent = sinon.stub().resolves();
        waterline.obms.findOne = sinon.stub().resolves();
    });

    after('Reset mocks', function () {
        function resetMocks(obj) {
            _(obj).methods().forEach(function (method) {
                if (typeof obj[method].restore === 'function') {
                    obj[method].restore();
                }
            }).value();
        }
        resetMocks(eventsProtocol);
        resetMocks(lookup);
    });

    describe('POST /notification', function () {

        it('should call postNodeNotification', function () {
            return notificationApiService.postNotification(nodeNotificationMessage)
            .then(function () {
                expect(postNodeNotification).to.have.been.calledOnce;
            });
        });

        it('should call postBroadcastNotification', function () {
            return notificationApiService.postNotification({})
            .then(function () {
                expect(postBroadcastNotification).to.have.been.calledOnce;
            });
        });

        it('should return node notification detail', function () {
            return notificationApiService.postNodeNotification(nodeNotificationMessage)
            .then(function (resp) {
                expect(resp).to.deep.equal(nodeNotificationMessage);
            });
        });

        it('should fail with no nodeId', function () {
            return notificationApiService.postNodeNotification(_.omit(nodeNotificationMessage,
                                                                      'nodeId'))
            .then(function (done) {
                done(new Error("Expected service to fail"));
            })
            .catch(function (e) {
                expect(e).to.have.property('message').that.equals(
                    'Invalid node ID in query or body');
            });
        });

        it('should fail with nodeId that is not a string', function () {
            return notificationApiService.postNodeNotification(
                _.assign({}, nodeNotificationMessage, {nodeId: {data: "I am an object"}}))
            .then(function (done) {
                done(new Error("Expected service to fail"));
            })
            .catch(function (e) {
                expect(e).to.have.property('message').that.equals(
                    'Invalid node ID in query or body');
            });
        });

        it('should fail with non-exist node', function () {
            needByIdentifier.resolves();
            return notificationApiService.postNodeNotification(nodeNotificationMessage)
            .then(function (done) {
                done(new Error("Expected service to fail"));
            })
            .catch(function (e) {
                expect(e).to.have.property('message').that.equals('Node not found');
            });
        });

        it('should return post broadcast notification', function () {
            return notificationApiService.postBroadcastNotification(broadcastNotificationMessage)
            .then(function (resp) {
                expect(resp).to.deep.equal(broadcastNotificationMessage);
            });
        });

        it('should not update graph progress if no active task found', function () {
            this.sandbox.restore();
            waterline.taskdependencies = {findOne: function() {}};
            waterline.graphobjects = {findOne: function() {}};
            this.sandbox.stub(waterline.taskdependencies, 'findOne').resolves([]);
            this.sandbox.spy(waterline.graphobjects, 'findOne');
            this.sandbox.spy(eventsProtocol, 'publishProgressEvent');
            return expect(
                notificationApiService.publishTaskProgress(message)
            ).to.be.rejected;
        });

        it('should post an alert notification successfully(from catalog collection & Ip)', function () {// jshint ignore:line
            this.sandbox.restore();
            sinon.stub(lookup, 'lookupByIP').resolves();
            waterline.obms.findOne.onCall(0).resolves(undefined);
            waterline.obms.findOne.onCall(1).resolves(undefined);
            waterline.catalogs.findMostRecent.onCall(0).resolves(bmc);
            waterline.catalogs.findMostRecent.onCall(1).resolves(deviceInfoCatalog);
            waterline.catalogs.findMostRecent.onCall(2).resolves(wsmanCatalog);
            return notificationApiService.redfishAlertProcessing(req)
                .then(function (resp) {
                    expect(resp).to.deep.equal(amqpMessage);
                });
        });

        it('should post an alert notification successfully(from obms collection & MAc)', function () {// jshint ignore:line
            this.sandbox.restore();
            waterline.obms.findOne.onCall(0).resolves({config : {host: "0.0.0.0"}});
            waterline.catalogs.findMostRecent.onCall(0).resolves(bmc);
            waterline.catalogs.findMostRecent.onCall(1).resolves(deviceInfoCatalog);
            wsmanCatalog.data.storage.fqdd=  catalogFqdd;
            waterline.catalogs.findMostRecent.onCall(2).resolves(wsmanCatalog);
            return notificationApiService.redfishAlertProcessing(req)
                .then(function (resp) {
                    expect(resp).to.deep.equal(amqpMessage);
                });
        });

        it('should post an alert notification successfully(from obms collection)', function () {
            this.sandbox.restore();
            waterline.obms.findOne.onCall(0).resolves({config : {host: "00:00:00:00:00"}});
            waterline.catalogs.findMostRecent.onCall(0).resolves(bmc);
            waterline.catalogs.findMostRecent.onCall(1).resolves(deviceInfoCatalog);
            ooc =  "NonDisk.Direct.0-0:AHCI.Embedded.1-1";
            catalogFqdd = "Disk.Direct.0-0:AHCI.Embedded.1-1";

            amqpMessage.data.OriginOfCondition = ooc;
            wsmanCatalog.data.storage.fqdd =  catalogFqdd;
            waterline.catalogs.findMostRecent.onCall(2).resolves(wsmanCatalog);
            return notificationApiService.redfishAlertProcessing(req)
                .then(function (resp) {
                    expect(resp).to.deep.equal(amqpMessage);
                });
        });

        it('should NOT post an alert notification for an unrecognized node', function (done) {
            this.sandbox.restore();
            waterline.catalogs.findMostRecent.onCall(0).resolves(undefined);
            waterline.obms.findOne.onCall(0).resolves(undefined);
            notificationApiService.redfishAlertProcessing(req)
                .then(function(){
                    done(new Error('should NOT have posted the alert!'));
                })
                .catch(function (e) {
                    expect(e).to.have.property('message').that.equals('unrecognized node');
                    done();
                });
        });

        it('should NOT post an alert notification for unexpected decoded data', function (done) {
            var badReq = {
                headers : {
                    'x-forwarded-for' :"127.0.0.1"
                },
                swagger: { query: {}}
            };
            this.sandbox.restore();
            waterline.catalogs.findMostRecent.onCall(0).resolves(bmc);
            waterline.obms.findOne.onCall(0).resolves(deviceInfoCatalog);
            notificationApiService.redfishAlertProcessing(badReq)
                .then(function(){
                    done(new Error('should NOT have posted the alert!'));
                })
                .catch(function (e) {
                    expect(e).to.have.property('message').that.equals('Unexpected alert data');// jshint ignore:line
                    done();
                });
        });

        it('should post an alert notification successfully(different catalog fbdd and alert originOfCondition)', function () {// jshint ignore:line
            //originOfCondition:"Disk.Bay.1-7" is equivalent to FQDD: "Disk.Direct.3-7:AHCI.Embedded.2-1"
            this.sandbox.restore();
            ooc =  "Disk.Bay.1-7";
            catalogFqdd = "Disk.Direct.3-7:AHCI.Embedded.2-1";
            alert = {
                "Severity": "Critical",
                "OriginOfCondition": ooc
            };
            req = {
                headers : {
                    'x-forwarded-for' :"127.0.0.1"
                },
                swagger: { query: alert}
            };
            wsmanCatalog.data.storage.physicalDisks[0].fqdd = catalogFqdd;
            waterline.obms.findOne.onCall(0).resolves({config : {host: "00:00:00:00:00"}});
            waterline.catalogs.findMostRecent.onCall(0).resolves(bmc);
            waterline.catalogs.findMostRecent.onCall(1).resolves(deviceInfoCatalog);
            amqpMessage.data.OriginOfCondition = ooc;
            amqpMessage.data.originOfConditionPartNumber = wsmanCatalog.data.storage.physicalDisks[0].model;
            amqpMessage.data.originOfConditionSerialNumber = wsmanCatalog.data.storage.physicalDisks[0].serialNumber;
            wsmanCatalog.data.storage.fqdd =  catalogFqdd;
            waterline.catalogs.findMostRecent.onCall(2).resolves(wsmanCatalog);
            return notificationApiService.redfishAlertProcessing(req)
                .then(function (resp) {
                    expect(resp).to.deep.equal(amqpMessage);
                });
        });

        it('should post an alert notification successfully("couldn NOT find catalog info")', function () {// jshint ignore:line

            this.sandbox.restore();
            ooc =  "Disk.Bay.11";
            catalogFqdd = "Disk.Direct.3-7:AHCI.Embedded.2-1";
            alert = {
                "Severity": "Critical",
                "OriginOfCondition": ooc
            };
            req = {
                headers : {
                    'x-forwarded-for' :"127.0.0.1"
                },
                swagger: { query: alert}
            };
            wsmanCatalog.data.storage.physicalDisks.fqdd = catalogFqdd;
            waterline.obms.findOne.onCall(0).resolves({config : {host: "00:00:00:00:00"}});
            waterline.catalogs.findMostRecent.onCall(0).resolves(bmc);
            waterline.catalogs.findMostRecent.onCall(1).resolves(deviceInfoCatalog);
            amqpMessage.data.OriginOfCondition = ooc;
            amqpMessage.data.originOfConditionPartNumber = null;
            amqpMessage.data.originOfConditionSerialNumber = null;
            wsmanCatalog.data.storage.fqdd =  catalogFqdd;
            waterline.catalogs.findMostRecent.onCall(2).resolves(wsmanCatalog);
            return notificationApiService.redfishAlertProcessing(req)
                .then(function (resp) {
                    expect(resp).to.deep.equal(amqpMessage);
                });
        });
    });
});
