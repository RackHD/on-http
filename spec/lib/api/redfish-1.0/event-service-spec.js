// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Redfish Event Service', function () {
    var tv4;
    var validator;
    var redfish;
    var Promise;
    var Constants;
    var messenger;
    var subscription;
    var identifier;
    var eventDestination = {
        Destination: 'http://1.1.1.1:8080',
        EventTypes: [
            'Alert', 
            'StatusChange', 
            'ResourceAdded', 
            'ResourceUpdated', 
            'ResourceRemoved'
        ],
        Context: 'Event Context',
        Protocol: 'Redfish'
    };
    var events = {
        value: [{
            node: 'xyz',
            reading: {
                status: 'statusData',
                entryIdName: 'entryIdData',
                sensorReading: 'sensorReadingData',
                sensorReadingUnits: 'sensorReadingUnitsData',
                sensorId: 'sensorIdData',
                sdrType: 'Threshold'
            }
        }]
    };
    
    before('start HTTP server', function () {
        this.timeout(5000);
        function redfishTool() {
            this.clientRequest = sinon.stub(); // jshint ignore:line
        }
        helper.setupInjector([
            helper.di.simpleWrapper(redfishTool,'JobUtils.RedfishTool')
        ]);

        return helper.startServer([]).then(function () {
            Constants = helper.injector.get('Constants');
            Promise = helper.injector.get('Promise');
            
            redfish = helper.injector.get('Http.Api.Services.Redfish');
            sinon.spy(redfish, 'render');
            
            validator = helper.injector.get('Http.Api.Services.Schema');
            sinon.spy(validator, 'validate');
            
            var Subscription = helper.injector.get('Subscription');
            subscription = new Subscription({},{});
            
            messenger = helper.injector.get('Services.Messenger');
            sinon.stub(messenger);
            messenger.subscribe = sinon.spy(function(name,exchange,callback) {
                callback(eventDestination);
                return Promise.resolve(subscription);
            });
        });
    });

    beforeEach('set up mocks', function () {
        tv4 = require('tv4');
        sinon.spy(tv4, "validate");
        validator.validate.reset();
        redfish.render.reset();
    });

    afterEach('tear down mocks', function () {
        tv4.validate.restore();
    });

    after('stop HTTP server', function () {
        validator.validate.restore();
        redfish.render.restore();
        function restoreStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].restore) {
                  obj[method].restore();
                }
            }).value();
        }
        restoreStubs(messenger);
        return helper.stopServer();
    });

    it('should return a valid event service root', function () {
        return helper.request().get('/redfish/v1/EventService')
        .expect('Content-Type', /^application\/json/)
        .expect(200)
        .expect(function() {
            expect(tv4.validate.called).to.be.true;
            expect(validator.validate.called).to.be.true;
            expect(redfish.render.called).to.be.true;
        });
    });
   
    it('should create a valid subscription', function() {
        return helper.request().post('/redfish/v1/EventService/Subscriptions')
        .send(eventDestination)
        .expect('Content-Type', /^application\/json/)
        .expect(201)
        .expect(function(res) {
            expect(tv4.validate.called).to.be.true;
            expect(subscription).to.be.fullfilled;
            identifier = res.body.Id;
        });
    });
        
    it('should fail to create existing subscription', function() {
        return helper.request().post('/redfish/v1/EventService/Subscriptions')
        .send(eventDestination)
        .expect('Content-Type', /^application\/json/)
        .expect(409)
        .expect(function() {
            expect(tv4.validate.called).to.be.true;
        });
    });
           
    it('should return a valid subscription collection', function() {
        return helper.request().get('/redfish/v1/EventService/Subscriptions')
        .expect('Content-Type', /^application\/json/)
        .expect(200)
        .expect(function() {
            expect(tv4.validate.called).to.be.true;
            expect(validator.validate.called).to.be.true;
            expect(redfish.render.called).to.be.true;
        });
    });
    
    it('should return a valid subscription', function() {    
        return helper.request().get(
            '/redfish/v1/EventService/Subscriptions/' + identifier
        )
        .expect('Content-Type', /^application\/json/)
        .expect(200)
        .expect(function(res) {
            expect(tv4.validate.called).to.be.true;
            expect(validator.validate.called).to.be.true;
            expect(redfish.render.called).to.be.true;
            expect(res.body.Id).to.equal(identifier);
        });
    });
    
    it('should fail on invalid subscription', function() {    
        return helper.request().get(
            '/redfish/v1/EventService/Subscriptions/xyz'
        )
        .expect('Content-Type', /^application\/json/)
        .expect(404);
    });
    
    it('should submit test event', function() {
        return helper.request().post(
            '/redfish/v1/EventService/Actions/EventService.SubmitTestEvent'
        )
        .send({})
        .expect(200)
        .expect(function() {
            expect(tv4.validate.called).to.be.true;
        });
    });
    
    it('should handle alert event', function() {
        var eventService = helper.require('/lib/api/redfish-1.0/event-service.js');
        expect(eventService.eventCallback(events)).to.be.fullfilled;
    });
    
    it('should handle status event', function() {
        var eventService = helper.require('/lib/api/redfish-1.0/event-service.js');
        events.value[0].reading.sdrType = 'Discrete';
        events.value[0].reading.statesAsserted = ['AssertedState']; 
        expect(eventService.eventCallback(events)).to.be.fullfilled;
    });
    
    it('should handle resource event', function() {
        var eventService = helper.require('/lib/api/redfish-1.0/event-service.js');
        var resourceEvent = {
            value: {
                data: [{data:'data'}],
                EventType: 'ResourceUpdated',
                pollerName: 'FabricService'
            }
        };
        expect(eventService.eventCallback(resourceEvent)).to.be.fullfilled;
    });
    
    it('should delete a valid subscription', function() {    
        return helper.request()
        .delete('/redfish/v1/EventService/Subscriptions/' + identifier)
        .expect(200);
    });
    
    it('should fail to delete an ivalid subscription', function() {    
        return helper.request()
        .delete('/redfish/v1/EventService/Subscriptions/xyz')
        .expect(404);
    });
});
