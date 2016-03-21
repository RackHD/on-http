// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');
var path = require('path');

module.exports = redfishValidatorFactory;

di.annotate(redfishValidatorFactory, new di.Provide('Http.Api.Services.Redfish'));
di.annotate(redfishValidatorFactory,
    new di.Inject(
        'Services.Configuration',
        'Logger',
        'Promise',
        '_',
        'fs',
        'Templates',
        'ejs',
        'Http.Api.Services.Schema',
        'Errors'
    )
);

function redfishValidatorFactory(
    configuration,
    Logger,
    Promise,
    _,
    nodeFs,
    templates,
    ejs,
    schemaApiService,
    Errors
) {
    var logger = Logger.initialize(redfishValidatorFactory);
    var fs = Promise.promisifyAll(nodeFs);
    var ready;
    var messageRegistry = fs.readFileAsync(
        path.resolve(__dirname, '../../static/DSP8010_1.0.0/DSP8011_1.0.0a.json')
    ).then(function(contents) {
        return JSON.parse(contents);
    });

    function RedfishValidator() {
        var redfishV1 = [{
                root: path.resolve(__dirname, '../../static/DSP8010_1.0.0/json-schema'),
                namespace: 'http://redfish.dmtf.org/schemas/v1/'
            },
            {
                root: path.resolve(__dirname, '../../static/DSP8010_1.0.0/json-schema-oem'),
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

    RedfishValidator.prototype.get = function(templateName, options) {
        return templates.get(templateName, options.templateScope || ['global'])
            .then(function(template) {
                return template.contents;
            })
            .then(function(contents) {
                return JSON.parse(ejs.render(contents, options));
            });
    };

    RedfishValidator.prototype.render = function(templateName, schemaName, options) {
        var self = this;
        return Promise.all([self.get(templateName, options), ready])
            .spread(function(output) {
                return schemaApiService.validate(output, schemaName)
                    .then(function(result) {
                        if(result.error) {
                            throw new Error(result.error);
                        }
                        return output;
                    });
            });
    };

    RedfishValidator.prototype.makeOptions = function(req, res, identifier) {
        return {
            basepath: req.swagger.operation.api.basePath,
            templateScope: ['global'],
            url: req.url,
            identifier: identifier
        };
    };


    RedfishValidator.prototype.getSchemas = function(){
        return ready.then(function() {
            var arr = schemaApiService.getNamespace('http://redfish.dmtf.org/schemas/v1/');

            return arr;
        });
    };

    RedfishValidator.prototype.getSchema = function(identifier){
        return ready.then(function() {
            var schemaContent = schemaApiService.getSchema(identifier);
            return schemaContent;
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

    RedfishValidator.prototype.handleError = function(err, res, messageId, status) {
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


    RedfishValidator.prototype.getMessageRegistry = function(identifier, res) {
        var self = this;
        if (identifier === 'Base.1.0.0') {
            return messageRegistry.then(function (messages) {
                return messages;
            });
        }
        return Promise.reject(new Errors.NotFoundError ('Message registry not found'))

    };

    return new RedfishValidator();
}
