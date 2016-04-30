// Copyright 2016, EMC, Inc.

'use strict';

require('../../helper');

describe("UPnP Service", function() {
    var uPnPService;
    var systemUuid;
    var fs;
    var ejs = require('ejs');
    var SSDP = require('node-ssdp').Server;
    var EventEmitter = require('events').EventEmitter;
    var emitter = new EventEmitter();
    var udn = '<%= udn %>';
    var uuid = '66ddf9c7-a3a4-47fc-b603-60737d1f15a8';
    var sandbox = sinon.sandbox.create();
    
    before(function() {
        helper.setupInjector([
            helper.require("/lib/services/upnp-service")
        ]);
        helper.injector.get('Services.Configuration')
        .set('httpEndpoints', [{
            'port': 9999,
            'address': '1.2.3.4',
            'httpsEnabled': false,
            'routers': 'northbound-api-router'
            }]
        );
        
        uPnPService = helper.injector.get('Http.Services.uPnP');
        systemUuid = helper.injector.get('SystemUuid');
        fs = helper.injector.get('fs');
        
        sandbox.stub(fs, 'writeFileAsync');
        sandbox.stub(fs, 'readFileAsync');
        sandbox.stub(ejs, 'render');
        sandbox.stub(systemUuid, 'getUuid');
        sandbox.stub(SSDP.prototype, 'start').resolves();
        sandbox.stub(SSDP.prototype, 'stop').resolves();
        sandbox.stub(SSDP.prototype, 'addUSN').resolves();
        
        systemUuid.getUuid.resolves(uuid);
        fs.readFileAsync.resolves(udn);
        fs.writeFileAsync.resolves();
    });

    beforeEach(function() {
        sandbox.reset();
    });

    helper.after(function () {
        sandbox.restore();
    });

    describe('service control', function() {
        
        it('should start service', function() {
            return uPnPService.start()
            .then(function(data) {
                expect(data).to.equal(uPnPService.registry);
            });
        });
        
        it('should stop service', function() {
            return expect(uPnPService.stop()).to.be.ok;
        });
        
        it('should find valid NT entry', function() {
            var nt = uPnPService.registry[0].urn;
            var urn = { nt: uPnPService.registry[0], index: 0 };
            return expect(uPnPService.findNTRegistry(nt)).to.deep.equal(urn);
        });
        
        it('should find no NT entries', function() {
            return expect(uPnPService.findNTRegistry('xyz')).to.deep.equal({});
        });
        
        it('should run advertise-alive event', function(done) {
            SSDP.prototype.on = function(event, callback) {
                emitter.on(event, function(header) {
                    callback.call(uPnPService, header);
                });
            };
            return uPnPService.start()
            .then(function() {
                expect(uPnPService.registry[0].alive).to.equal(false);
                emitter.emit('advertise-alive', {NT: uPnPService.registry[0].urn});
                setImmediate(function() {
                    try {
                        expect(uPnPService.registry[0].alive).to.equal(true);
                        done();
                    } catch(e) {
                        done(e);
                    }
                });
            });
        });
        
        it('should run advertise-bye event', function(done) {
            SSDP.prototype.on = function(event, callback) {
                emitter.on(event, function(header) {
                    callback.call(uPnPService, header);
                });
            };
            return uPnPService.start()
            .then(function() {
                uPnPService.registry[0].alive = true;
                emitter.emit('advertise-bye', {NT: uPnPService.registry[0].urn});
                setImmediate(function() {
                    try {
                        expect(uPnPService.registry[0].alive).to.equal(false);
                        done();
                    } catch(e) {
                        done(e);
                    }
                });
            });
        });
    });
});

