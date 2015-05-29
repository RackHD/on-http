// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di');

module.exports = NodeFactory;

di.annotate(NodeFactory, new di.Provide('Serializables.V1.Node'));
di.annotate(NodeFactory,
    new di.Inject(
        'Promise',
        'Serializable',
        'Serializables.V1.Obm'
    )
);

function NodeFactory (
    Promise,
    Serializable,
    ObmSerializable
) {
    function Node (defaults) {
        Serializable.call(
            this,
            Node.schema,
            defaults
        );
    }

    Node.schema = {
        id: 'Serializables.V1.Node',
        type: 'object',
        properties: {
            name: {
                type: 'string'
            },
            type: {
                enum: [ 'compute', 'switch', 'dae', 'pdu' ]
            },
            obmSettings: {
                type: 'array',
                items: {
                    $ref: 'Serializables.V1.Obm'
                }
            },
        },
        required: [ 'name' ]
    };

    Serializable.register(NodeFactory, Node);

    Node.prototype.deserialize = function (target) {
        var self = this;

        this.defaults(target);

        if (this.obmSettings) {
            return Promise.map(this.obmSettings, function (item) {
                var serializable = new ObmSerializable();

                return serializable.deserialize(item);
            }).then(function (settings) {
                self.obmSettings = settings;

                return self;
            });
        }

        return Promise.resolve(this);
    };

    return Node;
}
