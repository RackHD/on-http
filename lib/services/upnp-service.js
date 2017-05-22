// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    ip = require('ip'),
    ejs = require('ejs'),
    Server = require('node-ssdp').Server,
    Client = require('node-ssdp').Client,
    nodeVersion = process.version.substr(1);
    
module.exports = UPnPServiceFactory;
di.annotate(UPnPServiceFactory, new di.Provide('Http.Services.uPnP'));
di.annotate(UPnPServiceFactory,
    new di.Inject(
        '_',
        'Services.Waterline',
        'Logger',
        'Profiles',
        'Promise',
        'Assert',
        'Constants',
        'Errors',
        'Services.Configuration',
        'SystemUuid',
        'fs',
        'Rx',
        'Services.Messenger',
        'Result',
        'node-cache'
    )
);
function UPnPServiceFactory(
    _,
    waterline,
    Logger,
    Profiles,
    Promise,
    assert,
    Constants,
    Errors,
    configuration,
    systemUuid,
    nodeFs,
    Rx,
    messenger,
    Result,
    NodeCache
) {
    var logger = Logger.initialize(UPnPServiceFactory);
    var fs = Promise.promisifyAll(nodeFs);
        
    function UPnPService(options) {
        this.options = options || {};
        this.options.ssdpSig = 'node.js/' + nodeVersion + ' uPnP/1.1 on-http';
        this.options.ssdpTtl = 2;
        this.northbound = _.filter(configuration.get('httpEndpoints', []), 
                         _.matches({routers:'northbound-api-router'}));
        this.southbound = _.filter(configuration.get('httpEndpoints', []), 
                         _.matches({routers:'southbound-api-router'}));
        this.description = './static/upnp/upnp-device-description.xml';
        this.ssdpList = [];
        this.clientPollIntervalMs = 15000;
        this.registry = [
            {
                urn: 'upnp:rootdevice', 
                path: '/upnp/upnp-device-description.xml',
                alive: false
            }, 
            {
                urn: 'urn:schemas-upnp-org:device:on-http:1', 
                path: '/upnp/upnp-device-description.xml',
                alive: false
            }, 
            {
                urn: 'urn:schemas-upnp-org:service:api:2.0',  
                path: '/api/2.0/',
                alive: false
            }, 
            {
                urn: 'urn:dmtf-org:service:redfish-rest:1.0', 
                path: '/redfish/v1/',
                alive: false
            },
            {
                urn: 'urn:schemas-upnp-org:service:api:2.0:southbound',
                path: '/api/2.0/',
                alive: false
            },
            {
                urn: 'urn:dmtf-org:service:redfish-rest:1.0:southbound',
                path: '/redfish/v1/',
                alive: false
            }
        ];
        this.cache = new NodeCache({ stdTTL: 1800, checkperiod: 30});
    }
    
    //jshint ignore: start
    function _alive(header) {
        var reg = this.findNTRegistry(header.NT);
        if(reg.nt && false === reg.nt.alive) {
            logger.debug('advertise-alive', {usn:reg.nt, NT:header.NT});
            reg.nt.alive = true;
            this.registry[reg.index] = reg.nt;
        }    
    };
    
    function _bye(header) {
        var reg = this.findNTRegistry(header.NT);
        if(reg.nt && reg.nt.alive) {
            logger.debug('advertise-bye', {usn:reg.nt, NT:header.NT});
            var ssdp = _.find(this.ssdpList, {urn:reg.nt.urn});
            assert.object(ssdp, 'SSDP');
            ssdp.server.stop();
            reg.nt.alive = false;
            this.registry[reg.index] = reg.nt;
        }

        if (header.USN) {
            this.cache.del(header.USN);
        }
    };

    function _alertNew(key, data) {
        assert.equal(key, data.headers.USN);
        var message = _.merge({}, { type: 'present' }, data);
        this.sendSSDPAlert(message);
    };

    function _alertGone(key, data) {
        assert.equal(key, data.headers.USN);
        var message = _.merge({}, { type: 'missing' }, data);
        this.sendSSDPAlert(message);
    };

    //jshint ignore: end
    
    UPnPService.prototype.findNTRegistry = function(nt) {
        var index = _.findIndex(this.registry, _.matches({urn:nt}));
        if(-1 !== index) {
            var reg = this.registry[index];
            if(reg) {
                return { nt:reg, index:index };
            }
        }
        return {};
    };
    
    UPnPService.prototype.sendSSDPAlert = function(message) {
        return messenger.publish(
            Constants.Protocol.Exchanges.SSDP.Name,
            'ssdp.alert.' + message.headers.USN, 
            new Result({value: message})
        );
    };
    
    UPnPService.prototype.runClientObserver = function(address) {
        var self = this;
        self.client = new Client({unicastHost:address});
        self.client.on('response', function inResponse(headers, code, info) {
            var ttl = parseInt(headers['CACHE-CONTROL'].split('=')[1].trim());
            var record = self.cache.get(headers.USN);
            if (!record) {
                return self.cache.set(headers.USN,
                                      { headers: headers, info: info },
                                      ttl);
            }
            self.cache.ttl(headers.USN, ttl);
        });

        self.subscription = Rx.Observable.interval(self.clientPollIntervalMs)
        .subscribe(
            function() {
                self.client.search('ssdp:all');

                // WORKAROUND:
                // node-cache periodic data checking is not working.
                // Periodically get each key which will perform data checks
                _.forEach(self.cache.keys(), function(key) {
                    self.cache.get(key);
                });
            },
            function(error) {
                if(error) {
                    logger.error('SSDP Client Poller Error', {error:error});
                }
            }
        );
    };
    
    UPnPService.prototype.start = function() {
        var self = this;
        var endpoint = _.first(self.northbound) || {
            httpsEnabled: false, 
            address: ip.address(), 
            port: '8080'
        };
        var southPoint = _.first(self.southbound) || {
            httpsEnabled: false, 
            address: ip.address(), 
            port: '9080'
        };
        assert.object(endpoint, 'Missing Endpoint Location');

        // get the system uuid and generate the root device descriptor
        return systemUuid.getUuid()
        .then(function(uuid) {
            self.options.udn = uuid;
            return fs.readFileAsync(self.description + '.in', 'utf-8');
        })
        .then(function(content) {
            return ejs.render(content, self.options);
        })
        .then(function(content) {
            return fs.writeFileAsync(self.description, content);
        })
        .then(function() {
            self.options.udn = 'uuid:' + self.options.udn;
            return _.forEach(self.registry, function(r) {
                logger.debug('Starting SSDP/uPnP server', {usn: r});
                var ep = (_.includes(r.urn, 'southbound')) ? southPoint : endpoint;
                var loptions = {
                    location: (ep.httpsEnabled ? 'https':'http') + 
                        '://' + (ep.address !== '0.0.0.0' ? ep.address: ip.address()) + 
                        ':' + ep.port + r.path
                };
                var server = new Server(_.merge({}, self.options, loptions));
                server.addUSN(r.urn);
                server.on('advertise-alive', _alive.bind(self)); //jshint ignore: line
                server.on('advertise-bye', _bye.bind(self));    //jshint ignore: line
                server.start();
                server.sock.on('listening', function() {
                    try {
                        server.sock.addMembership(server._ssdpIp, ep.address);
                    } catch(e) {
                        logger.debug('addMembership', e);
                    }
                });
                self.ssdpList.push({urn:r.urn, server:server});
            });
        })
        .then(function() {
            // periodically send m-search requests to the southbound network
            // and publish any advertisements to the on.ssdp exchange

            self.cache.on('del', _alertGone.bind(self));
            self.cache.on('set', _alertNew.bind(self));
            return self.runClientObserver(southPoint.address);
        });
    };
    
    UPnPService.prototype.stop = function() {
        logger.info('Stopping SSDP/uPnP server(s) and client');
        if(this.subscription) {
            this.subscription.dispose();
        }
        return _.forEach(this.ssdpList, function(ssdp) {
            ssdp.server.stop();
        });
    };
    
    return new UPnPService();
}
