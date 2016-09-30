// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Account Service', function () {
    var tv4;
    var validator;
    var redfish;
    var waterline;
    var Promise;
    var view;
    var fs;
    var accountService;
    var Errors;

    // Skip reading the entry from Mongo and return the entry directly
    function redirectGet(entry) {
        return fs.readFileAsync(__dirname + '/../../../../data/views/redfish-1.0/' + entry, 'utf-8')
            .then(function(contents) {
                return { contents: contents };
            });
    }
    
    var userObj = {
        username: 'admin',
        password: 'admin123',
        role: 'Administrator'
    };

    var readOnlyObj = {
        username: 'readonly',
        password: 'read123',
        role: 'ReadOnly'
    };

    before('start HTTP server', function () {
        var self = this;
        this.timeout(5000);
        this.sandbox = sinon.sandbox.create();

        return helper.startServer([], { authEnabled: true })
        .then(function() {
            view = helper.injector.get('Views');
            redfish = helper.injector.get('Http.Api.Services.Redfish');
            validator = helper.injector.get('Http.Api.Services.Schema');
            waterline = helper.injector.get('Services.Waterline');
            Promise = helper.injector.get('Promise');
            fs = Promise.promisifyAll( helper.injector.get('fs') );
            tv4 = require('tv4');
            accountService = helper.injector.get('Http.Services.Api.Account');
            Errors = helper.injector.get('Errors');

            self.sandbox.stub(view, "get", redirectGet);
            self.sandbox.spy(redfish, 'render');
            self.sandbox.spy(validator, 'validate');
            self.sandbox.stub(waterline.localusers, 'findOne');
            self.sandbox.spy(tv4, "validate");
            waterline.localusers.findOne.withArgs({username: 'admin'}).resolves({
                username: userObj.username,
                comparePassword: function(password) { return password === 'admin123'; },
                role: userObj.role
            });
            waterline.localusers.findOne.withArgs({username: 'readonly'}).resolves({
                username: readOnlyObj.username,
                comparePassword: function(password) { return password === 'read123'; },
                role: readOnlyObj.role
            });

            self.sandbox.stub(accountService, 'listUsers');
            self.sandbox.stub(accountService, 'getUserByName');
            self.sandbox.stub(accountService, 'createUser');
            self.sandbox.stub(accountService, 'modifyUserByName');
            self.sandbox.stub(accountService, 'removeUserByName');

            // Setup ACL rules that are missed during startServer
            return Promise.all([
                accountService.aclMethod('addUserRoles', 'admin', 'Administrator'),
                accountService.aclMethod('addUserRoles', 'readonly', 'ReadOnly'),
                accountService.aclMethod('addRoleParents', 'Administrator', ['ConfigureUsers']),
                accountService.aclMethod('addRoleParents', 'ReadOnly', ['ConfigureSelf'])
            ]);
        });
    });

    afterEach('tear down mocks', function () {
        this.sandbox.reset();
    });

    after('stop HTTP server', function () {
        this.sandbox.restore();
        return helper.stopServer();
    });

    it('should return a valid account service root', function () {
        return helper.request().get('/redfish/v1/AccountService')
            .auth('admin', 'admin123')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body.Accounts['@odata.id']).to.equal('/redfish/v1/AccountService/Accounts');
                expect(res.body.Roles['@odata.id']).to.equal('/redfish/v1/AccountService/Roles');
            });
    });

    it('should return a valid account list', function () {
        accountService.listUsers.resolves([ userObj, readOnlyObj ]);
        return helper.request().get('/redfish/v1/AccountService/Accounts')
            .auth('admin', 'admin123')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function(res) {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
                expect(res.body['Members@odata.count']).to.equal(2);
            });
    });

    it('should return a valid account', function () {
        accountService.getUserByName.withArgs('admin').resolves(userObj);
        return helper.request().get('/redfish/v1/AccountService/Accounts/admin')
            .auth('admin', 'admin123')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 201 a user post attempt with localexception', function() {
        accountService.listUsers.resolves([]);
        accountService.createUser.resolves(userObj);
        return helper.request().post('/redfish/v1/AccountService/Accounts')
            .send({UserName: 'admin', Password: 'admin123', RoleId: 'Administrator'})
            .expect('Content-Type', /^application\/json/)
            .expect(201);
    });

    it('should 401 a user post attempt without auth', function() {
        accountService.listUsers.resolves([ userObj ]);
        return helper.request().post('/redfish/v1/AccountService/Accounts')
            .auth('admin', 'admin456')
            .send({UserName: 'admin2', Password: 'admin123', RoleId: 'Administrator'})
            .expect('Content-Type', /^application\/json/)
            .expect(401);
    });

    it('should 201 a user post attempt with auth tokens', function() {
        accountService.listUsers.resolves([ userObj ]);
        accountService.createUser.resolves();
        accountService.getUserByName.resolves(userObj);
        return helper.request().post('/redfish/v1/AccountService/Accounts')
            .auth('admin', 'admin123')
            .send({UserName: 'admin2', Password: 'admin123', RoleId: 'Administrator'})
            .expect('Content-Type', /^application\/json/)
            .expect(201);
    });

    it('should 400 a user post attempt with invalid password requirements', function() {
        accountService.listUsers.resolves([ userObj ]);
        accountService.createUser.rejects(new Errors.BadRequestError());
        accountService.getUserByName.resolves(userObj);
        return helper.request().post('/redfish/v1/AccountService/Accounts')
            .auth('admin', 'admin123')
            .send({UserName: 'admin2', Password: 'admin', RoleId: 'Administrator'})
            .expect('Content-Type', /^application\/json/)
            .expect(400);
    });

    it('should 403 a user post without access', function() {
        accountService.listUsers.resolves([ userObj ]);
        accountService.createUser.resolves();
        accountService.getUserByName.resolves({UserName: 'admin2', RoleId: 'Administrator'});
        return helper.request().post('/redfish/v1/AccountService/Accounts')
            .auth('readonly', 'read123')
            .send({UserName: 'admin2', Password: 'admin123', RoleId: 'Administrator'})
            .expect('Content-Type', /^application\/json/)
            .expect(403);
    });

    it('should 401 a user patch attempt without auth', function() {
        accountService.getUserByName.resolves(userObj);
        return helper.request().patch('/redfish/v1/AccountService/Accounts/admin')
            .auth('admin', 'admin456')
            .send({UserName: 'admin2', Password: 'admin123', RoleId: 'Administrator'})
            .expect('Content-Type', /^application\/json/)
            .expect(401);
    });

    it('should 202 a user patch attempt with auth', function() {
        accountService.getUserByName.resolves(userObj);
        accountService.modifyUserByName.resolves(userObj);
        return helper.request().patch('/redfish/v1/AccountService/Accounts/admin')
            .auth('admin', 'admin123')
            .send({Password: 'admin456', RoleId: 'Administrator'})
            .expect('Content-Type', /^application\/json/)
            .expect(202)
            .then(function() {
                expect(accountService.modifyUserByName)
                    .to.have.been.calledWith('admin', {password:'admin456', role: 'Administrator'});
            });
    });

    it('should 202 a user patch attempt with auth', function() {
        accountService.getUserByName.resolves(readOnlyObj);
        accountService.modifyUserByName.resolves(readOnlyObj);
        return helper.request().patch('/redfish/v1/AccountService/Accounts/readonly')
            .auth('readonly', 'read123')
            .send({Password: 'read456'})
            .expect('Content-Type', /^application\/json/)
            .expect(202)
            .then(function() {
                expect(accountService.modifyUserByName)
                    .to.have.been.calledWith('readonly', {password:'read456'});
            });
    });

    it('should 400 a user patch attempt with auth', function() {
        accountService.getUserByName.resolves(readOnlyObj);
        accountService.modifyUserByName.resolves(readOnlyObj);
        return helper.request().patch('/redfish/v1/AccountService/Accounts/readonly')
            .auth('readonly', 'read123')
            .send({UserName: 'readonly', Password: 'read456', RoleId: 'Administrator'})
            .expect('Content-Type', /^application\/json/)
            .expect(400)
            .then(function() {
                expect(accountService.modifyUserByName)
                    .to.not.have.been.called;
            });
    });

    it('should 403 a user post without access', function() {
        accountService.listUsers.resolves([ userObj ]);
        accountService.createUser.resolves();
        accountService.getUserByName.resolves({UserName: 'admin2', RoleId: 'Administrator'});
        return helper.request().patch('/redfish/v1/AccountService/Accounts/admin')
            .auth('readonly', 'read123')
            .send({UserName: 'admin2', Password: 'admin123', RoleId: 'Administrator'})
            .expect('Content-Type', /^application\/json/)
            .expect(403);
    });

    it('should 401 a user patch delete without auth', function() {
        accountService.getUserByName.resolves(userObj);
        return helper.request().delete('/redfish/v1/AccountService/Accounts/admin')
            .auth('admin', 'admin456')
            .expect('Content-Type', /^application\/json/)
            .expect(401);
    });

    it('should 200 a user delete attempt with auth', function() {
        accountService.removeUserByName.resolves(userObj);
        return helper.request().delete('/redfish/v1/AccountService/Accounts/admin')
            .auth('admin', 'admin123')
            .expect(204)
            .then(function() {
                expect(accountService.removeUserByName).to.have.been.calledWith('admin');
            });
    });

    it('should 403 a user delete without access', function() {
        accountService.listUsers.resolves([ userObj ]);
        accountService.createUser.resolves();
        accountService.getUserByName.resolves({UserName: 'admin2', RoleId: 'Administrator'});
        return helper.request().delete('/redfish/v1/AccountService/Accounts/admin')
            .auth('readonly', 'read123')
            .expect('Content-Type', /^application\/json/)
            .expect(403);
    });

});

