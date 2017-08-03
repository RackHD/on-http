// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Session Service', function () {
    var tv4;
    var validator;
    var redfish;
    var waterline;
    var Promise;
    var Constants;
    var view;
    var fs;
    var env;
    var accountService;

    // Skip reading the entry from Mongo and return the entry directly
    function redirectGet(entry) {
        return fs.readFileAsync(__dirname + '/../../../../data/views/redfish-1.0/' + entry, 'utf-8')
            .then(function(contents) {
                return { contents: contents };
            });
    }

    helper.httpServerBefore([], { authEnabled: true });

    before(function () {
        Constants = helper.injector.get('Constants');
        view = helper.injector.get('Views');
        redfish = helper.injector.get('Http.Api.Services.Redfish');
        validator = helper.injector.get('Http.Api.Services.Schema');
        waterline = helper.injector.get('Services.Waterline');
        Promise = helper.injector.get('Promise');
        env = helper.injector.get('Services.Environment');
        var nodeFs = helper.injector.get('fs');
        fs = Promise.promisifyAll(nodeFs);
        helper.injector.get('Auth.Services').init();
        accountService = helper.injector.get('Http.Services.Api.Account');
        tv4 = require('tv4');
    });

    beforeEach('set up mocks', function () {
        this.sandbox.spy(tv4, "validate");
        this.sandbox.stub(view, "get", redirectGet);
        this.sandbox.spy(redfish, 'render');
        this.sandbox.spy(validator, 'validate');
        this.sandbox.stub(env, "get").resolves();
        this.sandbox.stub(waterline.graphobjects);
        this.sandbox.stub(waterline.nodes);
        this.sandbox.stub(waterline.localusers, 'findOne');
        waterline.localusers.findOne.withArgs({username: 'admin'}).resolves({
            username: 'admin',
            comparePassword: function(password) { return password === 'admin123'; }
        });
        waterline.localusers.findOne.resolves();
        // Setup ACL rules that are missed during startServer
        return Promise.all([
            accountService.aclMethod('addUserRoles', 'admin', 'Administrator'),
            accountService.aclMethod('addUserRoles', 'readonly', 'ReadOnly'),
            accountService.aclMethod('addRoleParents', 'Administrator', ['ConfigureUsers']),
            accountService.aclMethod('addRoleParents', 'ReadOnly', ['ConfigureSelf'])
        ]);
    });

    helper.httpServerAfter();

    it('should return a valid session service root', function () {
        return helper.request().get('/redfish/v1/SessionService')
            .auth('admin', 'admin123')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid session collection', function() {
        return helper.request().get('/redfish/v1/SessionService/Sessions')
            .auth('admin', 'admin123')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    describe('session login', function() {
        var id;
        var token;
        beforeEach('create a session object', function() {
            return helper.request().post('/redfish/v1/SessionService/Sessions')
                .send({UserName: 'admin', Password: 'admin123'})
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res) {
                    expect(res.headers).to.have.property('x-auth-token');
                    expect(res.body.UserName).to.equal('admin');
                    id = res.body.Id;
                    token = res.headers['x-auth-token'];
                });
        });

        afterEach('delete session object', function() {
            return helper.request()
                .delete('/redfish/v1/SessionService/Sessions/' + id)
                .set('X-Auth-Token', token)
                .expect(204);
        });

        it('should return the session', function () {
            return helper.request().get('/redfish/v1/SessionService/Sessions/' + id)
                .auth('admin', 'admin123')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.render.called).to.be.true;
                });
        });

        it('should 404 an invalid session', function() {
            return helper.request()
                .get('/redfish/v1/SessionService/Sessions/' + id + 'invalid')
                .auth('admin', 'admin123')
                .expect(404);
        });

        it('should list the session', function() {
            return helper.request().get('/redfish/v1/SessionService/Sessions')
                .auth('admin', 'admin123')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res) {
                    expect(tv4.validate.called).to.be.true;
                    expect(validator.validate.called).to.be.true;
                    expect(redfish.render.called).to.be.true;
                    expect(res.body['Members@odata.count']).to.equal(1);
                    expect(res.body.Members[0]['@odata.id'])
                        .to.equal('/redfish/v1/SessionService/Sessions/' + id);
                    });
        });
    });
});

