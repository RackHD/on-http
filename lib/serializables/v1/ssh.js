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
        anyOf: [
            {
                required: ['host', 'user', 'password'],
                properties: {
                    $ref: '#/definitions/credentials'
                }
            },
            {
                required: ['host', 'user', 'privateKey'],
                properties: {
                    $ref: '#/definitions/credentials'
                }
            }
        ],
        definitions: {
            credentials: {
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
            }
        }
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
        var self = this;

        self.defaults(target);

        if (self.password) {
            self.password = encryption.encrypt(self.password);
        }
        if (self.privateKey) {
            self.privateKey = encryption.encrypt(self.privateKey);
        }

        return self.validateAsModel();
    };

    return Ssh;
}
