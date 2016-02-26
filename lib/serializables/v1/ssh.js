// Copyright 2016, EMC, Inc.

'use strict';

module.exports = SshFactory;

SshFactory.$provide = 'Serializables.V1.Ssh';
SshFactory.$inject = [
    'Promise',
    'Serializable',
    'Services.Encryption'
];

function SshFactory (Promise, Serializable, encryption) {

    function Ssh (defaults) {
        Serializable.call(this, Ssh.schema, defaults);
    }

    Ssh.schema = {
        id: 'Serializables.V1.Ssh',
        type: 'object',
        properties: {
            host: {
                type: 'string'
            },
            user: {
                type: 'string'
            },
            password: {
                type: 'string'
            },
            publicKey: {
                type: 'string'
            },
            privateKey: {
                type: 'string'
            }
        },
        required: [ 'host', 'user' ]
    };

    Serializable.register(SshFactory, Ssh);

    Ssh.prototype.serialize = function (target) {
        this.defaults(target);
        if (this.password) {
            this.password = 'REDACTED';
        }
        if (this.privateKey) {
            this.privateKey = 'REDACTED';
        }
        return Promise.resolve(this);
    };

    Ssh.prototype.deserialize = function (target) {
        this.defaults(target);
        if (this.password) {
            this.password = encryption.encrypt(this.password);
        }
        if (this.privateKey) {
            this.privateKey = encryption.encrypt(this.privateKey);
        }
        return Promise.resolve(this);
    };

    return Ssh;
}
