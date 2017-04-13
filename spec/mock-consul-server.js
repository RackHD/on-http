// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

var _ = require('lodash');

var serviceList = [];

var consul = {
    agent: {
        service: {
            serviceList: serviceList,
            list: function () {
                return new Promise(function (resolve) {
                    resolve(serviceList);
                });
            },
            register: function (service) {
                serviceList.push(service);
            },
            deregister: function (serviceId) {
                _.remove(serviceList, function (id) {
                    id === serviceId.id;
                });
            }
        }
    }
};

function mockConsulServer() {
    return consul;
}

module.exports = mockConsulServer;
