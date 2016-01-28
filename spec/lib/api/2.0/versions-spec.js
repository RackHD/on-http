// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Versions', function () {

    var stubRun;

    before('start HTTP server', function () {
        this.timeout(5000);

        stubRun = sinon.stub();
        function MockChildProcess() {}
        MockChildProcess.prototype.run = stubRun;

        return helper.startServer([
            dihelper.simpleWrapper(MockChildProcess, 'ChildProcess')
        ]);
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    describe('GET 2.0/versions', function() {
        it('should return a package version structure', function () {
            stubRun.resolves({
                stdout: 'ii somePackage 1.0',
                stderr: undefined
            });
            return helper.request().get('/api/2.0/versions/')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(1);
                    expect(res.body[0]).to.be.an("Object").with.property('package', 'somePackage');
                    expect(res.body[0]).to.be.an("Object").with.property('version', '1.0');
                });
        });

        it('should return a 501 error if dpkg command fails', function () {
            stubRun.resolves({
                code: '-1'
            });
            return helper.request().get('/api/2.0/versions/')
                .expect('Content-Type', /^application\/json/)
                .expect(501);
        });
    });
});
