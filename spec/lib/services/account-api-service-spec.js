// Copyright 2016, EMC, Inc.

'use strict';

require('../../helper');

describe("Account API Service", function() {
    var sandbox;
    var self = this;
    var waterline;
    var accountService;
    var Promise;

    var user1 = {
        id: 0,
        username: 'admin',
        password: 'admin123',
        role: 'Administrator'
    };
    
    var user2 = {
        username: 'readonly',
        password: 'read123',
        role: 'ReadOnly'
    };

    before(function() {
        helper.setupInjector([
            helper.require("/lib/services/account-api-service"),
            dihelper.simpleWrapper(function() { arguments[1](); }, 'rimraf')
        ]);

        waterline = helper.injector.get('Services.Waterline');
        waterline.localusers = {
            find: function() {},
            findOne: function() {},
            create: function() {},
            update: function() {},
            destroy: function() {}
        };
        accountService = helper.injector.get('Http.Services.Api.Account');
        Promise = helper.injector.get('Promise');

        self.sandbox = sinon.sandbox.create();
        self.sandbox.stub(waterline.localusers, 'find');
        self.sandbox.stub(waterline.localusers, 'findOne');
        self.sandbox.stub(waterline.localusers, 'create');
        self.sandbox.stub(waterline.localusers, 'update');
        self.sandbox.stub(waterline.localusers, 'destroy');

        // Setup ACL rules that are missed during startServer
        return Promise.all([
            accountService.aclMethod('addUserRoles', 'admin', 'Administrator'),
            accountService.aclMethod('addUserRoles', 'readonly', 'ReadOnly'),
            accountService.aclMethod('addRoleParents', 'Administrator', ['ConfigureUsers']),
            accountService.aclMethod('addRoleParents', 'ReadOnly', ['ConfigureSelf'])
        ]);
    });

    after(function() {
        self.sandbox.restore();
    });

    afterEach(function() {
        self.sandbox.reset();
    });

    it('should list users', function() {
        waterline.localusers.find.resolves([user1, user2]);
        return accountService.listUsers()
        .then(function(users) {
            expect(waterline.localusers.find).to.have.been.called;
            expect(users.length).to.equal(2);
            return Promise.map(users, function(user) {
                expect(user.username).to.be.a('string');
                expect(user.password).to.be.an('undefined');
                expect(user.role).to.be.a('string');
                expect(user.privileges).to.be.instanceof(Array);
            });
        });
    });

    it('should get a user by name', function() {
        waterline.localusers.findOne.resolves(user1);
        return accountService.getUserByName('admin')
        .then(function(user) {
            expect(waterline.localusers.findOne).to.have.been.called;
            expect(user.username).to.equal('admin');
            expect(user.password).to.be.an('undefined');
            expect(user.role).to.equal('Administrator');
            expect(user.privileges).to.be.instanceof(Array);
            expect(user.privileges[0]).to.equal('ConfigureUsers');
        });
    });

    it('should create a user', function() {
        waterline.localusers.findOne
            .onFirstCall().resolves()
            .onSecondCall().resolves(user1);
        waterline.localusers.create.resolves(user1);
        return accountService.createUser(user1)
        .then(function(user) {
            expect(waterline.localusers.findOne).to.have.been.called;
            expect(waterline.localusers.create).to.have.been.called;
            expect(user.username).to.equal('admin');
            expect(user.password).to.be.an('undefined');
            expect(user.role).to.equal('Administrator');
            expect(user.privileges).to.be.instanceof(Array);
            expect(user.privileges[0]).to.equal('ConfigureUsers');
        });
    });

    it('should recreate a user', function() {
        waterline.localusers.findOne
            .onFirstCall().resolves(user1)
            .onSecondCall().resolves(user1);
        waterline.localusers.create.resolves(user1);
        return accountService.createUser(user1)
        .then(function() {
            expect(false);
        })
        .catch(function(err) {
            expect(err.status).to.equal(409);
            expect(waterline.localusers.findOne).to.have.been.called;
            expect(waterline.localusers.create).to.have.not.been.called;
        });
    });

    it('should modify a user', function() {
        waterline.localusers.findOne.resolves(user1);
        waterline.localusers.update.resolves(user1);
        return accountService.modifyUserByName('admin', { password: 'admin456' })
        .then(function(user) {
            expect(waterline.localusers.findOne).to.have.been.called;
            expect(waterline.localusers.update).to.have.been.called;
            expect(user.username).to.equal('admin');
            expect(user.password).to.be.an('undefined');
            expect(user.role).to.equal('Administrator');
            expect(user.privileges).to.be.instanceof(Array);
            expect(user.privileges[0]).to.equal('ConfigureUsers');
        });
    });

    it('should delete a user', function() {
        waterline.localusers.findOne.resolves(user1);
        waterline.localusers.destroy.resolves();
        return accountService.removeUserByName('admin')
        .then(function(user) {
            expect(waterline.localusers.findOne).to.have.been.called;
            expect(waterline.localusers.destroy).to.have.been.called;
            expect(user.username).to.equal('admin');
        });
    });
});
