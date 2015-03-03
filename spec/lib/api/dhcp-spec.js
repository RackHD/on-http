// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Dhcp', function () {

    before('start HTTP server', function () {
        this.timeout(10000);
        return helper.startServer([
            dihelper.simpleWrapper({
                lookupIpLease: sinon.stub().returns(Q.resolve('00:00:00:00:00:00')),
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
                    }
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

});
