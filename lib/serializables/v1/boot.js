// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = BootFactory;

di.annotate(BootFactory, new di.Provide('Serializables.V1.Boot'));
di.annotate(BootFactory,
    new di.Inject(
        'Promise',
        'Serializable'
    )
);

function BootFactory (
    Promise,
    Serializable
) {
    function Boot (defaults) {
        Serializable.call(
            this,
            Boot.schema,
            defaults
        );
    }

    Boot.schema = {
        id: 'Serializables.V1.Boot',
        type: 'object',
        properties: {
            profile: {
                type: 'string'
            },
            options: {
                type: 'object'
            }
        },
        required: [ 'profile', 'options' ]
    };

    Serializable.register(BootFactory, Boot);

    return Boot;
}
