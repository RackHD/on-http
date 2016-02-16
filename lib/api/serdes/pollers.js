'use strict';

var injector = require('../../../index').injector;
var serializer = injector.get('Http.Services.Swagger').serializer;
var deserializer = injector.get('Http.Services.Swagger').deserializer;

var pollersSerializer = serializer('Serializables.V2.Pollers');
var pollersDeserializer = deserializer('Serializables.V2.Pollers');

module.exports = {
    pollersLibGet: pollersSerializer,
    pollersLibByIdGet: pollersSerializer,
    pollersGet: pollersSerializer,
    pollersIdGet: pollersSerializer,
    pollersPost: pollersDeserializer,
    pollersPatch: pollersDeserializer,
    pollersDelete: pollersDeserializer,
    pollersDataGet: pollersSerializer,
    pollersCurrentDataGet: pollersSerializer,
    pollersPausePatch: pollersSerializer,
    pollersResumePatch: pollersSerializer
};

