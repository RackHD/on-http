// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

var di = require('di');

module.exports = wsmanServiceFactory;
di.annotate(wsmanServiceFactory, new di.Provide('Http.Services.Wsman'));
di.annotate(wsmanServiceFactory,
    new di.Inject(
        'Services.Waterline',
        'Services.Encryption',
        'Services.Configuration',
        'JobUtils.WsmanTool',
        'Errors'
    )
);
function wsmanServiceFactory(
    waterline,
    encryption,
    configuration,
    WsmanTool,
    errors
) {

    //var logger = Logger.initialize(wsmanServiceFactory);

    function WsmanService() {
        this.dellConfigs = null;
    }

    WsmanService.prototype.init = function (node) {
    	var self = this;
        return waterline.obms.findByNode(node.id, 'dell-wsman-obm-service', true)
        .then(function(obm) {
            if (!obm) { throw new errors.NotFoundError('Failed to find Wsman obm settings'); }
            self.dellConfigs = configuration.get('dell');
            if (!self.dellConfigs) {
            	throw new errors.NotFoundError(
                    'Configuration for WSMan web services is not defined in wsmanConfig.json.');
            }
            
            self.wsman = new WsmanTool(self.dellConfigs.gateway, {
                verifySSL: false,
                recvTimeoutMs: 30000
            });
            
            self.target = {
                address: obm.config.host,
                userName: obm.config.user,
                password: encryption.decrypt(obm.config.password)
            };
        });
    };


    WsmanService.prototype.getLog = function(node, logType) {
        var self = this;

        return self.init(node)
        .then(function(){
            if (!self.dellConfigs.services.inventory.logs) {
            	throw new errors.NotFoundError(
                    'Dell inventory.logs web service is not defined in wsmanConfig.json.');
            }
            var url = self.dellConfigs.services.inventory.logs;
            url = url.replace(/{type}/, logType.toUpperCase());

            return self.wsman.clientRequest(url, 'POST', self.target)
            .then(function(response) {
                return response.body;
            });
        });
    };


     WsmanService.prototype.isDellSystem = function(identifier) {
        var result = {node: undefined, isDell: false, isRedfishCapable: false};
        return waterline.nodes.getNodeById(identifier)
        .then(function(node){
            if(!node){
                throw new errors.NotFoundError('invalid node id.');
            }
            result.node = node;
            for(var i=0; i<node.identifiers.length; i+=1) {
                if(/^[0-9|A-Z]{7}$/.test(node.identifiers[i])){
                    result.isDell = true;
                    break;
                }
            }
            return node;        
        }).then(function(node){
            Promise.resolve(waterline.obms.findByNode(node.id, 'redfish-obm-service', true))
            .then(function (obmSetting) {
                if(obmSetting){
                    result.isRedfishCapable = true;
                }
            });
            return result;
        });
    };

    return new WsmanService();
}
