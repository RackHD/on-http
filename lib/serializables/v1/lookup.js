// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di'),
    util = require('util');

module.exports = LookupFactory;

di.annotate(LookupFactory, new di.Provide('Serializables.V1.Lookup'));
di.annotate(LookupFactory,
    new di.Inject(
        'Assert',
        'Serializable'
    )
);

function LookupFactory (assert, Serializable) {
    function Lookup (defaults) {
        Serializable.call(
            this,
            Lookup.schema,
            defaults
        );
    }

    Lookup.schema = {
        id: 'Serializables.V1.Lookup',
        type: 'object',
        properties: {
            node: {
                type: 'string'
            },
            ipAddress: {
                type: 'string',
                format: 'ipv4'
            },
            macAddress: {
                type: 'string',
                pattern: '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$'
            }
        },
        required: [ 'macAddress' ]
    };

    util.inherits(Lookup, Serializable);

    Serializable.register(LookupFactory, Lookup);

    return Lookup;
}

