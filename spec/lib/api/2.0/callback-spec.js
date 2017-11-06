// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.
/* jshint node:true */

'use strict';

describe('Http.Api.Callback v2.0', function () {
    var eventsProtocol, Errors;
    var callbackId = "abc";
    var data = {"data": "test"};

    helper.httpServerBefore();

    before(function () {
        eventsProtocol = helper.injector.get('Protocol.Events');
        Errors = helper.injector.get('Errors');
    });

    helper.httpServerAfter();

    afterEach('Http.Api.Callback v2.0 afterEach', function(){
        this.sandbox.restore();
    });

    it('should return a 200 for ucsCallback success', function () {
        this.sandbox.stub(eventsProtocol, 'publishHttpResponseUuid').resolves();
        return helper.request('http://localhost:8091')
            .post('/api/2.0/ucsCallback')
            .query({callbackId: callbackId})
            .set('Content-Type', 'application/json')
            .send(data)
            .expect(200)
            .expect(function(){
                expect(eventsProtocol.publishHttpResponseUuid).to.be.calledOnce;
                expect(eventsProtocol.publishHttpResponseUuid).to.be.calledWith(callbackId, data);
            });
    });

    it('should return a 400 for ucsCallback failure', function () {
        this.sandbox.stub(eventsProtocol, 'publishHttpResponseUuid').resolves();
        return helper.request('http://localhost:8091')
            .post('/api/2.0/ucsCallback')
            .set('Content-Type', 'application/json')
            .send(data)
            .expect(400)
            .expect(function(){
                expect(eventsProtocol.publishHttpResponseUuid).to.not.be.calledOnce;
            });
    });

    it('should return a 201 for wsmanCallback success', function () {
        this.sandbox.stub(eventsProtocol, 'publishHttpResponseUuid').resolves();
        return helper.request('http://localhost:8091')
            .post('/api/2.0/wsmanCallback/abcde')
            .set('Content-Type', 'application/json')
            .send({options: {defaults: data}})
            .expect(201)
            .expect(function(){
                expect(eventsProtocol.publishHttpResponseUuid).to.be.calledOnce;
                expect(eventsProtocol.publishHttpResponseUuid).to.be.calledWith('abcde', data);
            });
    });

    it('should return a 400 for wsmanCallback failure', function () {
        this.sandbox.stub(eventsProtocol, 'publishHttpResponseUuid').resolves();
        return helper.request('http://localhost:8091')
            .post('/api/2.0/wsmanCallback/abcde')
            .set('Content-Type', 'application/json')
            .send(data)
            .expect(400)
            .expect(function(){
                expect(eventsProtocol.publishHttpResponseUuid).to.not.be.calledOnce;
            });
    });
    
});
