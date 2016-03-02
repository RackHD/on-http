// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');

module.exports = NodeFactory;

di.annotate(NodeFactory, new di.Provide('Serializables.V1.Node'));
di.annotate(NodeFactory,
    new di.Inject(
        'Promise',
        'Serializable',
        'Serializables.V1.Obm',
        'Serializables.V1.Snmp',
        'Serializables.V1.Ssh',
        'Constants',
        '_'
    )
);

function NodeFactory (
    Promise,
    Serializable,
    ObmSerializable,
    SnmpSerializable,
    SshSerializable,
    Constants,
    _
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
                enum: _.values(Constants.NodeTypes)
            },
            obmSettings: {
                type: 'array',
                items: {
                    $ref: 'Serializables.V1.Obm'
                }
            },
            sshSettings: {
                type: 'object',
                items: {
                    $ref: 'Serializables.V1.Ssh'
                }
            },
            snmpSettings: {
                type: 'object',
                items: {
                    $ref: 'Serializables.V1.Snmp'
                }
            },
            bootSettings: {
                type: 'object',
                items: {
                    $ref: 'Serializables.V1.Boot'
                }
            }
        },
        required: [ 'name' ]
    };

    Serializable.register(NodeFactory, Node);

    Node.prototype.serializeObmSettings = function () {
        var self = this;
        if (this.obmSettings) {
            return Promise.map(this.obmSettings, function (item) {
                var serializable = new ObmSerializable();

                return serializable.serialize(item);
            }).then(function (settings) {
                self.obmSettings = settings;
                return self;
            });
        }
    };

    Node.prototype.deserializeObmSettings = function () {
        var self = this;
        if (this.obmSettings) {
            return Promise.map(this.obmSettings, function (item) {
                var serializable = new ObmSerializable();
                return serializable.deserialize(item);
            }).then(function (settings) {
                self.obmSettings = settings;
                return self;
            });
        }
    };

    Node.prototype.serializeSnmpSettings = function () {
        var self = this;

        if (this.snmpSettings) {
            return Promise.resolve().then(function () {
                var serializable = new SnmpSerializable();
                return serializable.serialize(self.snmpSettings);
            }).then(function (settings) {
                self.snmpSettings = settings;
                return self;
            });
        }
    };

    Node.prototype.deserializeSnmpSettings = function () {
        var self = this;

        if (this.snmpSettings) {
            return Promise.resolve().then(function () {
                var serializable = new SnmpSerializable();
                return serializable.deserialize(self.snmpSettings);
            }).then(function (settings) {
                self.snmpSettings = settings;
                return self;
            });
        }
    };

    Node.prototype.serializeSshSettings = function () {
        var self = this;

        if (this.sshSettings) {
            return Promise.resolve().then(function () {
                var serializable = new SshSerializable();
                return serializable.serialize(self.sshSettings);
            }).then(function (settings) {
                self.sshSettings = settings;
                return self;
            });
        }
    };

    Node.prototype.deserializeSshSettings = function () {
        var self = this;

        if (this.sshSettings) {
            return Promise.resolve().then(function () {
                var serializable = new SshSerializable();
                return serializable.deserialize(self.sshSettings);
            }).then(function (settings) {
                self.sshSettings = settings;
                return self;
            });
        }
    };

    Node.prototype.serialize = function (target) {
        var self = this;
        this.defaults(target);
        return Promise.all([
                this.serializeSnmpSettings(),
                this.serializeObmSettings(),
                this.serializeSshSettings()
        ])
        .spread(function() {
            return self;
        });
    };

    Node.prototype.deserialize = function (target) {
        var self = this;

        this.defaults(target);
        return Promise.all([
                this.deserializeSnmpSettings(),
                this.deserializeObmSettings(),
                this.deserializeSshSettings()
        ])
        .spread(function() {
            return self;
        });
    };

    return Node;
}
