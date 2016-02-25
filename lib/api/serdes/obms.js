'use strict';

var injector = require('../../../index').injector;
var serializer = injector.get('Http.Services.Swagger').serializer;

module.exports = {
    getObmLib: serializer('Serializables.V1.Obm'),
    getObmLibById: serializer('Serializables.V1.Obm')
};

