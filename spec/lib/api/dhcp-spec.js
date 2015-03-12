// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Dhcp', function () {

    var testlease = {
        "mac": "00:11:22:33:44:55",
        "ipAddress": "10.1.1.200",
        "reservationTimer": 30,
        "reservationExpiresAt": "",
        "renewalTimer": 21600,
        "rebindingTimer": 4320,
        "expirationTimer": 86400,
        "renewalExpiresAt": 1424149074811,
        "rebindExpiresAt": 1424131794811,
        "leaseExpiresAt": 1424213874811,
        "boundFlag": true,
        "reservedFlag": false,
        "reserveTimer": ""
    };

    before('start HTTP server', function () {
        this.timeout(10000);
        return helper.startServer([
            dihelper.simpleWrapper({
                removeLease: sinon.stub().returns(Q.resolve(testlease)),
                removeLeaseByIp: sinon.stub().returns(Q.resolve(testlease)),
                lookupIpLease: sinon.stub().returns(Q.resolve('00:00:00:00:00:00')),
                unpinMac: sinon.stub().returns(Q.resolve({"ip": '10.1.1.200'})),
                unpinIp: sinon.stub().returns(Q.resolve({"mac": '00:11:22:33:44:55'})),
                pinMac: sinon.stub().returns(Q.resolve({"mac": '00:11:22:33:44:55'})),
                peekLeaseTable: sinon.stub().returns(Q.resolve({
                    leases: {
                        "08:00:27:52:d2:a4": {
                            "mac": "08:00:27:52:d2:a4",
                            "ipAddress": "10.1.1.2",
                            "reservationTimer": 30,
                            "reservationExpiresAt": "",
                            "renewalTimer": 21600,
                            "rebindingTimer": 4320,
                            "expirationTimer": 86400,
                            "renewalExpiresAt": 1424149074811,
                            "rebindExpiresAt": 1424131794811,
                            "leaseExpiresAt": 1424213874811,
                            "boundFlag": true,
                            "reservedFlag": false,
                            "reserveTimer": ""
                        },
                        "00:11:22:33:44:55": {
                            "mac": "00:11:22:33:44:55",
                            "ipAddress": "10.1.1.200",
                            "reservationTimer": 30,
                            "reservationExpiresAt": "",
                            "renewalTimer": 21600,
                            "rebindingTimer": 4320,
                            "expirationTimer": 86400,
                            "renewalExpiresAt": 1424149074811,
                            "rebindExpiresAt": 1424131794811,
                            "leaseExpiresAt": 1424213874811,
                            "boundFlag": true,
                            "reservedFlag": false,
                            "reserveTimer": ""
                        }
                    },
                    pinned :{"00:11:22:33:44:55":"10.1.1.200"}
                }))
            }, 'Protocol.Dhcp')
        ]);
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });


    describe('GET /dhcp', function() {
        it('should return all the leases peekLeaseTable', function () {
            return helper.request().get('/api/1.1/dhcp/')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('08:00:27:52:d2:a4');
                    expect(res.body).to.have.property('00:11:22:33:44:55');
                });
        });
    });

    describe('GET /dhcp/lease/:macaddress', function() {

        it('should return the lease detail from peekLeaseTable', function () {
            return helper.request().get('/api/1.1/dhcp/lease/08:00:27:52:d2:a4')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('mac', '08:00:27:52:d2:a4');
                    expect(res.body).to.have.property('ipAddress', '10.1.1.2');
                    expect(res.body).to.have.property('leaseExpiresAt', 1424213874811);
                });
        });

        it('should return 404 if the mac isn\'t in the lease table', function () {
            return helper.request().get('/api/1.1/dhcp/lease/00:00:00:11:11:11')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('GET /dhcp/pinned', function() {

        it('should return the all leases that are pinned', function() {
            return helper.request().get('/api/1.1/dhcp/pinned')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('00:11:22:33:44:55');
                    //{"00:11:22:33:44:55":"10.1.1.200"}
                 });
            });
    });

    describe('DELETE /dhcp/lease/:macaddress', function() {
        it('should remove a lease with the given Macaddress', function() {
            return helper.request().delete('/api/1.1/dhcp/lease/00:11:22:33:44:55')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('mac', '00:11:22:33:44:55');
                    expect(res.body).to.have.property('ipAddress', '10.1.1.200');
                    expect(res.body).to.have.property('leaseExpiresAt', 1424213874811);
                });
        });

        it('should return 404 if the mac isn\'t in the lease table', function() {
            var protocolDhcp = helper.injector.get('Protocol.Dhcp');

            protocolDhcp.removeLease.resolves(undefined);

            return helper.request().delete('/api/1.1/dhcp/lease/00:00:00:11:11:11')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('DELETE dhcp/lease/ip/:ip ', function() {
        it('should remove a lease with the given IP', function() {
            return helper.request().delete('/api/1.1/dhcp/lease/ip/10.1.1.200')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('mac', '00:11:22:33:44:55');
                    expect(res.body).to.have.property('ipAddress', '10.1.1.200');
                    expect(res.body).to.have.property('leaseExpiresAt', 1424213874811);
                });
        });

        it('should return 404 if the ip isn\'t a valid ip address', function() {
            var protocolDhcp = helper.injector.get('Protocol.Dhcp');

            protocolDhcp.removeLeaseByIp.resolves(undefined);

            return helper.request().delete('/api/1.1/dhcp/lease/ip/10.1')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('DELETE /dhcp/pin/:macaddress', function() {
        it('should remove the pin on the lease with the given mac', function() {
            return helper.request().delete('/api/1.1/dhcp/pin/00:11:22:33:44:55')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('ip', '10.1.1.200');
                });
        });

        it('should return 404 if the mac isn\'t a valid ip address', function() {
            var protocolDhcp = helper.injector.get('Protocol.Dhcp');

            protocolDhcp.unpinMac.resolves(undefined);

            return helper.request().delete('/api/1.1/dhcp/pin/00:00:00:11:11:11')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

    describe('DELETE /dhcp/pin/ip/:ip', function() {
        it('should remove the pin on the lease with the given IP', function() {
            return helper.request().delete('/api/1.1/dhcp/pin/ip/10.1.1.200')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('mac', '00:11:22:33:44:55');
                });
        });

        it('should return 404 if the ip isn\'t in the lease table', function() {
            var protocolDhcp = helper.injector.get('Protocol.Dhcp');
            protocolDhcp.unpinIp.resolves(undefined);

            return helper.request().delete('/api/1.1/dhcp/pin/ip/10.1.1.222')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });


    describe('POST /dhcp/pin/:macaddress', function() {
        it('should pin the lease with the given mac', function() {
            return helper.request().post('/api/1.1/dhcp/pin/00:11:22:33:44:55')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property('mac', '00:11:22:33:44:55');
                });
        });

    });



});
