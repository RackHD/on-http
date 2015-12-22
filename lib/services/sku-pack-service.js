// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');
var express = require('express');
var path = require('path');

module.exports = skuPackServiceFactory;
di.annotate(skuPackServiceFactory, new di.Provide('Http.Services.SkuPack'));
di.annotate(skuPackServiceFactory,
    new di.Inject(
        '_',
        'Services.Waterline',
        'Logger',
        'FileLoader',
        'Templates'
    )
);
function skuPackServiceFactory(
    _,
    waterline,
    Logger,
    FileLoader,
    Templates
) {
    var logger = Logger.initialize(skuPackServiceFactory);

    function SkuPackService() {
        this.loader = new FileLoader();
        this.confRoot = '';
        this.skuHandlers = {};
    }

    SkuPackService.prototype.static = function(req, res, next) {
        var self = this;
        if(res.locals.identifier !== undefined) {
            waterline.nodes.needByIdentifier(res.locals.identifier).then(function(node) {
                if(node.hasOwnProperty('sku') && self.skuHandlers.hasOwnProperty(node.sku)) {
                    res.locals.scope.unshift(node.sku);
                    self.skuHandlers[node.sku](req,res,next);
                } else {
                    next();
                }
            }).catch( function() {
                next();
            });
        } else {
            next();
        }
    };

    SkuPackService.prototype.registerPack = function(name, contents) {
        var promises = [];
        var self = this;
        if(path.extname(name) === '.js') {
            var skuName = path.basename(name, '.js');
            try {
                var conf = JSON.parse(contents);
                // Add the static root if it is defined
                if(conf.hasOwnProperty('httpStaticRoot')) {
                    // directory references are relative to the skuName directory
                    var httpStaticRoot = path.resolve('/', conf.httpStaticRoot);
                    httpStaticRoot = self.confRoot + '/' + skuName + httpStaticRoot;
                    self.skuHandlers[skuName] = express.static(httpStaticRoot);
                }

                if(conf.hasOwnProperty('httpTemplateRoot')) {
                    var httpTemplateRoot = path.resolve('/', conf.httpTemplateRoot);
                    httpTemplateRoot = self.confRoot + '/' + skuName + httpTemplateRoot;
                    promises.push(self.loader.getAll(httpTemplateRoot)
                        .then(function(templates) {
                            return _.map(templates,function(contents,name) {
                                return Templates.put(name, contents, skuName);
                            });
                        }) );
                }
            } catch (error) {
                logger.warning('Unable to load sku configuration for ' + skuName);
            }
        }
        return promises;
    };

    SkuPackService.prototype.start = function(confRoot) {
        var self = this;
        self.confRoot = confRoot;

        return self.loader.getAll(self.confRoot).then(function (conf) {
            return [].concat.apply([], _.map(conf, function(contents,name) {
                return self.registerPack(name,contents);
            }));
        }).catch(function() {
            logger.warning('Unable to startup sku pack service, check conf root: ' + confRoot);
        });
    };

    return new SkuPackService();
}
