// Copyright © 2016-2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

describe('Http.Services.Api.Templates', function () {
    var Errors;
    var templateApiService;
    var Promise;
    var taskGraphService;
    var templates;

    before('Http.Services.Api.Templates before', function() {
        helper.setupInjector([
            onHttpContext.injectables,
            onHttpContext.prerequisiteInjectables
        ]);
        Errors = helper.injector.get('Errors');
        Promise = helper.injector.get('Promise');
        templateApiService = helper.injector.get('Http.Services.Api.Templates');
        //this.subject = new templateApiService();
        taskGraphService = helper.injector.get('Http.Services.Api.Taskgraph.Scheduler');
        templates = helper.injector.get('Templates');

    });

    beforeEach(function() {

        this.sandbox = sinon.sandbox.create();
        this.sandbox.stub(taskGraphService, 'templatesLibGet');
        this.sandbox.stub(taskGraphService, 'templatesMetaGet');
        this.sandbox.stub(taskGraphService, 'templatesMetaGetByName');
        this.sandbox.stub(taskGraphService, 'templatesLibPut');
    });

    afterEach('Http.Services.Api.Templates afterEach', function() {
        this.sandbox.restore();
    });


    it('should return a template content  ', function() {
        var templateContent = "templateContent";
        taskGraphService.templatesLibGet.resolves(templateContent);
        templateApiService.templatesLibGet("name", "scope")
            .then(function(data){
                expect(data).to.equal(templateContent);
            });
    });

    it('should GET Metadata template content  ', function() {
        var templateContent = [{
            createdAt: "2017-09-19T14:28:42.863Z",
            hash: "fTunVY2AdHFQ/lH1eomEag==",
            name: "ansible-external-inventory.js",
            path: "/home/rackhd/git/2rackhd/rackhd/on-taskgraph/data/templates/ansible-external-inventory.js",
            scope: "global",
            updatedAt: "2017-09-19T17:55:33.609Z",
            id: "dcebbfaf-7af4-4363-98dd-f0717381f6c0"
        }];
        taskGraphService.templatesMetaGet.resolves(templateContent);
        templateApiService.templatesMetaGet()
            .then(function(data){
                expect(data).to.equal(templateContent);
            });
    });

    it('should GET Metadata template by name  ', function() {
        var templateContent = [{
            createdAt: "2017-09-19T14:28:42.863Z",
            hash: "fTunVY2AdHFQ/lH1eomEag==",
            name: "ansible-external-inventory.js",
            path: "/home/rackhd/git/2rackhd/rackhd/on-taskgraph/data/templates/ansible-external-inventory.js",
            scope: "global",
            updatedAt: "2017-09-19T17:55:33.609Z",
            id: "dcebbfaf-7af4-4363-98dd-f0717381f6c0"
        }];
        taskGraphService.templatesMetaGetByName.resolves(templateContent);
        templateApiService.templatesMetaGetByName()
            .then(function(data){
                expect(data).to.equal(templateContent);
            });
    });

    it('should create a new thing in the specified scope', function() {
        var EventEmitter = require('events').EventEmitter;
        var stream = new EventEmitter();
        var promise;
            
        promise =  templateApiService.templatesLibPut('test thing', stream, 'sku');
        taskGraphService.templatesLibPut.resolves("test thing");
        stream.emit('data', new Buffer('test '));
        stream.emit('data', new Buffer('thing'));
        stream.emit('end');
        return promise.then(function(thing) {
            expect(thing).to.equal('test thing');

        });
    });
});
