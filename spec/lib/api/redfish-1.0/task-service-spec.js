// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish TaskService', function () {
    var tv4;
    var validator;
    var redfish;
    var waterline;
    var Promise;
    var Constants;
    var view;
    var fs;
    var graph;
    var Errors;

    // Skip reading the entry from Mongo and return the entry directly
    function redirectGet(entry) {
        return fs.readFileAsync(__dirname + '/../../../../data/views/redfish-1.0/' + entry, 'utf-8')
            .then(function(contents) {
                return { contents: contents };
            });
    }

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]).then(function () {
            Constants = helper.injector.get('Constants');

            view = helper.injector.get('Views');
            sinon.stub(view, "get", redirectGet);

            validator = helper.injector.get('Http.Api.Services.Schema');
            sinon.spy(validator, 'validate');
            redfish = helper.injector.get('Http.Api.Services.Redfish');
            sinon.spy(redfish, 'render');

            waterline = helper.injector.get('Services.Waterline');
            sinon.stub(waterline.graphobjects);
            sinon.stub(waterline.nodes);

            Promise = helper.injector.get('Promise');
            Errors = helper.injector.get('Errors');

            var nodeFs = helper.injector.get('fs');
            fs = Promise.promisifyAll(nodeFs);
        })
        .then(function() {
            graph = {
                id: '566afe8a7e7b8f3751b951a5',
                instanceId: '566afe8a7e7b8f3751b951a5',
                _status: Constants.Task.States.Pending,
                createdAt: '2016-01-21T17:51:23.395Z',
                updatedAt: '2016-01-21T17:52:23.395Z',
                name: 'isc-dhcp leases poller',
                node: 'abcdefg'
            };
        });
    });

    beforeEach('set up mocks', function () {
        tv4 = require('tv4');
        sinon.spy(tv4, "validate");

        validator.validate.reset();
        redfish.render.reset();

        function resetStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].reset) {
                  obj[method].reset();
                }
            }).value();
        }

        resetStubs(waterline.graphobjects);
        resetStubs(waterline.nodes);
    });

    afterEach('tear down mocks', function () {
        tv4.validate.restore();
    });

    after('stop HTTP server', function () {
        validator.validate.restore();
        redfish.render.restore();
        view.get.restore();

        function restoreStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].restore) {
                  obj[method].restore();
                }
            }).value();
        }

        restoreStubs(waterline.graphobjects);
        restoreStubs(waterline.nodes);
        return helper.stopServer();
    });

    it('should return a valid task service root', function () {
        waterline.graphobjects.find.resolves([graph]);
        waterline.nodes.findByIdentifier.resolves({ id: 'abcdefg'});

        return helper.request().get('/redfish/v1/TaskService')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid task collection', function () {
        waterline.graphobjects.find.resolves([graph]);
        return helper.request().get('/redfish/v1/TaskService/Tasks')
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should return a valid task from a collection', function () {
        waterline.graphobjects.find.resolves([graph]);
        return helper.request().get('/redfish/v1/TaskService/Tasks/' + graph.id)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid task', function () {
        waterline.graphobjects.find.resolves([graph]);
        return helper.request().get('/redfish/v1/TaskService/Tasks/' + graph.id + 'invalid')
            .expect(404);
    });

    it('should return a valid task from a system', function () {
        waterline.graphobjects.find.resolves([graph]);
        waterline.nodes.needByIdentifier.resolves();
        return helper.request().get('/redfish/v1/TaskService/Oem/Tasks/' + graph.node)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function() {
                expect(tv4.validate.called).to.be.true;
                expect(validator.validate.called).to.be.true;
                expect(redfish.render.called).to.be.true;
            });
    });

    it('should 404 an invalid system', function () {
        waterline.graphobjects.find.resolves([graph]);
        waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError());
        return helper.request().get('/redfish/v1/TaskService/Oem/Tasks/' + graph.node + 'invalid')
            .expect(404);
    });
});

