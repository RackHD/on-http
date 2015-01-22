// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di'),
    express = require('express'),
    router = express.Router(),
    parser = require('body-parser');

router.use(parser.json());

module.exports = dhcpRouterFactory;

di.annotate(dhcpRouterFactory,
    new di.Inject(
        'Protocol.Dhcp',
        'common-api-presenter',
        'Assert'
    )
);

function dhcpRouterFactory (dhcpProtocol, presenter, assert) {
    /**
     * @api {get} /api/common/dhcp/ GET /
     * @apiDescription get DHCP lease table
     * @apiName dhcp-leases-get
     * @apiGroup dhcp
     */

    router.get('/dhcp', presenter.middleware(function() {
        return dhcpProtocol.peekLeaseTable().then(function(table) {
            assert.object(table, 'DHCP lease table');
            return table.leases;
        });
    }));

    /**
     * @api {delete} /api/common/dhcp/ DELETE /:mac
     * @apiDescription remove DHCP lease
     * @apiName dhcp-leases-remove
     * @apiGroup dhcp
     */

    router.delete('/dhcp/:mac', presenter.middleware(function(req) {
        return dhcpProtocol.removeLease(req.param('mac'));
    }));

    /**
     * @api {get} /api/common/dhcp/pinned GET /pinned
     * @apiDescription get pinned IPs
     * @apiName dhcp-pin-get
     * @apiGroup dhcp
     */

    router.get('/dhcp/pinned', presenter.middleware(function() {
        return dhcpProtocol.peekLeaseTable().then(function(table) {
            assert.object(table, 'DHCP lease table');
            return table.pinned || {};
        });
    }));

    /**
     * @api {post} /api/common/dhcp/:mac/pin POST /:mac/pin
     * @apiDescription set pinned ip
     * @apiName dhcp-pin-set
     * @apiGroup dhcp
     */

    router.post('/dhcp/:mac/pin', presenter.middleware(function(req) {
        return dhcpProtocol.pinIp(req.param('mac'));
    }));

    /**
     * @api {delete} /api/common/dhcp/:mac/pin DELETE /:mac/pin
     * @apiDescription remove pinned ip
     * @apiName dhcp-pin-remove
     * @apiGroup dhcp
     */

    router.delete('/dhcp/:mac/pin', presenter.middleware(function(req) {
        return dhcpProtocol.unpinIp(req.param('mac'));
    }));

    return router;
}
