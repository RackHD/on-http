// Copyright 2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Versions API', function () {

    var stubRun;

    before(function () {
        this.timeout(5000);

        stubRun = sinon.stub();
        function MockChildProcess() {}
        MockChildProcess.prototype.run = stubRun;

        return helper.startServer([
            dihelper.simpleWrapper(MockChildProcess, 'ChildProcess')
        ]);
    });

    beforeEach(function () {
        return helper.reset();
    });

    after(function () {
        return helper.stopServer();
    });

    describe('/api/common/versions', function() {

        it('GET should a package version structure', function () {
            stubRun.returns(Q.resolve({
                stdout: 'ii somePackage 1.0',
                stderr: undefined
            }));
            return helper.request().get('/api/common/versions/')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(1);
                    expect(res.body[0]).to.be.an("Object").with.property('package', 'somePackage');
                    expect(res.body[0]).to.be.an("Object").with.property('version', '1.0');
                });
        });

        it('GET should return a 501 error if dpkg command fails', function () {
            stubRun.returns(Q.reject({
                code: '-1'
            }));
            return helper.request().get('/api/common/versions/')
                .expect('Content-Type', /^application\/json/)
                .expect(501);
        });
    });

});
