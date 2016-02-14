'use strict';

var injector = require('../../../index').injector;
var serializer = injector.get('Http.Services.Swagger').serializer;
var deserializer = injector.get('Http.Services.Swagger').deserializer;

module.exports = {
    nodesGetAll: serializer('Serializables.V1.Node'),
    nodesPost: deserializer('Serializables.V1.Node'),
    nodesGetById: serializer('Serializables.V1.Node'),
    nodesPatchById: deserializer('Serializables.V1.Node'),
    nodesGetObmById: serializer('Serializables.V1.Obm'),
    nodesPostObmById: deserializer('Serializables.V1.Obm'),

    nodesPut: deserializer('Serializables.V1.Node'),
};

