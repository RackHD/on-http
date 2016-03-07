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
        'Profiles',
        'Promise',
        'fs',
        'rimraf',
        'Assert',
        'Protocol.TaskGraphRunner',
        'Constants',
        'Services.Environment'
    )
);
function skuPackServiceFactory(
    _,
    waterline,
    Logger,
    FileLoader,
    Templates,
    Profiles,
    Promise,
    nodeFs,
    rimraf,
    assert,
    taskgraphRunner,
    Constants,
    Env
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
     * Given a nodeId, return the prioritized scope order
     * @param  {string}     nodeId
     */    
     SkuPackService.prototype.setupScope = function(nodeId) {
        var defaultScope = [ Constants.Scope.Global ];
        if(!nodeId)  {
            return Promise.resolve(defaultScope);
        }
        return waterline.nodes.needByIdentifier(nodeId)
            .then(function(node) {
                if( _.has(node, 'sku')) {
                    defaultScope.unshift(node.sku);
                }
                return defaultScope;
            });
    };

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
            var skuRoot = self.confRoot + '/' + skuName;
            try {
                var conf = JSON.parse(contents);
                // Add the static root if it is defined
                if(conf.hasOwnProperty('httpStaticRoot')) {
                    // directory references are relative to the skuName directory
                    var httpStaticRoot = skuRoot + path.resolve('/', conf.httpStaticRoot);
                    self.skuHandlers[skuName] = express.static(httpStaticRoot);
                }

                if(conf.hasOwnProperty('httpTemplateRoot')) {
                    var httpTemplateRoot = skuRoot + path.resolve('/', conf.httpTemplateRoot);
                    promises.push(self.loader.getAll(httpTemplateRoot)
                        .then(function(templates) {
                            return _.map(templates,function(contents,name) {
                                return Templates.put(name, contents, skuName);
                            });
                        }) 
                    );
                }

                if(conf.hasOwnProperty('httpProfileRoot')) {
                    var httpProfileRoot = skuRoot + path.resolve('/', conf.httpProfileRoot);
                    promises.push(self.loader.getAll(httpProfileRoot)
                        .then(function(profiles) {
                            return _.map(profiles,function(contents,name) {
                                return Profiles.put(name, contents, skuName);
                            });
                        }) 
                    );
                }

                var tasks = [];
                var taskPromises = Promise.resolve([]);
                if(conf.hasOwnProperty('taskRoot')) {
                    var taskRoot = skuRoot + path.resolve('/', conf.taskRoot);
                    taskPromises = loadWorkflowItems(skuName, taskRoot, waterline.taskdefinitions);
                    taskPromises = taskPromises.map(function(contents) {
                        var data = JSON.parse(contents);
                        tasks.push(data.injectableName);
                        data.injectableName = data.injectableName + '::' + skuName;
                        return taskgraphRunner.defineTask(data);
                    });
                }
                promises.push(taskPromises);

                if(conf.hasOwnProperty('workflowRoot')) {
                    var workflowRoot = skuRoot + path.resolve('/', conf.workflowRoot);
                    var workflowPromises = taskPromises.then(function() {
                        return loadWorkflowItems(skuName, workflowRoot, waterline.graphdefinitions);
                    }).map(function(contents) {
                        var data = JSON.parse(contents);
                        var newName = data.injectableName + '::' + skuName;
                        promises.push(Env.set(data.injectableName, newName, skuName));
                        data.injectableName = newName;
                        _.forEach(getObjectsWithKey(data,'taskName'), function(item) {
                            if(tasks.indexOf(item.taskName) !== -1) {
                                item.taskName = item.taskName + '::' + skuName;
                            }
                        });
                        return taskgraphRunner.defineTaskGraph(data);
                    });
                    promises.push(workflowPromises);
                }

                if(conf.hasOwnProperty('skuConfig')) {
                    promises.push(Env.set('config', conf.skuConfig, skuName));
                }

            } catch (error) {
                logger.warning('Unable to load sku configuration for ' + skuName);
            }
        }
        return Promise.all(promises);
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
        var skuRoot = self.confRoot + '/' + skuid;
        var cleanup;

        try {
            var conf = JSON.parse(contents);
            
            if(conf.hasOwnProperty('httpStaticRoot')) {
                if( skuid in self.skuHandlers ) {
                    delete self.skuHandlers[skuid];
                }                    
            }

            if(conf.hasOwnProperty('httpTemplateRoot')) {
                var httpTemplateRoot = skuRoot + path.resolve('/', conf.httpTemplateRoot);
                cleanup = fs.readdirAsync(httpTemplateRoot).map(function(entry) {
                    return Templates.unlink(entry,skuid);
                });
                promises.push(Promise.all(cleanup));
            }

            if(conf.hasOwnProperty('httpProfileRoot')) {
                var httpProfileRoot = skuRoot + path.resolve('/', conf.httpProfileRoot);
                cleanup = fs.readdirAsync(httpProfileRoot).map(function(entry) {
                    return Profiles.unlink(entry,skuid);
                });
                promises.push(Promise.all(cleanup));
            }

            if(conf.hasOwnProperty('workflowRoot')) {
                var workflowRoot = skuRoot + path.resolve('/', conf.workflowRoot);
                cleanup = unloadWorkflowItems(skuid, workflowRoot, waterline.graphdefinitions);
                promises.push(Promise.all(cleanup));
            }

            if(conf.hasOwnProperty('taskRoot')) {
                var taskRoot = skuRoot + path.resolve('/', conf.taskRoot);
                cleanup = unloadWorkflowItems(skuid, taskRoot, waterline.taskdefinitions);
                promises.push(Promise.all(cleanup));
            }
        } catch(error) {
            logger.warning('Unable to unregister sku configuration for ' + skuid);
            throw error;
        }
        return Promise.all(promises);
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
            var promises = _.map(conf, function (contents, name) {
                return self.registerPack(name,contents);
            });
            return Promise.all(promises);
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
                var confProperties = [
                    'httpStaticRoot',
                    'httpTemplateRoot',
                    'httpProfileRoot',
                    'workflowRoot',
                    'taskRoot'
                ];
                return confProperties.every(function(keyName) {
                    if(_.has(conf, keyName) && _.indexOf(entries, conf[keyName] ) === -1)  {
                        return false;
                    }
                    return true;
                });
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
        var contents;
        var dst;
        var installSKU;
        return fs.readFileAsync(fromRoot + '/config.json')
            .then(function(fileContents) {
                return [ fileContents, self.validatePack(fileContents, fromRoot) ];
            })
            .spread(function(fileContents) {
                contents = fileContents;
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
                dst = self.confRoot + '/' + skuID;
                installSKU = skuID;
                return [skuID, fs.readdirAsync(fromRoot), fs.mkdirAsync(dst) ];
            })
            .spread(function(sku, entries) {
                return Promise.map(entries, function(entry) {
                    var src = fromRoot + '/' + entry;
                    if( entry === 'config.json' ) {
                        return fs.renameAsync(src, dst + '.json');
                    } else {
                        return fs.renameAsync(src, dst + '/' + entry);
                    }
                });
            })
            .then(function() {
                return [dst + '.json', contents];
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

    SkuPackService.prototype.getPackInfo = function(skuid) {
        var self = this;
        return self.loader.getAll(self.confRoot)
        .then(function (conf) {
            var skuConf = conf[skuid + '.json'];
            if(skuConf) {
                var json = JSON.parse(skuConf);
                return {
                    description: json.description || null,
                    version: json.version || null
                };
            }
            return null;
        });
    };

    function getObjectsWithKey(obj, key) {
        if (_.has(obj, key)) {
            return [obj];
        }
        var res = [];
        _.forEach(obj, function(v) {
            if (typeof v === "object" && (v = getObjectsWithKey(v, key)).length) {
                res.push.apply(res, v);
            }
        });

        return res;
    }

    function loadWorkflowItems(skuName, fromRoot, dbCatalog) {
        return fs.readdirAsync(fromRoot)
            .filter(function(entry) {
                return fs.statSync(fromRoot + '/' + entry).isFile();
            })
            .map(function(entry) {
                return fs.readFileAsync(fromRoot + '/' + entry);
            })
            .filter(function(contents) {
                var data = JSON.parse(contents);
                return dbCatalog.findOne({injectableName: data.injectableName + '::' + skuName})
                    .then(function(item) {
                        return !item;
                    });
            });
    }

    function unloadWorkflowItems(skuName, fromRoot, dbCatalog) {
        return fs.readdirAsync(fromRoot)
            .filter(function(entry) {
                return fs.statSync(fromRoot + '/' + entry).isFile();
            })
            .map(function(entry) {
                return fs.readFileAsync(fromRoot + '/' + entry);
            })
            .map(function(contents) {
                var data = JSON.parse(contents);
                return dbCatalog.destroy({injectableName: data.injectableName + '::' + skuName});
            });
    }

    return new SkuPackService();
}
