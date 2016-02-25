// Copyright 2016, EMC, Inc.
/* jshint node:true */

"use strict";

describe("Http.Services.Api.Obms", function () {
    var obmService;
    var Promise;
    var chai = require('chai');
    chai.use(require('chai-string'));
    before("Http.Services.Api.Obms before", function() {
        helper.setupInjector([
            helper.require("/lib/services/obm-api-service.js")
        ]);

        Promise = helper.injector.get('Promise');
        obmService = helper.injector.get("Http.Services.Api.Obms");

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
            expect(temp.toString()).to.equalIgnoreCase(mockObms.toString());
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
            expect(temp.toString()).to.equalIgnoreCase(mockObm.toString());
        });

        it('should return undefined, when invalid id  is passed', function () {
            expect(obmService.getObmLibById("obm-service")).to.be.undefined;
        });
    });

});
