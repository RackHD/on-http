// Copyright 2017, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Metadata', function () {
    var waterline;
    var Promise;
    var fs;
    var accountService;
    var fromRoot = process.cwd();

    var userObj = {
        username: 'admin',
        password: 'admin123',
        role: 'Administrator'
    };

    helper.httpServerBefore([], { authEnabled: true });

    before(function () {
        waterline = helper.injector.get('Services.Waterline');
        Promise = helper.injector.get('Promise');
        fs = Promise.promisifyAll( helper.injector.get('fs') );
        accountService = helper.injector.get('Http.Services.Api.Account');
    });

    beforeEach('set up mocks', function() {
        this.sandbox.stub(waterline.localusers, 'findOne');
        waterline.localusers.findOne.withArgs({username: 'admin'}).resolves({
            username: userObj.username,
            comparePassword: function(password) { return password === 'admin123'; },
            role: userObj.role
        });
        return Promise.all([
            accountService.aclMethod('addUserRoles', 'admin', 'Administrator')
        ]);
    });

    helper.httpServerAfter();

    it('should return the correct metada', function () {
        return Promise.resolve()
            .then(function(){
                return fs.readFileAsync(fromRoot + '/static/redfishMetadata.xml', 'utf8');
            })
            .then(function(fileContent){
                return helper.request().get('/redfish/v1/$metadata')
                    .auth('admin', 'admin123')
                    .expect('Content-Type', "application/xml; charset=utf-8")
                    .expect(200)
                    .expect(function(res) {
                        expect(res.text).to.equal(fileContent);
                    });
            });
    });

});

