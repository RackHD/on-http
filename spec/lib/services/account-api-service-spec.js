// Copyright 2016, EMC, Inc.

'use strict';

require('../../helper');

describe("Account API Service", function () {
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

    before(function () {
        helper.setupInjector([
            helper.require("/lib/services/account-api-service"),
            dihelper.simpleWrapper(function () { arguments[1](); }, 'rimraf')
        ]);

        waterline = helper.injector.get('Services.Waterline');
        waterline.localusers = {
            find: function () { },
            findOne: function () { },
            create: function () { },
            update: function () { },
            destroy: function () { }
        };
        waterline.roles = {
            find: function () { },
            findOne: function () { },
            create: function () { },
            update: function () { },
            destroy: function () { }
        };
        accountService = helper.injector.get('Http.Services.Api.Account');
        Promise = helper.injector.get('Promise');

        self.sandbox = sinon.sandbox.create();
        self.sandbox.stub(waterline.localusers, 'find');
        self.sandbox.stub(waterline.localusers, 'findOne');
        self.sandbox.stub(waterline.localusers, 'create');
        self.sandbox.stub(waterline.localusers, 'update');
        self.sandbox.stub(waterline.localusers, 'destroy');

        self.sandbox.stub(waterline.roles, 'find');
        self.sandbox.stub(waterline.roles, 'findOne');
        self.sandbox.stub(waterline.roles, 'create');
        self.sandbox.stub(waterline.roles, 'update');
        self.sandbox.stub(waterline.roles, 'destroy');

        // Setup ACL rules that are missed during startServer
        return Promise.all([
            accountService.aclMethod('addUserRoles', 'admin', 'Administrator'),
            accountService.aclMethod('addUserRoles', 'readonly', 'ReadOnly'),
            accountService.aclMethod('addRoleParents', 'Administrator', ['ConfigureUsers']),
            accountService.aclMethod('addRoleParents', 'ReadOnly', ['ConfigureSelf'])
        ]);
    });

    after(function () {
        self.sandbox.restore();
    });

    afterEach(function () {
        self.sandbox.reset();
    });

    describe('Users services', function () {

        it('should list users', function () {
            waterline.localusers.find.resolves([user1, user2]);
            return accountService.listUsers()
            .then(function (users) {
                expect(waterline.localusers.find).to.have.been.called;
                expect(users.length).to.equal(2);
                return Promise.map(users, function (user) {
                    expect(user.username).to.be.a('string');
                    expect(user.password).to.be.an('undefined');
                    expect(user.role).to.be.a('string');
                    expect(user.privileges).to.be.instanceof(Array);
                });
            });
        });

        it('should get a user by name', function () {
            waterline.localusers.findOne.resolves(user1);
            return accountService.getUserByName('admin')
            .then(function (user) {
                expect(waterline.localusers.findOne).to.have.been.called;
                expect(user.username).to.equal('admin');
                expect(user.password).to.be.an('undefined');
                expect(user.role).to.equal('Administrator');
                expect(user.privileges).to.be.instanceof(Array);
                expect(user.privileges[0]).to.equal('ConfigureUsers');
            });
        });

        it('should create a user', function () {
            waterline.localusers.findOne
                .onFirstCall().resolves()
                .onSecondCall().resolves(user1);
            waterline.localusers.create.resolves(user1);
            return accountService.createUser(user1)
            .then(function (user) {
                expect(waterline.localusers.findOne).to.have.been.called;
                expect(waterline.localusers.create).to.have.been.called;
                expect(user.username).to.equal('admin');
                expect(user.password).to.be.an('undefined');
                expect(user.role).to.equal('Administrator');
                expect(user.privileges).to.be.instanceof(Array);
                expect(user.privileges[0]).to.equal('ConfigureUsers');
            });
        });

        it('should recreate a user', function () {
            waterline.localusers.findOne
                .onFirstCall().resolves(user1)
                .onSecondCall().resolves(user1);
            waterline.localusers.create.resolves(user1);
            return accountService.createUser(user1)
            .then(function () {
                expect(false);
            })
            .catch(function (err) {
                expect(err.status).to.equal(409);
                expect(waterline.localusers.findOne).to.have.been.called;
                expect(waterline.localusers.create).to.have.not.been.called;
            });
        });

        it('should modify a user', function () {
            waterline.localusers.findOne.resolves(user1);
            waterline.localusers.update.resolves(user1);
            return accountService.modifyUserByName('admin', { password: 'admin456' })
            .then(function (user) {
                expect(waterline.localusers.findOne).to.have.been.called;
                expect(waterline.localusers.update).to.have.been.called;
                expect(user.username).to.equal('admin');
                expect(user.password).to.be.an('undefined');
                expect(user.role).to.equal('Administrator');
                expect(user.privileges).to.be.instanceof(Array);
                expect(user.privileges[0]).to.equal('ConfigureUsers');
            });
        });

        it('should delete a user', function () {
            waterline.localusers.findOne.resolves(user1);
            waterline.localusers.destroy.resolves();
            return accountService.removeUserByName('admin')
            .then(function (user) {
                expect(waterline.localusers.findOne).to.have.been.called;
                expect(waterline.localusers.destroy).to.have.been.called;
                expect(user.username).to.equal('admin');
            });
        });
    });

    describe('Roles services', function () {

        var role1 = {
            role: 'role1',
            privileges: ['read']
        };

        it('should not create a new role if role already exist', function () {
            waterline.roles.create.rejects(new Error('BaseError: role already exists'));
            return accountService.createRole(role1)
            .then(function () {
                throw new Error('expected a failure');
            })
            .catch(function (err) {
                expect(waterline.roles.create).to.have.been.called;
                expect(err).to.have.property('message')
                    .that.equal('BaseError: role already exists');
            });
        });

        it('should add new role and priviliges to the acl server', function () {
            waterline.roles.findOne.resolves(role1);
            waterline.roles.create.resolves(role1);
            return accountService.createRole(role1)
            .then(function (res) {
                expect(waterline.roles.findOne).to.have.been.called.twice;
                expect(waterline.roles.create).to.have.been.called;
                expect(res).to.have.property('privileges').that.deep.equal(role1.privileges);
            });
        });

        it('should return a list of roles', function () {

            waterline.roles.find.resolves([role1]);
            return accountService.listRoles()
            .then(function (res) {
                expect(waterline.roles.find).to.have.been.called;
                expect(res[0]).to.have.property('role').that.equal(role1.role);
                expect(res[0]).to.have.property('privileges').that.deep.equal(role1.privileges);
            });
        });

        it('should return not found if role does not exist', function () {
            waterline.roles.findOne.resolves();
            return accountService.getRoleByName(role1.role)
            .then(function () {
                throw new Error('expected a failure');
            })
            .catch(function (err) {
                expect(waterline.roles.findOne).to.have.been.called.once;
                expect(err).to.have.property('name').that.equal('NotFoundError');
            });
        });

        it('should return the requested role', function () {
            waterline.roles.findOne.onCall(0).resolves(role1);
            return accountService.getRoleByName(role1.role)
            .then(function (res) {
                expect(waterline.roles.findOne).to.have.been.called;
                expect(res).to.have.property('privileges').that.deep.equal(role1.privileges);
                expect(res).to.have.property('role').that.equal(role1.role);
            });
        });

        it('should return an error if trying to modify a role that does not exist', function () {
            waterline.roles.findOne.onCall(0).resolves();
            return accountService.modifyRoleByRoleName(role1.role, role1)
            .then(function () {
                throw new Error('expected a failure');
            })
            .catch(function (err) {
                expect(waterline.roles.findOne).to.have.been.called.once;
                expect(err).to.have.property('name').that.equal('NotFoundError');
            });
        });

        it('should modify a role with the given privileges', function () {
            var modifiedRole = {
                role: 'role1',
                privileges: ['write']
            };
            waterline.roles.findOne.onCall(0).resolves(role1);
            waterline.roles.findOne.onCall(1).resolves(modifiedRole);
            waterline.roles.update.resolves();
            return accountService.modifyRoleByRoleName(role1.role, modifiedRole)
            .then(function (res) {
                expect(waterline.roles.findOne).to.have.been.called.twice;
                expect(waterline.roles.update).to.have.been.called;
                expect(res).to.have.property('privileges').that.deep.equal(modifiedRole.privileges);
            });
        });
    });
});
