// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.
/* jshint node:true */

"use strict";

require('../../helper');

describe("Http.Services.Taskgraph", function () {
    var tgApi;
    var Consul = require('../../mock-consul-server.js');
    var mockConsul;
    var mockGrpc = require('../../mock-grpc.js');
    var configuration;

    before("Http.Services.Taskgraph before", function() {
        helper.setupInjector([
            helper.require('/lib/services/taskgraph-api-service'),
        ]);
        mockConsul = new Consul();
        configuration = helper.injector.get('Services.Configuration');
        configuration.set('consulUrl', 'consul://localhost:8500');
        tgApi = helper.injector.get('Http.Services.Api.Taskgraph.Scheduler');
    });

    after('Http.Services.Taskgraph after', function() {
        configuration.set('consulUrl', undefined);
    });

    beforeEach("Http.Services.Taskgraph before", function() {
        mockConsul.agent.service.serviceList.length = 0;
    });

   describe("empty service list", function() {
        it("should reject with no registered services", function() {
            return tgApi.getTasksById(123).should.be.rejectedWith(/No registered service found/);
        });

       it("should reject with no registered services", function() {
           return tgApi.templatesLibGet(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.templatesLibPut(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.templatesMetaGet(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.templatesMetaGetByName(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.profilesGetMetadata(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.profilesGetLibByName(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.profilesPutLibByName(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.profilesGetMetadata(123).should.be.rejectedWith(/No registered service found/);
       });



       it("should reject with no registered services", function() {
           return tgApi.workflowsGetGraphs(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.workflowsGetGraphsByName(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.workflowsPutGraphs(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.workflowsDeleteGraphsByName(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.workflowsGetByInstanceId(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.workflowsAction(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.workflowsDeleteByInstanceId(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.workflowsPutTask(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.workflowsGetAllTasks(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.workflowsGetTasksByName(123).should.be.rejectedWith(/No registered service found/);
       });

       it("should reject with no registered services", function() {
           return tgApi.workflowsDeleteTasksByName(123).should.be.rejectedWith(/No registered service found/);
       });



    });

    describe("invalid service", function() {
        it("should reject if specified service not registered", function() {
            mockConsul.agent.service.register({
                aaa: {
                    Service: 'foo',
                    ID: 'fooId',
                    Tags: ['scheduler'],
                    Address: 'grpcAddress',
                    Port: 31000
                }
            });
            return tgApi.getTasksById(123).should.be.rejectedWith(/No registered service found/);
        });
    });

    describe("getTaskById reject", function() {
        it("should reject invalid identifier", function () {
            mockConsul.agent.service.register({
                bbbb: {
                    Service: 'taskgraph',
                    ID: 'testID',
                    Tags: ['scheduler'],
                    Address: 'grpcAddress',
                    Port: 31000
                }
            });
            return tgApi.getTasksById(undefined).should.be.rejectedWith(/invalid task id/);
        });
    });

    describe("getTaskById fulfill", function() {
        it("should resolve", function() {
            mockConsul.agent.service.register({
                bbbb: {
                    Service: 'taskgraph',
                    ID: 'testID',
                    Tags: ['scheduler'],
                    Address: 'grpcAddress',
                    Port: 31000
                }
            });
            mockGrpc.setResponse('[{"node":"581a41cd30c24078070f9deb","_status":"succeeded"}]');
            return tgApi.getTasksById(123).should.be.fulfilled;
        });
    });

        /*
        Possible future unit tests:

        it("should reject non-existent task", function() {
            return tgApi.getTasksById('does-not-exist').should.be.rejectedWith(/task not found/);
        });

        it("should reject if no taskgraph service is not registered", function() {
            var tasksCollection = {
                '1234': {
                    foo: 'bar'
                }
            };
            tgApi.populate('tasks', tasksCollection);
            tgApi.services.none();
            return tgApi.getTasksById('1234').should.be.rejecteWith(/No registered service/);
        });

        it("should reject if no taskgraph service is not available", function() {
            var tasksCollection = {
                '1234': {
                    foo: 'bar'
                }
            };
            tgApi.populate('tasks', tasksCollection);
            tgApi.services.down();
            return tgApi.getTasksById('1234').should.be.rejecteWith(/No service available/);
        });

        it("should resolve to specified task", function() {
            var tasksCollection = {
                '1234': {
                    foo: 'bar'
                }
            };
            tgApi.populate('tasks', tasksCollection);
            return tgApi.getTasksById('1234').should.eventually.deep.equal(taskCollection[0]['1234']); // jshint ignore:line
        });
        */

});
