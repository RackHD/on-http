// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Users', function () {
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

    var accountService;
    var waterline;
    
    before('start HTTP server', function () {
        var self = this;
        this.timeout(5000);
        this.sandbox = sinon.sandbox.create();

        return helper.startServer([], { authEnabled: true })
        .then(function() {
            accountService = helper.injector.get('Http.Services.Api.Account');
            self.sandbox.stub(accountService, 'listUsers');
            self.sandbox.stub(accountService, 'getUserByName');
            self.sandbox.stub(accountService, 'createUser');
            self.sandbox.stub(accountService, 'modifyUserByName');
            self.sandbox.stub(accountService, 'removeUserByName');

            waterline = helper.injector.get('Services.Waterline');
            self.sandbox.stub(waterline.localusers, 'findOne');
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

            // Setup ACL rules that are missed during startServer
            return Promise.all([
                accountService.aclMethod('addUserRoles', 'admin', 'Administrator'),
                accountService.aclMethod('addUserRoles', 'readonly', 'ReadOnly'),
                accountService.aclMethod('addRoleParents', 'Administrator', ['Read', 'Write']),
                accountService.aclMethod('addRoleParents', 'ReadOnly', ['Read'])
            ]);
        });
    });

    afterEach(function() {
        this.sandbox.reset();
    });

    after('stop HTTP server', function () {
        this.sandbox.restore();
        return helper.stopServer();
    });

    it('should 201 a user post attempt with localexception', function() {
        accountService.listUsers.resolves([]);
        accountService.createUser.resolves(userObj);
        return helper.request().post('/api/2.0/users')
            .send(userObj)
            .expect('Content-Type', /^application\/json/)
            .expect(201, {
                username: userObj.username,
                role: userObj.role
            });
    });

    it('should 401 a user post attempt without auth tokens', function() {
        accountService.listUsers.resolves([ userObj ]);
        return helper.request().post('/api/2.0/users')
            .send(userObj)
            .expect('Content-Type', /^application\/json/)
            .expect(401);
    });

    it('should 201 a user post attempt with auth tokens', function() {
        accountService.listUsers.resolves([ userObj ]);
        accountService.createUser.resolves(readOnlyObj);
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().post('/api/2.0/users')
                    .set("authorization", 'JWT ' + token)
                    .send(readOnlyObj)
                    .expect('Content-Type', /^application\/json/)
                    .expect(201);
            });
    });

    it('should 403 a user post without access', function() {
        accountService.listUsers.resolves([ userObj ]);
        return helper.request().post('/login')
            .send({username: "readonly", password: "read123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().post('/api/2.0/users')
                    .set("authorization", 'JWT ' + token)
                    .send(readOnlyObj)
                    .expect('Content-Type', /^application\/json/)
                    .expect(403);
            });
    });

    it('should 401 a user post attempt with invalid auth tokens', function() {
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().post('/api/2.0/users')
                    .set("authorization", 'JWT ' + token + 'blab')
                    .send(readOnlyObj)
                    .expect('Content-Type', /^application\/json/)
                    .expect(401);
            });
    });

    it('should 200 a user modification attempt with auth tokens', function() {
        accountService.getUserByName.resolves(userObj);
        accountService.modifyUserByName.resolves(userObj);
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().patch('/api/2.0/users/admin')
                    .set("authorization", 'JWT ' + token)
                    .send({password: 'admin456', role: 'Administrator'})
                    .expect('Content-Type', /^application\/json/)
                    .expect(200)
                    .then(function() {
                        expect(accountService.getUserByName)
                            .to.have.been.calledWith('admin');
                        expect(accountService.modifyUserByName)
                            .to.have.been.calledWith('admin', {password:'admin456', role: 'Administrator'});
                    });
            });
    });

    it('should 400 a less privileged user modification attempt with auth tokens', function() {
        accountService.getUserByName.resolves(readOnlyObj);
        accountService.modifyUserByName.resolves(readOnlyObj);
        return helper.request().post('/login')
            .send({username: "readonly", password: "read123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().patch('/api/2.0/users/readonly')
                    .set("authorization", 'JWT ' + token)
                    .send({password: 'admin456', role: 'Administrator'})
                    .expect('Content-Type', /^application\/json/)
                    .expect(400)
                    .then(function() {
                        expect(accountService.getUserByName)
                            .to.have.been.calledWith('readonly');
                        expect(accountService.modifyUserByName)
                            .to.not.have.been.called;
                    });
            });
    });

    it('should 401 a user modification attempt with auth tokens', function() {
        accountService.getUserByName.resolves(userObj);
        accountService.modifyUserByName.resolves(userObj);
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().patch('/api/2.0/users/admin')
                    .set("authorization", 'JWT ' + token + 'bad')
                    .send({password: 'admin456'})
                    .expect(401);
            });
    });

    it('should 403 a user modification attempt with auth tokens', function() {
        accountService.getUserByName.resolves(userObj);
        accountService.modifyUserByName.resolves(userObj);
        return helper.request().post('/login')
            .send({username: "readonly", password: "read123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().patch('/api/2.0/users/admin')
                    .set("authorization", 'JWT ' + token)
                    .send({password: 'admin456'})
                    .expect(403);
            });
    });

    it('should 200 a user list with auth tokens', function() {
        accountService.listUsers.resolves([ userObj ]);
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().get('/api/2.0/users')
                    .set("authorization", 'JWT ' + token)
                    .expect('Content-Type', /^application\/json/)
                    .expect(200);
            });
    });

    it('should 401 a user list without auth tokens', function() {
        accountService.listUsers.resolves([ userObj ]);
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().get('/api/2.0/users')
                    .set("authorization", 'JWT ' + token + 'bad')
                    .expect(401);
            });
    });

    it('should 200 a user get with auth tokens', function() {
        accountService.getUserByName.resolves(userObj);
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().get('/api/2.0/users/admin')
                    .set("authorization", 'JWT ' + token)
                    .expect('Content-Type', /^application\/json/)
                    .expect(200);
            });
    });

    it('should 401 a user get without auth tokens', function() {
        accountService.getUserByName.resolves(userObj);
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().get('/api/2.0/users/admin')
                    .set("authorization", 'JWT ' + token + 'bad')
                    .expect(401);
            });
    });

    it('should 204 a user delete with auth tokens', function() {
        accountService.removeUserByName.resolves({username: 'admin'});
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().delete('/api/2.0/users/admin')
                    .set("authorization", 'JWT ' + token)
                    .expect(204)
                    .then(function() {
                        expect(accountService.removeUserByName).to.have.been.calledWith('admin');
                    });
            });
    });

    it('should 401 a user delete without auth tokens', function() {
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().delete('/api/2.0/users/admin')
                    .set("authorization", 'JWT ' + token + 'bad')
                    .expect(401);
            });
    });
});
