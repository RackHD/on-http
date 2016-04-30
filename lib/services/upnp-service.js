// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    ip = require('ip'),
    ejs = require('ejs'),
    Server = require('node-ssdp').Server,
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
        'fs'
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
    nodeFs
) {
    var logger = Logger.initialize(UPnPServiceFactory);
    var fs = Promise.promisifyAll(nodeFs);
        
    function UPnPService(options) {
        this.options = options || {};
        this.options.ssdpSig = 'node.js/' + nodeVersion + ' uPnP/1.1 on-http';
        this.options.ssdpTtl = 2;
        this.locations = _.filter(configuration.get('httpEndpoints', []), 
                         _.matches({routers:'northbound-api-router'}));
        this.bindAddress = configuration.get('ssdpBindAddress', '0.0.0.0');
        this.description = './static/upnp/upnp-device-description.xml';
        this.ssdpList = [];
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
                urn: 'urn:schemas-upnp-org:service:api:1.1',  
                path: '/api/1.1/',
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
            }
        ];
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
    
    UPnPService.prototype.start = function() {
        var self = this;
        var endpoint = _.first(self.locations);
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
            return _.forEach(self.registry, function(r) {
                logger.debug('Starting SSDP/uPnP server', {usn: r});
                self.options.location = (endpoint.httpsEnabled ? 'https':'http') + 
                    '://' + (endpoint.address !== '0.0.0.0' ? endpoint.address: ip.address()) + 
                    ':' + endpoint.port + r.path;
                var server = new Server(self.options);
                server.addUSN(r.urn);
                server.on('advertise-alive', _alive.bind(self)); //jshint ignore: line
                server.on('advertise-bye', _bye.bind(self));    //jshint ignore: line
                server.start(self.bindAddress);
                self.ssdpList.push({urn:r.urn, server:server});
            });
        });
    };
    
    UPnPService.prototype.stop = function() {
        logger.info('Stopping SSDP/uPnP server(s)');
        return _.forEach(this.ssdpList, function(ssdp) {
            ssdp.server.stop();
        });
    };
    
    return new UPnPService();
}
