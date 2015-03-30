// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

"use strict";

describe("Http.Services.Api.Profiles", function () {
    var profileApiService;
    var Errors;
    var taskProtocol;

    before("Http.Services.Api.Profiles before", function() {
        helper.setupInjector([
            helper.require("/lib/services/profiles-api-service")
        ]);
        profileApiService = helper.injector.get("Http.Services.Api.Profiles");
        Errors = helper.injector.get("Errors");
        taskProtocol = helper.injector.get("Protocol.Task");
        sinon.stub(taskProtocol, "requestProperties");
    });

    beforeEach("Http.Services.Api.Profiles beforeEach", function() {
        taskProtocol.requestProperties.reset();
    });

    after("Http.Services.Api.Profiles after", function() {
        taskProtocol.requestProperties.restore();
    });

    it("waitForDiscoveryStart should retry twice if task is not initially online", function() {
        taskProtocol.requestProperties.onFirstCall().rejects(new Errors.RequestTimedOutError(""));
        taskProtocol.requestProperties.onSecondCall().rejects(new Errors.RequestTimedOutError(""));
        taskProtocol.requestProperties.onThirdCall().resolves();

        return profileApiService.waitForDiscoveryStart("testnodeid")
        .then(function() {
            expect(taskProtocol.requestProperties).to.have.been.calledThrice;
        });
    });
});
