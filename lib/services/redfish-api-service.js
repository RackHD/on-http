// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');
var path = require('path');

module.exports = redfishApiServiceFactory;

di.annotate(redfishApiServiceFactory, new di.Provide('Http.Api.Services.Redfish'));
di.annotate(redfishApiServiceFactory,
    new di.Inject(
        'Services.Configuration',
        'Logger',
        'Promise',
        '_',
        'fs',
        'Views',
        'ejs',
        'Http.Api.Services.Schema',
        'Errors',
        'Services.Environment',
        'Http.Services.Api.Nodes',
        'Constants',
        'validator',
        'Services.Waterline'
    )
);

function redfishApiServiceFactory(
    configuration,
    Logger,
    Promise,
    _,
    nodeFs,
    views,
    ejs,
    schemaApiService,
    Errors,
    env,
    nodeApi,
    Constants,
    validator,
    waterline
) {
    var logger = Logger.initialize(redfishApiServiceFactory);
    var fs = Promise.promisifyAll(nodeFs);
    var ready;
    var messageRegistry = fs.readFileAsync(
        path.resolve(__dirname, '../../static/DSP8010_2016.3/Base.1.0.0.json')
    ).then(function(contents) {
        return JSON.parse(contents);
    });

    function RedfishApiService() {
        var redfishV1 = [{
                root: path.resolve(__dirname, '../../static/DSP8010_2016.3/json-schema'),
                namespace: 'http://redfish.dmtf.org/schemas/v1/'
            },
            {
                root: path.resolve(__dirname, '../../static/DSP8010_2016.3/json-schema-oem'),
                namespace: 'http://redfish.dmtf.org/schemas/v1/'
            },
            {
                root: path.resolve(__dirname, '../../static/DSP-IS0005_0.1a/json-schema'),
                namespace: 'http://redfish.dmtf.org/schemas/v1/'
            }
        ];

        var schemaConfig = configuration.get('schemaConfig', redfishV1 );

        // add the redfishV1 schema if someone defined schemaConfig but left it out
        if( !_.some(schemaConfig, function(config) {
                return config.namespace.indexOf('http://redfish.dmtf.org/schemas/v1/') === 0;
            }))
        {
            logger.warning('Adding Redfish V1 schema missing from schemaConfig');
            schemaConfig.push.apply(schemaConfig, redfishV1);
        }

        ready = Promise.map(schemaConfig, function(config) {
            return schemaApiService.addNamespace(config.root, config.namespace);
        });
    }

    RedfishApiService.prototype.get = function(viewName, options) {
        return views.get(viewName, options.templateScope || ['global'])
            .then(function(view) {
                return view.contents;
            })
            .then(function(contents) {
                return JSON.parse(ejs.render(contents, options));
            });
    };

    RedfishApiService.prototype.render = function(viewName, schemaName, options) {
        var self = this;
        return Promise.props({
            sku: options.templateScope ? env.get('config', {}, [ options.templateScope[0] ]) : null,
            env: options.templateScope ? env.get('config', {}, options.templateScope ) : null,
            _: _
        }).then(function(localOptions) {
            return Promise.all([
                self.get(viewName, _.merge(options, localOptions) ),
                ready
            ])
            .spread(function(output) {
                return schemaApiService.validate(output, schemaName)
                    .then(function(result) {
                        if(result.error) {
                            throw new Error(result.error);
                        }
                        return output;
                    });
            });
        });
    };

    RedfishApiService.prototype.makeOptions = function(req, res, identifier) {
        return {
            basepath: req.swagger.operation.api.basePath,
            templateScope: res.locals.scope,
            url: req.url,
            identifier: identifier
        };
    };


    RedfishApiService.prototype.getSchemas = function(){
        return ready.then(function() {
            var arr = schemaApiService.getNamespace('http://redfish.dmtf.org/schemas/v1/');
            return arr;
        });
    };

    RedfishApiService.prototype.getSchema = function(identifier){
        var schemaURL = 'http://redfish.dmtf.org/schemas/v1/' + identifier + ".json";
        return ready.then(function() {
            var schemaContent = schemaApiService.getSchema(schemaURL);
            return schemaContent;
        });
    };

    RedfishApiService.prototype.SchemaXmlFile = function(identifier, res){
        var self= this;
        var fromRoot = process.cwd();

        return Promise.try(function() {
                var path = fromRoot + '/static/DSP8010_2016.3/metadata/' + identifier;
                return fs.readFileAsync(path, 'utf8');
            })
            .then(function(fileContent) {
                return fileContent;
            })
            .catch(function(error) {
                if(error.name === 'AssertionError') {
                    error = new Errors.NotFoundError('invalid resource: ' + error.message);
                }else if(error.name === 'Error') {
                    error = new Errors.NotFoundError('missing resource: ' + error.message);
                }
                return self.handleError(error, res);
            });
    };

    RedfishApiService.prototype.validateSchema = function(obj, schemaName) {
        return ready.then(function() {
            return schemaApiService.validate(obj, schemaName);
        });
    };

    function formatMessage(messages, messageId) {
        var message = _.get(messages, messageId);
        return _({
            '@odata.type': '#Message.1.0.0.Message',
            MessageId: 'Base.1.0.' + messageId,
            Description: message.Description,
            Message: message.Message,
            Resolution: message.Resolution,
            Severity: message.Severity
        }).omit(_.isUndefined).omit(_.isNull).value();
    }

    RedfishApiService.prototype.handleError = function(err, res, messageId, status) {
        var self = this;
        var options = {
            messages: []
        };
        status = status || err.status || 500;
        return messageRegistry.then(function(messages) {
            options.code = 'Base.1.0.GeneralError';
            options.message = messages.Messages.GeneralError.Message;
            if( err instanceof Errors.NotFoundError) {
                options.messages.push(formatMessage(messages, 'Messages.InvalidObject'));
            } else {
                options.messages.push(formatMessage(messages, 'Messages.InternalError'));
            }
            options.messages.push({
                MessageId: 'RackHD.1.0.DetailedErrorMessage',
                Message: (err instanceof Error) ? err.message : err,
                Description: 'Contains the detailed error message contents'
            });
            if( messageId ) {
                options.messages.push(formatMessage(messages, messageId));
            }
            return self.render('redfish.1.0.0.message.1.0.0.json', null, options);
        }).then(function(output) {
            res.status(status).json(output);
        });
    };

    RedfishApiService.prototype.getMessageRegistry = function(identifier) {
        if (identifier === 'Base.1.0.0') {
            return messageRegistry.then(function (messages) {
                return messages;
            });
        }
        return Promise.reject(new Errors.NotFoundError ('Message registry not found'));
    };

    RedfishApiService.prototype.getRedfishCatalog = function (req, res) {
        var self = this;
        var identifier = req.swagger.params.identifier.value;
        var nodeId = identifier.split(['-'])[1];
        var extraId = identifier.split(['-'])[0];
        if (req.swagger.params.type) {
            extraId = extraId.replace(req.swagger.params.type.raw, '');
        }
        var catalogSource = req.url.replace(req.swagger.params.identifier.value, extraId);
        return nodeApi.getNodeCatalogSourceById(nodeId, catalogSource)
            .catch(function (error) {
                return self.handleError(error, res);
            });
    };

    RedfishApiService.prototype.isRedfish = function (nodeId) {
        var isRedfish = false;
        var identifier;
        var identifierArray = nodeId.split(/-/);
        if (identifierArray.length > 1) {
            isRedfish = true;
            identifier = identifierArray[1];
        } else {
            identifier = identifierArray[0];
        }
        return {isRedfish: isRedfish, identifier:identifier};
    };


    /**
    * Get vendor name by id
    * @param {String} id: nodeId
    * @return {Object}: Object contains node vendor name and node info retrieved from database.
    */
    RedfishApiService.prototype.getVendorNameById = function(id) {
        return waterline.nodes.getNodeById(id)
        .then(function(node){
            if(!node){
                throw new Errors.NotFoundError('invalid node id.');
            }
            return {
                node: node,
                vendor: _getVendorNameByIdentifiers(node.identifiers)
            };
        });
    };

    function _getVendorNameByIdentifiers(_identifiers){
        var vendor;
        var ucsDnFormat = /^(sys|org-root)(\/[\w-]+)+$/;
        var dellFormat = /^[0-9|A-Z]{7}$/;
        _.forEach(_identifiers, function(_identifier){
            var items = _identifier.split(':');
            if (dellFormat.test(_identifier)){
                vendor = 'Dell';
                return false;
            } else if (validator.isIP(items[0]) && ucsDnFormat.test(items[1])) {
                vendor = 'Cisco';
                return false;
            }
        });
        return vendor;
    }

    return new RedfishApiService();
}
