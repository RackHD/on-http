// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Services.Api.Versions', function () {
    var stubRun;
    var versionsService;

    before('start HTTP server', function () {
        stubRun = sinon.stub();
        function MockChildProcess() {}
        MockChildProcess.prototype.run = stubRun;

        helper.setupInjector([
            helper.require("/lib/services/versions-api-service"),
            dihelper.simpleWrapper(MockChildProcess, 'ChildProcess')
        ]);

        versionsService = helper.injector.get('Http.Services.Api.Versions');

    });

    it('should expose the appropriate methods', function() {
        versionsService.should.have.property('findVersion')
            .that.is.a('function').with.length(0);
    });

    it('should return a list of installed packages', function() {
        stubRun.resolves({
            stdout: 'ii somePackage 1.0',
            stderr: undefined
        });

        var installedVersions = [{
            package: 'somePackage',
            version: '1.0'
        }];

        return versionsService.findVersion().should.eventually.become(installedVersions);
    });

    it('should return an empty array if no installed packages are found', function() {
        stubRun.resolves({
            stdout: 'rc somePackage 1.0',
            stderr: undefined
        });

        var installedVersions = [];

        return versionsService.findVersion().should.eventually.become(installedVersions);
    });

    it('should return an error if package detection fails', function() {
        stubRun.resolves({
            code: '-1'
        });

        var errorMessage = {
            error: 'Not Implemented'
        };

        return versionsService.findVersion().should.eventually.become(errorMessage);
    });
});
