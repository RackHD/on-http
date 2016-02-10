'use strict';

var injector = require('../../../index').injector;
var serializer = injector.get('Http.Services.Swagger').serializer;
var deserializer = injector.get('Http.Services.Swagger').deserializer;

module.exports = {
    nodesPost: deserializer('Serializables.V1.Node'),
    nodesPut: deserializer('Serializables.V1.Node'),
    nodesPatch: deserializer('Serializables.V1.Node'),
    nodesGet: serializer('Serializables.V1.Node')
};

