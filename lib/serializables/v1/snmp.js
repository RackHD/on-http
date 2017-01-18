// Copyright 2015, EMC, Inc.

'use strict';

module.exports = SnmpFactory;

SnmpFactory.$provide = 'Serializables.V1.Snmp';
SnmpFactory.$inject = [
    'Promise',
    'Serializable',
    'Services.Encryption'
];

function SnmpFactory (Promise, Serializable, encryption) {

    function Snmp (defaults) {
        Serializable.call(this, Snmp.schema, defaults);
    }

    Snmp.schema = {
        id: 'Serializables.V1.Snmp',
        type: 'object',
        properties: {
            service: {
                type: 'string'
            },
            config: {
                type: 'object',
                required: [ 'host', 'community' ],
                host: {
                    type: 'string'
                },
                community: {
                    type: 'string'
                }
            }
        },
        required: [ 'service', 'config' ]
    };

    Serializable.register(SnmpFactory, Snmp);

    Snmp.prototype.serialize = function (target) {
        this.defaults(target);
        this.config.community = 'REDACTED';
        return Promise.resolve(this);
    };

    Snmp.prototype.deserialize = function (target) {
        this.defaults(target);
        this.config.community = encryption.encrypt(this.config.community);
        return Promise.resolve(this);
    };

    return Snmp;
}
