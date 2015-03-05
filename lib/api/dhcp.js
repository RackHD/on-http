// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */

'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

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
    var router = express.Router();
    /**
     * @api {get} /api/1.1/dhcp/ GET /
     * @apiVersion 1.1.0
     * @apiDescription get DHCP lease table
     * @apiName dhcp-leases-get
     * @apiGroup dhcp
     * @apiError NotFound Dhcp is not defined.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.get('/dhcp', presenter.middleware(function() {
        return dhcpProtocol.peekLeaseTable().then(function(table) {
            assert.object(table, 'DHCP lease table');
            return table.leases;
        });
    }));

    /**
     * @api {get} /api/1.1/dhcp/lease/ GET /lease/:mac
     * @apiVersion 1.1.0
     * @apiDescription Look up a DHCP lease by macaddress
     * @apiName dhcp-leases-get-mac
     * @apiGroup dhcp
     * @apiParam {String} macaddress - macaddress of the machine to look up the DHCP lease
     * @apiSuccessExample Completed-Response:
     *     HTTP/1.1 200 OK
     *     {
     *         "mac":"08:00:27:52:d2:a4",
     *         "ipAddress":"10.1.1.2",
     *         "reservationTimer":30,
     *         "reservationExpiresAt":"",
     *         "renewalTimer":21600,
     *         "rebindingTimer":4320,
     *         "expirationTimer":86400,
     *         "renewalExpiresAt":1424149074811,
     *         "rebindExpiresAt":1424131794811,
     *         "leaseExpiresAt":1424213874811,
     *         "boundFlag":true,
     *         "reservedFlag":false,
     *         "reserveTimer":""
     *     }
     * @apiError NotFound The dhcp with the <code>mac</code> was not found.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *         "error":"Not Found"
     *     }
     */

    router.get('/dhcp/lease/:mac', presenter.middleware(function(req) {
        return dhcpProtocol.peekLeaseTable().then(function(table) {
            if (_.has(table.leases, req.param('mac'))) {
                return table.leases[req.param('mac')];
            }
        });
    }));

    /**
     * @api {delete} /api/1.1/dhcp/lease DELETE /:mac
     * @apiVersion 1.1.0
     * @apiDescription remove DHCP lease
     * @apiName dhcp-leases-remove-mac
     * @apiGroup dhcp
     * @apiError AssertionError The <code>mac</code> is not a valid Mac Address
     * @apiSuccess {json} lease The dhcp lease with the <code>mac</code> or an empty object if
     *                    there is none with that <code>mac</code>.
     */

    router.delete('/dhcp/lease/:mac', presenter.middleware(function(req) {
        return dhcpProtocol.removeLease(req.param('mac'));
    }));

    /**
     * @api {delete} /api/1.1/dhcp/lease/ip/:ip  DELETE /:ip
     * @apiDescription remove DHCP lease
     * @apiVersion 1.1.0
     * @apiName dhcp-leases-remove-ip
     * @apiGroup dhcp
     * @apiError AssertionError The <code>ip</code> is not a valid IP
     * @apiSuccess {json} lease The dhcp lease with the <code>ip</code> or an empty object if
     *                    there is none with that <code>ip</code>.
     */

    router.delete('/dhcp/lease/ip/:ip', presenter.middleware(function(req) {
        return dhcpProtocol.removeLeaseByIp(req.param('ip'));
    }));

    /**
     * @api {get} /api/1.1/dhcp/pinned GET /pinned
     * @apiVersion 1.1.0
     * @apiDescription get pinned IPs
     * @apiName dhcp-pin-get
     * @apiGroup dhcp
     * @apiSuccess {json} leases List of leases that are pinned or if there are non an empty object.
     */

    router.get('/dhcp/pinned', presenter.middleware(function() {
        return dhcpProtocol.peekLeaseTable().then(function(table) {
            assert.object(table, 'DHCP lease table');
            return table.pinned || {};
        });
    }));

    /**
     * @api {post} /api/1.1/dhcp/pin/:mac POST /pin/:mac
     * @apiVersion 1.1.0
     * @apiDescription set pinned ip
     * @apiName dhcp-pin-set
     * @apiGroup dhcp
     * @apiError AssertionError The <code>mac</code> is not a valid Mac Address
     * @apiSuccess {json} lease The dhcp lease with the <code>mac</code> or an empty object if
     *                    there is none with that <code>mac</code>.
     */

    router.post('/dhcp/pin/:mac', parser.json(), presenter.middleware(function(req) {
        return dhcpProtocol.pinMac(req.param('mac'));
    }));

    /**
     * @api {delete} /api/1.1/dhcp/pin/:mac DELETE /pin/:mac
     * @apiVersion 1.1.0
     * @apiDescription remove pinned mac
     * @apiName dhcp-pin-remove-mac
     * @apiGroup dhcp
     * @apiSucces {json} ip returns the corresponding <code>IP</code>
     * @apiError AssertionError The <code>mac</code> is not a valid Mac Address
     * @apiSuccess {json} lease The dhcp lease with the <code>mac</code> or an empty object if
     *                    there is none with that <code>mac</code>.
     */

    router.delete('/dhcp/pin/:mac', presenter.middleware(function(req) {
        assert.isMac(req.param('mac'));
        return dhcpProtocol.unpinMac(req.param('mac'));
    }));

    /**
     * @api {delete} /api/1.1/dhcp/pin/ip/:ip DELETE /pin/ip/:ip
     * @apiVersion 1.1.0
     * @apiDescription remove pinned ip
     * @apiName dhcp-pin-remove-ip
     * @apiGroup dhcp
     * @apiSuccess {json} mac returns the corresponding <code>mac</code>
     * @apiError AssertionError The <code>ip</code> is not a valid IP
     */

    router.delete('/dhcp/pin/ip/:ip', presenter.middleware(function(req) {
        assert.isIP(req.param('ip'));
        return dhcpProtocol.unpinIp(req.param('ip'));
    }));

    return router;
}
