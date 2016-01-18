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
        'ejs'
    )
);

function redfishValidatorFactory(
    configuration,
    Logger,
    Promise,
    _,
    nodeFs,
    templates,
    ejs
) {
    var logger = Logger.initialize(redfishValidatorFactory);
    var fs = Promise.promisifyAll(nodeFs);
    var tv4 = require('tv4');
    var ready;

    function RedfishValidator(path) {
        var rootDir = path || __dirname + '/../../static/DSP8010_1.0.0/json-schema';
        ready = fs.readdirAsync(rootDir).then(function(entries) {
            return Promise.map(entries, function(entry) {
                return fs.readFileAsync(rootDir + '/' + entry).then(function(contents) {
                    if(path.extname(entry) === '.json') {
                        try {
                            tv4.addSchema('http://redfish.dmtf.org/schemas/v1/'+ entry,
                                          JSON.parse(contents));
                        } catch(err) {
                            logger.warning('error loading schema:' + entry);
                        }
                    }
                });
            });
        });
    }

    RedfishValidator.prototype.validate = function(obj, schemaName)  {
        return Promise.all(ready).then(function() {
            return tv4.validateResult(obj, tv4.getSchema(schemaName));
        });
    };

    RedfishValidator.prototype.missing = function() {
        return tv4.missing;
    };

    RedfishValidator.prototype.render = function(templateName, schemaName, options) {
        var self = this;
        return templates.get(templateName, options.templateScope || ['global'])
            .then(function(template) {
                return template.contents;
            })
            .then(function(contents) {
                var output = JSON.parse(ejs.render(contents, options));
                console.log(output);
                return self.validate(output, 'http://redfish.dmtf.org/schemas/v1/' + schemaName)
                    .then(function(result) {
                        if(result.error) {
                            throw new Error(result.error);
                        } 
                        return output;
                    });
            });
    };

    return new RedfishValidator();
}
