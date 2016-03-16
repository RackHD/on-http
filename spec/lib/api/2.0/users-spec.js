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

    var waterline;
    
    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([], { authEnabled: true })
        .then(function() {
            waterline = helper.injector.get('Services.Waterline');
            sinon.stub(waterline.localusers, 'create');
            sinon.stub(waterline.localusers, 'find');
            sinon.stub(waterline.localusers, 'findOne');
            sinon.stub(waterline.localusers, 'update');
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
            waterline.localusers.findOne.resolves();
        });
    });

    beforeEach(function() {
        waterline.localusers.create.reset();
        waterline.localusers.find.reset();
        waterline.localusers.update.reset();
        waterline.localusers.findOne.reset();
    });

    it('should 201 a user post attempt with localexception', function() {
        waterline.localusers.find.resolves([]);
        waterline.localusers.create.resolves(userObj);
        return helper.request().post('/api/2.0/users')
            .send(userObj)
            .expect('Content-Type', /^application\/json/)
            .expect(201, {
                username: userObj.username,
                role: userObj.role
            })
            .expect(function() {
                expect(waterline.localusers.find).to.have.been.calledOnce;
                expect(waterline.localusers.create).to.have.been.calledWith(userObj);
            });
    });

    it('should 401 a user post attempt without auth tokens', function() {
        waterline.localusers.find.resolves([ userObj ]);
        return helper.request().post('/api/2.0/users')
            .send(userObj)
            .expect('Content-Type', /^application\/json/)
            .expect(401)
            .expect(function() {
                expect(waterline.localusers.find).to.have.been.calledOnce;
            });
    });

    it('should 201 a user post attempt with auth tokens', function() {
        waterline.localusers.create.resolves(readOnlyObj);
        waterline.localusers.find.resolves([ userObj ]);
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
        waterline.localusers.update.resolves(readOnlyObj);
        waterline.localusers.find.resolves([ userObj ]);
        return helper.request().post('/login')
            .send({username: "admin", password: "admin123"})
            .expect(200)
            .then(function(res) {
                return res.body.token;
            }).then(function(token) {
                return helper.request().put('/api/2.0/users')
                    .set("authorization", 'JWT ' + token)
                    .send(readOnlyObj)
                    .expect('Content-Type', /^application\/json/)
                    .expect(200);
            });
    });

    after('stop HTTP server', function () {
        waterline.localusers.create.restore();
        waterline.localusers.find.restore();
        waterline.localusers.findOne.restore();
        waterline.localusers.update.restore();
        return helper.stopServer();
    });

});
