// Copyright 2016, EMC, Inc.
/* jshint node:true */

"use strict";

describe("Http.Services.Api.Obms", function () {
    var obmService;
    var Promise;
    var waterline;
    var eventsProtocol;

    before("Http.Services.Api.Obms before", function() {
        helper.setupInjector([
            helper.require("/lib/services/obm-api-service.js")
        ]);

        Promise = helper.injector.get('Promise');
        obmService = helper.injector.get("Http.Services.Api.Obms");
        waterline = helper.injector.get('Services.Waterline');
        eventsProtocol = helper.injector.get('Protocol.Events');

        waterline.nodes = {
            getNodeById: function() {}
        };
        waterline.obms = {
            needByIdentifier: function() {},
            updateByIdentifier: function() {},
            destroyByIdentifier: function() {}
        };
    });

    beforeEach(function() {
        this.sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
        this.sandbox.restore();
    });


    var mockObms = [
    {
        "config": {
            "host": {
                "default": "localhost",
                "type": "string"
            },
            "password": {
                "default": "admin",
                "type": "string"
            }
        },
        "service": "amt-obm-service"
    },
    {
        "config": {
            "community": {
                "default": "admin",
                "type": "string"
            },
            "host": {
                "default": "localhost",
                "type": "string"
            },
            "port": {
                "default": 1,
                "type": "integer"
            }
        },
        "service": "apc-obm-service"
    },
    {
        "config": {
            "host": {
                "default": "localhost",
                "type": "string"
            },
            "password": {
                "default": "admin",
                "type": "string"
            },
            "user": {
                "default": "admin",
                "type": "string"
            }
        },
        "service": "ipmi-obm-service"
    },
    {
        "config": {},
        "service": "noop-obm-service"
    },
    {
        "config": {
            "host": {
                "default": "localhost",
                "type": "string"
            },
            "password": {
                "default": "admin",
                "type": "string"
            },
            "port": {
                "default": 1,
                "type": "integer"
            },
            "user": {
                "default": "admin",
                "type": "string"
            }
        },
        "service": "raritan-obm-service"
    },
    {
        "config": {
            "community": {
                "default": "admin",
                "type": "string"
            },
            "host": {
                "default": "localhost",
                "type": "string"
            },
            "port": {
                "default": 1,
                "type": "integer"
            }
        },
        "service": "servertech-obm-service"
    },
    {
        "config": {
            "community": {
                "default": "admin",
                "type": "string"
            },
            "cyclePassword": {
                "default": "onrack",
                "type": "string"
            },
            "host": {
                "default": "localhost",
                "type": "string"
            },
            "pduOutlets": [
                {
                    "community": {
                        "default": "admin",
                        "type": "string"
                    },
                    "cyclePassword": {
                        "default": "A01",
                        "type": "string"
                    },
                    "host": {
                        "default": "localhost",
                        "type": "string"
                    },
                    "outletNumber": {
                        "default": 1,
                        "type": "integer"
                    },
                    "pduNumber": {
                        "default": 1,
                        "type": "integer"
                    }
                },
                {
                    "community": {
                        "default": "admin",
                        "type": "string"
                    },
                    "cyclePassword": {
                        "default": "A01",
                        "type": "string"
                    },
                    "host": {
                        "default": "localhost",
                        "type": "string"
                    },
                    "outletNumber": {
                        "default": 1,
                        "type": "integer"
                    },
                    "pduNumber": {
                        "default": 2,
                        "type": "integer"
                    }
                }
            ]
        },
        "service": "panduit-obm-service"
    },
    {
        "config": {
            "alias": {
                "default": "client",
                "type": "string"
            },
            "user": {
                "default": "root",
                "type": "string"
            }
        },
        "service": "vbox-obm-service"
    },
    {
        "config": {
            "vmxpath": {
                "default": "/tmp/vm.vmx",
                "type": "string"
            }
        },
        "service": "vmrun-obm-service"
    }
    ];
    describe("getObmLib", function() {
        it('should expose the appropriate methods', function() {
            obmService.should.have.property('getObmLib')
                .that.is.a('function').with.length(0);
        });

        it('Run getObm', function() {
            var temp = obmService.getObmLib();
            expect(temp).to.deep.equal(mockObms);
        });
    });

    describe("getObmLibById", function() {
        it('should expose the appropriate methods', function() {
            obmService.should.have.property('getObmLibById')
            .that.is.a('function').with.length(1);
        });
        it('Run getObmLibById', function() {
            var mockObm = {
                          "config": {
                              "vmxpath": {
                              "default": "/tmp/vm.vmx",
                              "type": "string"
                              }
                          },
                          "service": "vmrun-obm-service"
                          };
            var temp = obmService.getObmLibById("vmrun-obm-service");
            expect(temp).to.deep.equal(mockObm);
        });

        it('should return undefined, when invalid id  is passed', function () {
            expect(obmService.getObmLibById("obm-service")).to.be.undefined;
        });
    });

    describe("updateObmById", function() {
        it('should publish one event if new node is added when updating obm', function () {
            var oldObm = { id: '123', node: '' };
            var newObm =  {
                nodeId: '12345678',
                service: 'ipmi-obm-service',
                config: {
                    host: '1.1.1.1',
                    user: 'user',
                    password: 'passw'
                }
            };
            var oldNode = { id: 'node123', obms: [ ] };
            var newNode = { id: 'node123', obms: [ { id: '123'} ] };
            this.sandbox.stub(waterline.obms, 'needByIdentifier').resolves(oldObm);
            this.sandbox.stub(waterline.obms, 'updateByIdentifier').resolves(newObm);
            this.sandbox.stub(waterline.nodes, 'getNodeById').resolves();
            this.sandbox.stub(eventsProtocol, 'publishNodeAttrEvent').resolves();
            waterline.nodes.getNodeById.onCall(0).resolves(oldNode);
            waterline.nodes.getNodeById.onCall(1).resolves(newNode);

            return obmService.updateObmById('123', newObm)
                .then(function () {
//                    expect(waterline.obms.updateByIdentifier).to.have.been.called.once;
                    expect(eventsProtocol.publishNodeAttrEvent).to.have.been.calledOnce;
//                    expect(eventsProtocol.publishNodeAttrEvent).to.have.been
 //                   .calledWith(oldNode, newNode, 'obms');
                });
        });

        it('should publish one event if node is removed when updating obm', function () {
            var oldObm = { id: '123', node: 'node1234' };
            var newObm =  {
                nodeId: '',
                service: 'ipmi-obm-service',
                config: {
                    host: '1.1.1.1',
                    user: 'user',
                    password: 'passw'
                }
            };
            var oldNode = { id: 'node123', obms: [ ] };
            var newNode = { id: 'node123', obms: [ { id: '123'} ] };
            this.sandbox.stub(waterline.obms, 'needByIdentifier').resolves(oldObm);
            this.sandbox.stub(waterline.obms, 'updateByIdentifier').resolves(newObm);
            this.sandbox.stub(waterline.nodes, 'getNodeById').resolves();
            this.sandbox.stub(eventsProtocol, 'publishNodeAttrEvent').resolves();
            waterline.nodes.getNodeById.onCall(0).resolves(oldNode);
            waterline.nodes.getNodeById.onCall(1).resolves(newNode);

            return obmService.updateObmById('123', newObm)
                .then(function () {
                    expect(waterline.obms.updateByIdentifier).to.have.been.called.once;
                    expect(eventsProtocol.publishNodeAttrEvent).to.have.been
                    .calledWith(oldNode, newNode, 'obms');
                });
        });

        it('should publish one event if the same node is updated when updating obm', function () {
            var oldObm = { id: '123', node: 'abcd' };
            var newObm =  {
                nodeId: 'abcd',
                service: 'ipmi-obm-service',
                config: {
                    host: '1.1.1.1',
                    user: 'user',
                    password: 'passw'
                }
            };
            var oldNode = { id: 'node123', obms: [ ] };
            var newNode = { id: 'node123', obms: [ { id: '123'} ] };
            this.sandbox.stub(waterline.obms, 'needByIdentifier').resolves(oldObm);
            this.sandbox.stub(waterline.obms, 'updateByIdentifier').resolves(newObm);
            this.sandbox.stub(waterline.nodes, 'getNodeById').resolves();
            this.sandbox.stub(eventsProtocol, 'publishNodeAttrEvent').resolves();
            waterline.nodes.getNodeById.onCall(0).resolves(oldNode);
            waterline.nodes.getNodeById.onCall(1).resolves(newNode);

            return obmService.updateObmById('123', newObm)
                .then(function () {
                    expect(waterline.obms.updateByIdentifier).to.have.been.called.once;
                    expect(eventsProtocol.publishNodeAttrEvent).to.have.been
                    .calledWith(oldNode, newNode, 'obms');
                });
        });

        it('should publish two events if new node is updated when updating obm', function () {
            var oldObm = { id: '123', node: 'abcd' };
            var newObm =  {
                nodeId: '1234',
                service: 'ipmi-obm-service',
                config: {
                    host: '1.1.1.1',
                    user: 'user',
                    password: 'passw'
                }
            };
            var oldNode = { id: 'node123', obms: [ ] };
            var newNode = { id: 'node123', obms: [ { id: '123'} ] };
            this.sandbox.stub(waterline.obms, 'needByIdentifier').resolves(oldObm);
            this.sandbox.stub(waterline.obms, 'updateByIdentifier').resolves(newObm);
            this.sandbox.stub(waterline.nodes, 'getNodeById').resolves();
            this.sandbox.stub(eventsProtocol, 'publishNodeAttrEvent').resolves();
            waterline.nodes.getNodeById.onCall(0).resolves(oldNode);
            waterline.nodes.getNodeById.onCall(1).resolves(newNode);

            return obmService.updateObmById('123', newObm)
                .then(function () {
                    expect(waterline.obms.updateByIdentifier).to.have.been.called.once;
                    expect(eventsProtocol.publishNodeAttrEvent).to.have.been.calledTwice;
                });
        });

        it('should publish no event if node is empty before and after updating obm', function () {
            var oldObm = { id: '123', node: '' };
            var newObm =  {
                nodeId: '',
                service: 'ipmi-obm-service',
                config: {
                    host: '1.1.1.1',
                    user: 'user',
                    password: 'passw'
                }
            };
            var oldNode = { id: 'node123', obms: [ ] };
            var newNode = { id: 'node123', obms: [ { id: '123'} ] };
            this.sandbox.stub(waterline.obms, 'needByIdentifier').resolves(oldObm);
            this.sandbox.stub(waterline.obms, 'updateByIdentifier').resolves(newObm);
            this.sandbox.stub(waterline.nodes, 'getNodeById').resolves();
            this.sandbox.stub(eventsProtocol, 'publishNodeAttrEvent').resolves();
            waterline.nodes.getNodeById.onCall(0).resolves(oldNode);
            waterline.nodes.getNodeById.onCall(1).resolves(newNode);

            return obmService.updateObmById('123', newObm)
                .then(function () {
                    expect(waterline.obms.updateByIdentifier).to.have.been.called.once;
                    expect(eventsProtocol.publishNodeAttrEvent).to.have.not.been.called;
                });
        });
    });

    describe("removeObmById", function() {
        it('should delete an OBM instance and publish no event if no node exists in obm', function () {
            var obm = { node: ''};
            var oldNode = undefined;
            this.sandbox.stub(waterline.obms, 'needByIdentifier').resolves(obm);
            this.sandbox.stub(waterline.nodes, 'getNodeById').resolves(oldNode);
            this.sandbox.stub(waterline.obms, 'destroyByIdentifier').resolves(obm);
            this.sandbox.stub(eventsProtocol, 'publishNodeAttrEvent').resolves();

            return obmService.removeObmById('123')
                .then(function () {
                    expect(waterline.obms.destroyByIdentifier).to.have.been.called.once;
                    expect(eventsProtocol.publishNodeAttrEvent).to.have.not.been.called;
                });
        });

        it('should delete an OBM instance and publish one event if node exists in obm', function () {
            var obm = { node: '123'};
            var oldNode = { id: '123', obms: [ ] };
            var newNode = { id: '123', obms: [ { id: 'abc'} ] };
            this.sandbox.stub(waterline.obms, 'needByIdentifier').resolves(obm);
            this.sandbox.stub(waterline.nodes, 'getNodeById').resolves();
            this.sandbox.stub(waterline.obms, 'destroyByIdentifier').resolves(obm);
            this.sandbox.stub(eventsProtocol, 'publishNodeAttrEvent').resolves();
            waterline.nodes.getNodeById.onCall(0).resolves(oldNode);
            waterline.nodes.getNodeById.onCall(1).resolves(newNode);

            return obmService.removeObmById('123')
                .then(function () {
                    expect(waterline.obms.destroyByIdentifier).to.have.been.called.once;
                    expect(eventsProtocol.publishNodeAttrEvent).to.have.been
                    .calledWith(oldNode, newNode, 'obms');
                });
        });
    });
});
