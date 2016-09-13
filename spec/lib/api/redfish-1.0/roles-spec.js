// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Roles', function () {
    var redfish;

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]).then(function () {
            redfish = helper.injector.get('Http.Api.Services.Redfish');
            sinon.spy(redfish, 'render');
        });
    });

    beforeEach('set up mocks', function () {
         redfish.render.reset();    });


    after('stop HTTP server', function () {
        redfish.render.restore();
        return helper.stopServer();
    });

    it('should return valid roles', function () {
        return helper.request().get('/redfish/v1/AccountService/Roles')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(3);
            });
    });

    it('should return the roles of  ReadOnly ', function () {
        return helper.request().get('/redfish/v1/AccountService/Roles/ReadOnly')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(redfish.render.called).to.be.true;
                expect(res.body.Name).to.equal("ReadOnly");
                expect(res.body.AssignedPrivileges[0])
                    .to.equal("Login" );
            });
    });

    it('should 404 an invalid role', function () {
        return helper.request().get('/redfish/v1/AccountService/Roles/invalid')
            .expect('Content-Type', /^application\/json/)
            .expect(404);
    });

});
