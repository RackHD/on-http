// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser'),
    router = express.Router();

module.exports = dhcpRouterFactory;

di.annotate(dhcpRouterFactory, new di.Provide('Http.Api.Dhcp'));
di.annotate(dhcpRouterFactory,
    new di.Inject(
        'Protocol.Dhcp',
        'common-api-presenter',
        'Assert',
        '_'
    )
);

function dhcpRouterFactory (dhcpProtocol, presenter, assert, _) {
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
     * @api {get} /api/common/dhcp/lease/ GET /:mac
     * @apiDescription Look up a DHCP lease by macaddress
     * @apiName dhcp-leases-get-mac
     * @apiGroup dhcp
     */

    router.get('/dhcp/lease/:mac', presenter.middleware(function(req) {
        return dhcpProtocol.peekLeaseTable().then(function(table) {
            if (_.has(table.leases, req.param('mac'))) {
                return table.leases[req.param('mac')].ipAddress;
            }
        });
    }));

    /**
     * @api {delete} /api/common/dhcp/lease DELETE /:mac
     * @apiDescription remove DHCP lease
     * @apiName dhcp-leases-remove-mac
     * @apiGroup dhcp
     */

    router.delete('/dhcp/lease/:mac', presenter.middleware(function(req) {
        return dhcpProtocol.removeLease(req.param('mac'));
    }));

    /**
     * @api {delete} /api/common/dhcp/:ip  DELETE /:ip
     * @apiDescription remove DHCP lease
     * @apiName dhcp-leases-remove-ip
     * @apiGroup dhcp
     */

    router.delete('/dhcp/lease/ip/:ip', presenter.middleware(function(req) {
        return dhcpProtocol.removeLeaseByIp(req.param('ip'));
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
     * @api {post} /api/common/dhcp/pin/:mac POST /pin/:mac
     * @apiDescription set pinned ip
     * @apiName dhcp-pin-set
     * @apiGroup dhcp
     */

    router.post('/dhcp/pin/:mac', parser.json(), presenter.middleware(function(req) {
        return dhcpProtocol.pinMac(req.param('mac'));
    }));

    /**
     * @api {delete} /api/common/dhcp/pin/:mac DELETE /pin/:mac
     * @apiDescription remove pinned mac
     * @apiName dhcp-pin-remove-mac
     * @apiGroup dhcp
     */

    router.delete('/dhcp/pin/:mac', presenter.middleware(function(req) {
        assert.isMac(req.param('mac'));
        return dhcpProtocol.unpinMac(req.param('mac'));
    }));

    /**
     * @api {delete} /api/common/dhcp/pin/ip/:ip DELETE /pin/ip/:ip
     * @apiDescription remove pinned ip
     * @apiName dhcp-pin-remove-ip
     * @apiGroup dhcp
     */

    router.delete('/dhcp/pin/ip/:ip', presenter.middleware(function(req) {
        assert.isIP(req.param('ip'));
        return dhcpProtocol.unpinIp(req.param('ip'));
    }));

    return router;
}
