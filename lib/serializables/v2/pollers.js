// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');

module.exports = PollersFactory;

di.annotate(PollersFactory, new di.Provide('Serializables.V2.Pollers'));
di.annotate(PollersFactory,
    new di.Inject(
        'Serializable',
        'Services.Waterline',
        'Constants',
        '_'
    )
);

function PollersFactory (Serializable, waterline, Constants, _) {
    function Pollers (defaults) {
        Serializable.call(
            this,
            Pollers.schema,
            defaults
        );
    }

    Pollers.schema = {
        id: 'Serializables.V2.Pollers',
        type: 'object',
        properties: {
            config: {
                type: 'object'
            },
            type: {
                type: 'string'
            },
            pollInterval: {
                type: 'integer'
            },
            paused: {
                type: 'boolean'
            }
        },
        required: [ 'config', 'type', 'pollInterval' ]
    };

    Serializable.register(PollersFactory, Pollers);

    var pollerWorkItems = {
        ipmi: Constants.WorkItems.Pollers.IPMI,
        snmp: Constants.WorkItems.Pollers.SNMP
    };

    Pollers.prototype.deserialize = function(target) {
        var poller = target;
        if (poller) {
            if (poller.type) {
                poller.name = pollerWorkItems[poller.type];
            }
            poller = _.pick(poller, 'name', 'node', 'config', 'pollInterval', 'paused');
            this.defaults(target);
        }
        return this;
    };

    Pollers.prototype.serialize = function(target) {
        var poller = target;
        if (poller) {
            poller.type = _.findKey(pollerWorkItems, function(workItem) {
                return workItem === poller.name;
            });
            delete poller.name;
        }
        return waterline.workitems.deserialize(poller);
    };

    return Pollers;
}
