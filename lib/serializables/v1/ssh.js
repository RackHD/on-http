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
        definitions:{
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
        },
        properties:{
            service: {
                type: 'string'
            },
            config: {
                type: 'object',
                anyOf:[
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
                ]
            }
        },
        required: ['service', 'config']
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

        if (self.config.password) {
            self.config.password = encryption.encrypt(self.config.password);
        }
        if (self.config.privateKey) {
            self.config.privateKey = encryption.encrypt(self.config.privateKey);
        }

        return self.validateAsModel();
    };

    return Ssh;
}
