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
        'Templates',
        'Promise',
        'fs',
        'rimraf',
        'Assert'
    )
);
function skuPackServiceFactory(
    _,
    waterline,
    Logger,
    FileLoader,
    Templates,
    Promise,
    nodeFs,
    rimraf,
    assert
) {
    var logger = Logger.initialize(skuPackServiceFactory);
    var fs = Promise.promisifyAll(nodeFs);
    var rimrafAsync = Promise.promisify(rimraf);

    function SkuPackService() {
        this.loader = new FileLoader();
        this.confRoot = '';
        this.skuHandlers = {};
    }

    /**
     * Implement an Express static file handler
     * @param  {Object}     req
     * @param  {Object}     res
     * @param  {Function}   next
     */
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

    /**
     * Register a SKU package into the service
     * @param  {String}     name the filename
     * @param  {String}     contents the file contents
     * @return {Promise[]}    
     */
    SkuPackService.prototype.registerPack = function(name, contents) {
        var promises = [];
        var self = this;
        if(path.extname(name) === '.json') {
            var skuName = path.basename(name, '.json');
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


    /**
     * Unregister a SKU package into the service
     * @param  {String}     skuid the skuid being unregistered
     * @param  {String}     contents the file contents
     * @return {Promise}    
     */
    SkuPackService.prototype.unregisterPack = function(skuid, contents) {
        var promises = [];
        var self = this;
        try {
            var conf = JSON.parse(contents);
            
            if(conf.hasOwnProperty('httpStaticRoot')) {
                if( skuid in self.skuHandlers ) {
                    delete self.skuHandlers[skuid];
                }                    
            }

            if(conf.hasOwnProperty('httpTemplateRoot')) {
                var httpTemplateRoot = path.resolve('/', conf.httpTemplateRoot);
                httpTemplateRoot = self.confRoot + '/' + skuid + httpTemplateRoot;
                promises.push(fs.readdirAsync(httpTemplateRoot));
            }
        } catch(error) {
            logger.warning('Unable to unregister sku configuration for ' + skuid);
            throw error;
        }
        return Promise.map(promises, function(entries) {
            return Promise.all(_.map(entries, function(entry) {
                return Templates.unlink(entry, skuid);
            }));
        });
    };

    /**
     * Start the SKU pack service
     * @param  {String}     confRoot The root path of the sku pack configuration files
     * @return {Promise}    
     */
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

    /**
     * Validate a SKU pack
     * @param  {String}     contents The configuration file contents
     * @param  {String}     fromRoot The path to the configuration file
     * @return {Promise}    
     */
    SkuPackService.prototype.validatePack = function(contents, fromRoot) {
        try {
            var conf = JSON.parse(contents);
            return fs.readdirAsync(fromRoot).then(function(entries) {                
                if(conf.hasOwnProperty('httpStaticRoot')) {
                    if(_.indexOf(entries, conf.httpStaticRoot) === -1) {
                        return false;
                    }
                }
                if(conf.hasOwnProperty('httpTemplateRoot')) {
                    if(_.indexOf(entries, conf.httpTemplateRoot) === -1) {
                        return false;
                    }
                }
                return true;
            });
        } catch(error) {
            return Promise.reject(error);
        }
        return Promise.resolve(true);
    };

    /**
     * Install a SKU pack
     * @param  {String}     fromRoot The path to the configuration file
     * @param  {String}     skuid Specify the skuid or undefined to create a new SKU id
     * @return {Promise}    
     */
    SkuPackService.prototype.installPack = function(fromRoot, skuid) {
        var self = this;
        return fs.readFileAsync(fromRoot + '/config.json')
            .then(function(contents) {
                return self.validatePack(contents, fromRoot)
                    .then(function() {
                        if(skuid === undefined)  {
                            var conf = JSON.parse(contents);
                            if(!conf.hasOwnProperty('rules') || !conf.hasOwnProperty('name')) {
                                throw new Error('rules or name is missing');
                            }
                            return waterline.skus.create({name: conf.name, rules: conf.rules})
                                .then(function(sku) {
                                    return sku.id;
                                });
                        }
                        return skuid;
                    })
                    .then(function(skuID) {
                        return fs.statAsync(self.confRoot + '/' + skuID).then(function(stat) {
                                if(stat.isDirectory())  {
                                    return self.deletePack(skuID);
                                }
                                return skuID;
                            })
                            .catch(function() {
                                return skuID;
                            });
                    })
                    .then(function(skuID) {
                        return [skuID, fs.readdirAsync(fromRoot)];
                    })
                    .spread(function(sku, entries) {
                        var dst = self.confRoot + '/' + sku;                        
                        return fs.mkdirAsync(dst)
                            .then(function() {
                                return Promise.all(_.map(entries, function(entry) {
                                    var src = fromRoot + '/' + entry;
                                    if( entry === 'config.json' ) {
                                        return fs.renameAsync(src, dst + '.json');
                                    } else {
                                        return fs.renameAsync(src, dst + '/' + entry);
                                    }
                                }));
                            })
                            .then(function() {
                                return [dst + '.json', contents];
                            });
                    });
                });
    };

    /**
     * Delete a SKU pack
     * @param  {String}     skuid The skuid of the sku's package that shall be removed
     * @return {Promise}    
     */
    SkuPackService.prototype.deletePack = function(skuid) {
        var self = this;

        // We run as root, so double check the parameters before removing files
        assert.ok(self.confRoot.length, 'confRoot is malformed');
        assert.ok(skuid.length, 'skuid is malformed');
        return fs.readFileAsync(self.confRoot + '/' + skuid + '.json')
            .then(function(contents) {
                return self.unregisterPack(skuid, contents);
            })
            .then(function() {
                assert.ok(self.confRoot.length, 'confRoot is malformed');
                return rimrafAsync(self.confRoot + '/' + skuid);
            })
            .then(function() {
                assert.ok(self.confRoot.length, 'confRoot is malformed');
                return fs.unlinkAsync(self.confRoot + '/' + skuid + '.json');
            })
            .then(function() {
                return skuid;
            });
    };

    return new SkuPackService();
}
