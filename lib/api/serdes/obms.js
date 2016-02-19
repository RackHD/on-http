'use strict';

var injector = require('../../../index').injector;
var serializer = injector.get('Http.Services.Swagger').serializer;
var deserializer = injector.get('Http.Services.Swagger').deserializer;

module.exports = {
    getObmLib: serializer('Serializables.V1.Obm'),
    getObmLibById: serializer('Serializables.V1.Obm')
};

