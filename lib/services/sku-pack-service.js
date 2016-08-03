// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    path = require('path'),
    zlib = require('zlib'),
    tar = require('tar'),
    path = require('path');

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
        'Http.Services.Api.Workflows',
        'Constants',
        'Services.Environment',
        'osTmpdir',
        'uuid',
        'Errors'
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
    workflowApiService,
    Constants,
    Env,
    tmp,
    uuid,
    Errors
) {
    var logger = Logger.initialize(skuPackServiceFactory);
    var fs = Promise.promisifyAll(nodeFs);
    var rimrafAsync = Promise.promisify(rimraf);
    var confProperties = [
        'httpStaticRoot',
        'httpTemplateRoot',
        'httpProfileRoot',
        'workflowRoot',
        'taskRoot'
    ];
    var validConfProperties = confProperties.concat('skuConfig', 'version', 'description');

    function SkuPackService() {
        this.loader = new FileLoader();
        this.confRoot = '';
        this.skuHandlers = {};
    }

    SkuPackService.prototype.getSkus = function(query) {
        return waterline.skus.find(query);
    };

    SkuPackService.prototype.getSkusById = function(id) {
        var self = this;
        return Promise.all([
            waterline.skus.needByIdentifier(id),
            self.getPackInfo(id)
        ]).spread(function(sku, pack) {
            sku.packInfo = pack;
            return sku;
        });
    };

    SkuPackService.prototype.postSku = function(body) {
        var self = this;
        return waterline.skus.findOne({name: body.name})
        .then(function(entry) {
            if(entry) {
                var err = new Errors.BaseError('duplicate name found');
                err.status = 409;
                throw err;
            }
            return waterline.skus.create(body).then(function (sku) {
                return self.regenerateSkus().then(function () {
                    return sku;
                });
            });
        });
    };

    SkuPackService.prototype.upsertSku = function(body) {
        var self = this;
        return Promise.try(function() {
            return self.postSku(body);
        })
        .catch(Errors.BaseError, function(err) {
            if(err.status !== 409) {
                throw err;
            }
            return waterline.skus.findOne({name: body.name})
            .then(function(sku) {
                return self.patchSku(sku.id, body);
            });
        });
    };

    SkuPackService.prototype.regenerateSkus = function(){
        return waterline.nodes.find({}).then(function (nodes) {
            return Promise.map(nodes, function (node) {
                return workflowApiService.createAndRunGraph({
                    name: 'Graph.GenerateSku',
                    options: {
                        defaults: {
                            nodeId: node.id
                        }
                    }
                });
            });
        });
    };

    SkuPackService.prototype.skuPackHandler = function(req,res,skuid) {
        var self = this;
        var name = uuid('v4');
        var tmpDir = tmp();

        return Promise.try(function() {
            assert.ok(req.headers['content-type']);
            if( _.includes(req.headers['content-type'], 'multipart/form-data')) {
                var multer  = require('multer');
                var storage = multer.diskStorage({
                    destination: function (req, file, cb) {
                        cb(null, tmpDir);
                    },
                    filename: function (req, file, cb) {
                        cb(null, file.fieldname + '-' + name);
                    }
                });
                var upload = multer({ storage: storage });
                return Promise.fromNode( upload.single('file').bind(null, req, res));
            }
            return Promise.resolve();
        })
        .then(function() {
            if(req.file) {
                return nodeFs.createReadStream( req.file.path );
            }
            return req;
        })
        .then(function(start) {
            return new Promise(function(resolve, reject) {
                start.pipe(zlib.createGunzip())
                .on('error', function() {
                    reject(new Errors.BadRequestError('Invalid gzip'));
                })
                .pipe(tar.Extract({path: tmpDir + '/' + name}))
                .on('end', function() {
                    return self.installPack(tmpDir + '/' + name, skuid)
                        .spread(function(skuId, contents) {
                            return self.registerPack(skuId, contents)
                            .then(function() {
                                return self.regenerateSkus();
                            }).then(function() {
                                resolve({id: skuId});
                            });
                        })
                        .catch(function(e) {
                            reject(new Errors.BadRequestError(e.message));
                        })
                        .finally(function() {
                            return Promise.all([
                                rimrafAsync(tmpDir + '/' + name),
                                req.file ? fs.unlinkAsync( req.file.path ) : Promise.resolve()
                            ]);

                        });
                })
                .on('error', function() {
                    reject(new Errors.InternalServerError('Failed to serve file request'));
                });
            });
        });
    };

    SkuPackService.prototype.patchSku = function(id, body) {
      var self = this;
      return waterline.skus.updateByIdentifier(
            id,
            body
        ).then(function (sku) {
            return self.regenerateSkus()
                .then(function () {
                    return sku;
            });
        });
    };

    SkuPackService.prototype.getNodesSkusById = function(id) {
        return waterline.skus.needByIdentifier(id)
            .then(function (sku) {
                return waterline.nodes.find({ sku: sku.id });
        });
    };

    SkuPackService.prototype.putPackBySkuId  = function(req, res) {
        var self = this;
        return waterline.skus.needByIdentifier(req.swagger.params.identifier.value)
            .then(function() {
                return self.skuPackHandler(req,res,req.swagger.params.identifier.value);
            });
    };

    SkuPackService.prototype.deleteSkuPackById = function(id) {
        var self = this;
        return waterline.skus.needByIdentifier(id)
            .then(function() {
                return self.deletePack(id);
            });
    };

    SkuPackService.prototype.deleteSkuById = function(id) {
        var self = this;
        return waterline.skus.needByIdentifier(id)
        .then(function() {    
            return self.deletePack(id);
        })
        .then(function() {
            return waterline.skus.destroyByIdentifier(id)
            .then(function (sku) {
                return self.regenerateSkus()
                .then(function() {
                    return sku;
                });
            });
        });
    };

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
                if (node.sku) {
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
    SkuPackService.prototype.registerPack = function(skuId, contents) {
        var promises = [];
        var self = this;
        var skuRoot = self.confRoot + '/' + skuId;

        return waterline.skus.findOne({id: skuId})
        .then(function(conf) {
            if(!conf) {
                throw new Errors.NotFoundError(skuId + ' was not found');
            }

            return Promise.try(function() {
                // Add the static root if it is defined
                if(conf.httpStaticRoot) {
                    // directory references are relative to the skuId directory
                    var httpStaticRoot = skuRoot + path.resolve('/', conf.httpStaticRoot);
                    self.skuHandlers[skuId] = express.static(httpStaticRoot);
                }
            }).then(function() {
                if(conf.httpTemplateRoot) {
                    var httpTemplateRoot = skuRoot + path.resolve('/', conf.httpTemplateRoot);
                    return self.loader.getAll(httpTemplateRoot)
                    .then(function(templates) {
                        return _.map(templates,function(file, name) {
                            return Templates.loadFile(name, file.path, file.contents, skuId);
                        });
                    });
                }
            }).then(function() {
                if(conf.httpProfileRoot) {
                    var httpProfileRoot = skuRoot + path.resolve('/', conf.httpProfileRoot);
                    return self.loader.getAll(httpProfileRoot)
                    .then(function(profiles) {
                        return _.map(profiles,function(file, name) {
                            return Profiles.loadFile(name, file.path, file.contents, skuId);
                        });
                    });
                }
            }).then(function() {
                var tasks = [];
                if(conf.taskRoot) {
                    var taskRoot = skuRoot + path.resolve('/', conf.taskRoot);
                    return loadWorkflowItems(skuId, taskRoot)
                    .map(function(contents) {
                        var data = JSON.parse(contents);
                        tasks.push(data.injectableName);
                        data.injectableName = data.injectableName + '::' + skuId;
                        return workflowApiService.defineTask(data);
                    })
                    .then(function(taskPromises) {
                        return [tasks, taskPromises];
                    });
                }
                return [ tasks ];
            }).spread(function(tasks) {
                var envConfig = {};
                if(conf.workflowRoot) {
                    var workflowRoot = skuRoot + path.resolve('/', conf.workflowRoot);
                    return loadWorkflowItems(skuId, workflowRoot)
                    .map(function(contents) {
                        var data = JSON.parse(contents);
                        var newName = data.injectableName + '::' + skuId;
                        _.set(envConfig, data.injectableName, newName);
                        data.injectableName = newName;
                        _.forEach(getObjectsWithKey(data,'taskName'), function(item) {
                            if(tasks.indexOf(item.taskName) !== -1) {
                                item.taskName = item.taskName + '::' + skuId;
                            }
                        });
                        return workflowApiService.defineTaskGraph(data);
                    })
                    .then(function(workflowPromises) {
                        return [ envConfig, workflowPromises ];
                    });
                }
                return [ envConfig ];
            }).spread(function(envConfig) {
                var config = _.merge({}, conf.skuConfig || {}, envConfig);
                if(!_.isEmpty(_.keys(config))) {
                    return Env.set('config', config, skuId);
                }
            });
        })
        .catch(function(err) {
            logger.warning('Unable to load sku configuration for ' + skuId + ':' + err.message);
            throw err;
        });
    };


    /**
     * Unregister a SKU package into the service
     * @param  {String}     skuid the skuid being unregistered
     * @param  {String}     contents the file contents
     * @return {Promise}
     */
    SkuPackService.prototype.unregisterPack = function(skuid, conf) {
        var promises = [];
        var self = this;
        var skuRoot = self.confRoot + '/' + skuid;
        var cleanup;

        return Promise.try(function() {
            if(conf.httpStaticRoot) {
                if( skuid in self.skuHandlers ) {
                    delete self.skuHandlers[skuid];
                }
            }

            if(conf.httpTemplateRoot) {
                var httpTemplateRoot = skuRoot + path.resolve('/', conf.httpTemplateRoot);
                cleanup = fs.readdirAsync(httpTemplateRoot).map(function(entry) {
                    return Templates.unlink(entry,skuid);
                });
                promises.push(Promise.all(cleanup));
            }

            if(conf.httpProfileRoot) {
                var httpProfileRoot = skuRoot + path.resolve('/', conf.httpProfileRoot);
                cleanup = fs.readdirAsync(httpProfileRoot).map(function(entry) {
                    return Profiles.unlink(entry,skuid);
                });
                promises.push(Promise.all(cleanup));
            }

            if(conf.workflowRoot) {
                var workflowRoot = skuRoot + path.resolve('/', conf.workflowRoot);
                cleanup = unloadWorkflowItems(skuid, workflowRoot, waterline.graphdefinitions);
                promises.push(Promise.all(cleanup));
            }

            if(conf.taskRoot) {
                var taskRoot = skuRoot + path.resolve('/', conf.taskRoot);
                cleanup = unloadWorkflowItems(skuid, taskRoot, waterline.taskdefinitions);
                promises.push(Promise.all(cleanup));
            }

            return Promise.all(promises);
        }).catch(function(error) {
            logger.warning('Unable to unregister sku configuration for ' + skuid);
            throw error;
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
        return Promise.try(function() {
            assert.ok(!_.isUndefined(waterline.skus), 'skus model is undefined');
            return waterline.skus.find({});
        })
        .then(function(skus) {
            return Promise.map(skus, function(skuContents) {
                return self.registerPack(skuContents.id, skuContents)
                .catch(function() {
                    logger.warning('Unable to startup pack for sku: ' + skuContents.id);
                });
            });
        })
        .catch(function(err) {
            logger.warning('Unable to startup sku pack service: ' + err);
        });
    };

    /**
     * Validate a SKU pack
     * @param  {String}     contents The configuration file contents
     * @param  {String}     fromRoot The path to the configuration file
     * @return {Promise}
     */
    SkuPackService.prototype.validatePack = function(contents, fromRoot, options) {
        options = options || {};

        return Promise.try(function() {
            var conf = JSON.parse(contents);
            return fs.readdirAsync(fromRoot)
            .then(function(entries) {
                _.forEach(confProperties, function(keyName) {
                    if(_.has(conf, keyName) && _.indexOf(entries, conf[keyName] ) === -1)  {
                        throw new Errors.BadRequestError('invalid value for ' + keyName + ' in config.json');
                    }
                });
            })
            .then(function() {
                if(options.validateSku) {
                    if(!conf.hasOwnProperty('rules') || !conf.hasOwnProperty('name')) {
                        throw new Errors.BadRequestError('rules or name is missing in config.json');
                    }
                }
            });
        })
        .catch(function(err) {
            throw new Errors.BadRequestError('invalid JSON in config.json: ' + err.message);
        });
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
        return fs.readFileAsync(fromRoot + '/config.json')
        .then(function(fileContents) {
            contents = fileContents;
            return self.validatePack(fileContents, fromRoot, {
                validateSku: !_.isUndefined(skuid)
            });
        })
        .then(function() {
            if(skuid === undefined)  {
                var conf = JSON.parse(contents);
                return waterline.skus.findOne({name: conf.name})
                .then(function(entry) {
                    if(entry) {
                        var err = new Errors.BaseError('duplicate name found');
                        err.status = 409;
                        throw err;
                    }
                    return waterline.skus.create(_.pick(conf, ['name', 'rules', 'discoveryGraphName', 'discoveryGraphOptions'] ));
                })
                .then(function(sku) {
                    return sku.id;
                });
            }
            return skuid;
        })
        .then(function(skuId) {
            return fs.statAsync(self.confRoot + '/' + skuId).then(function(stat) {
                    if(stat.isDirectory())  {
                        return self.deletePack(skuId);
                    }
                    return skuId;
                })
                .catch(function() {
                    return skuId;
                });
        })
        .then(function(skuId) {
            var conf = JSON.parse(contents);
            return [
                skuId,
                fs.readdirAsync(fromRoot), 
                fs.mkdirAsync(self.confRoot + '/' + skuId),
                waterline.skus.update({id: skuId}, _.pick(conf, validConfProperties))
            ];
        })
        .spread(function(skuId, entries) {
            var conf = JSON.parse(contents);
            var properties = _.pick(conf, confProperties);
            var dst = self.confRoot + '/' + skuId;
            return Promise.filter(entries, function(entry) {
                return -1 !== _.values(properties).indexOf(entry);
            })
            .map(function(entry) {
                var src = fromRoot + '/' + entry;
                return fs.moveAsync(src, dst + '/' + entry);
            })
            .then(function() {
                return skuId;
            });
        })
        .then(function(skuId) {
            return [skuId, contents];
        });
    };


    /**
     * Delete a SKU pack
     * @param  {String}     skuid The skuid of the sku's package that shall be removed
     * @return {Promise}
     */
    SkuPackService.prototype.deletePack = function(skuid) {
        var self = this;

        return Promise.try(function() {
            // We run as root, so double check the parameters before removing files
            assert.ok(self.confRoot.length, 'confRoot is malformed');
            assert.ok(skuid.length, 'skuid ' + skuid + ' is malformed');
            return waterline.skus.findOne({id: skuid});
        })
        .then(function(conf) {
            return [ conf, self.unregisterPack(skuid, conf) ];
        })
        .spread(function(conf) {
            return waterline.skus.update({id: skuid}, _.transform(conf, function(result, n, key) {
                result[key] = _.includes(validConfProperties, key) ? null : n;
            }));
        })
        .then(function() {
            assert.ok(self.confRoot.length, 'confRoot is malformed');
            return rimrafAsync(self.confRoot + '/' + skuid);
        })
        .then(function() {
            return skuid;
        });
    };

    SkuPackService.prototype.getPackInfo = function(skuid) {
        var self = this;
        return waterline.skus.findOne({id: skuid})
        .then(function(contents) {
            contents = contents || {};
            return {
                description: contents.description || null,
                version: contents.version || null
            };
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

    function loadWorkflowItems(skuId, fromRoot) {
        return fs.readdirAsync(fromRoot)
        .filter(function(entry) {
            return fs.statSync(fromRoot + '/' + entry).isFile();
        })
        .map(function(entry) {
            return fs.readFileAsync(fromRoot + '/' + entry);
        });
    }

    function unloadWorkflowItems(skuId, fromRoot, dbCatalog) {
        return fs.readdirAsync(fromRoot)
        .filter(function(entry) {
            return fs.statSync(fromRoot + '/' + entry).isFile();
        })
        .map(function(entry) {
            return fs.readFileAsync(fromRoot + '/' + entry);
        })
        .map(function(contents) {
            var data = JSON.parse(contents);
            return dbCatalog.destroy({injectableName: data.injectableName + '::' + skuId});
        });
    }

    return new SkuPackService();
}
