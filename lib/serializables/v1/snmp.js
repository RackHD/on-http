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
            host: {
                type: 'string'
            },
            community: {
                type: 'string'
            }
        },
        required: [ 'host', 'community']
    };

    Serializable.register(SnmpFactory, Snmp);

    Snmp.prototype.serialize = function (target) {
        this.defaults(target);
        this.community = encryption.decrypt(this.community);
        return Promise.resolve(this);
    };

    Snmp.prototype.deserialize = function (target) {
        this.defaults(target);
        this.community = encryption.encrypt(this.community);
        return Promise.resolve(this);
    };

    return Snmp;
}
