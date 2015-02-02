// Copyright 2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

var _ = require('lodash');

describe(require('path').basename(__filename), function () {
    var StompSubscription;
    var WaterlineResource;

    var collection;
    var waterline;

    beforeEach(function() {
        collection = {
            findSinceLastUpdate: sinon.stub(),
            identity: 'dummy',
            primaryKey: 'id'
        };

        var injector = helper.baseInjector.createChild(_.flatten([
            helper.require('/lib/stomp/waterline-resource.js'),
            dihelper.simpleWrapper(require('renasar-mq'), 'MQ')
        ]));

        StompSubscription = injector.get('MQ').StompSubscription;
        WaterlineResource = injector.get('Stomp.WaterlineResource');

        waterline = injector.get('Services.Waterline');
        waterline.observe = sinon.spy(function () {
            var observable = {
                subscribe: sinon.spy(function () {
                    var subscription =  {
                        dispose: sinon.stub()
                    };
                    return subscription;
                })
            };
            return observable;
        });
    });

    function createMockSubscription(params, query) {
        var subscription = sinon.createStubInstance(StompSubscription);
        subscription.headers = {};
        subscription.mapping = {
            params: params || {},
            query: query || {}
        };
        return subscription;
    }

    it('should observe to events on the collection', function () {
        var resource = new WaterlineResource(collection);
        resource.activate('/dummy');
        var subscription = createMockSubscription();
        resource.subscribe(subscription);

        expect(waterline.observe).to.have.been.calledOnce;
        expect(waterline.observe.returnValues[0].subscribe).to.have.been.calledOnce;
    });

    it('should query the collection if a last-updated header is provided', function () {
        var resource = new WaterlineResource(collection);
        resource.activate('/dummy');
        var subscription = createMockSubscription();
        subscription.headers['last-updated'] = 'Mon, 25 Dec 1995 11:30:00 GMT';
        collection.findSinceLastUpdate.returns(Promise.resolve([]));
        return resource.subscribe(subscription).then(function () {
            expect(collection.findSinceLastUpdate).to.have.been.calledOnce;
        });
    });


    it('should send create messages for new documents if a last-updated header is provided',
       function () {
        var doc = {
            id: '1',
            createdAt: new Date('Mon, 25 Dec 1995 20:30:00 GMT')
        };
        var resource = new WaterlineResource(collection);
        resource.activate('/dummy');
        var subscription = createMockSubscription();
        subscription.headers['last-updated'] = 'Mon, 25 Dec 1995 11:30:00 GMT';
        collection.findSinceLastUpdate.returns(Promise.resolve([doc]));
        return resource.subscribe(subscription).then(function () {
            expect(subscription.send).to.have.been.calledOnce;
            var firstArgs = subscription.send.firstCall.args;
            expect(firstArgs[0].$o).to.equal(doc);
            expect(firstArgs[0].$op).to.equal('i');
            expect(subscription.flush).to.have.been.calledOnce;
        });
    });

    it('should send update messages for updated documents if a last-updated header is provided',
       function () {
        var doc = {
            id: '2',
            createdAt: new Date('Mon, 25 Dec 1995 00:30:00 GMT')
        };
        var resource = new WaterlineResource(collection);
        resource.activate('/dummy');
        var subscription = createMockSubscription();
        subscription.headers['last-updated'] = 'Mon, 25 Dec 1995 11:30:00 GMT';
        collection.findSinceLastUpdate.returns(Promise.resolve([doc]));
        return resource.subscribe(subscription).then(function () {
            expect(subscription.send).to.have.been.calledOnce;
            var firstArgs = subscription.send.firstCall.args;
            expect(firstArgs[0].$o).to.have.property('id', doc.id);
            expect(firstArgs[0].$o2).to.have.property('createdAt', doc.createdAt);
            expect(firstArgs[0].$op).to.equal('u');
            expect(subscription.flush).to.have.been.calledOnce;
        });
    });

    it('should not query the collection if an invalid last-updated header is provided',
       function () {
        var resource = new WaterlineResource(collection);
        resource.activate('/dummy');
        var subscription = createMockSubscription();
        subscription.headers['last-updated'] = 'bad date';
        resource.subscribe(subscription);

        expect(collection.findSinceLastUpdate).to.not.have.been.called;
    });

    it('should send a created event back to the subscription', function () {
        var resource = new WaterlineResource(collection);
        resource.activate('/dummy');
        var subscription = createMockSubscription();
        resource.subscribe(subscription);

        var doc = {
            id: '1',
            dummy: 'value'
        };

        waterline.observe.returnValues[0].subscribe.yield({ event: 'created', record: doc });

        expect(subscription.send).to.have.been.calledOnce;
        var firstArgs = subscription.send.firstCall.args;
        expect(firstArgs[0].$o).to.equal(doc);
        expect(firstArgs[0].$op).to.equal('i');
    });

    it('should send an updated event back to the subscription', function () {
        var resource = new WaterlineResource(collection);
        resource.activate('/dummy');
        var subscription = createMockSubscription();
        resource.subscribe(subscription);

        var doc = {
            id: '2',
            dummy: 'value'
        };

        waterline.observe.returnValues[0].subscribe.yield({ event: 'updated', record: doc });

        expect(subscription.send).to.have.been.calledOnce;
        var firstArgs = subscription.send.firstCall.args;
        expect(firstArgs[0].$o).to.have.property('id', '2');
        expect(firstArgs[0].$o2).to.have.property('dummy', 'value');
        expect(firstArgs[0].$op).to.equal('u');
    });

    it('should send an destroyed event back to the subscription', function () {
        var resource = new WaterlineResource(collection);
        resource.activate('/dummy');
        var subscription = createMockSubscription();
        resource.subscribe(subscription);

        var doc = {
            id: '3',
        };

        waterline.observe.returnValues[0].subscribe.yield({ event: 'destroyed', record: doc });

        expect(subscription.send).to.have.been.calledOnce;
        var firstArgs = subscription.send.firstCall.args;
        expect(firstArgs[0].$o).to.equal(doc);
        expect(firstArgs[0].$op).to.equal('d');
    });

    it('should send an event to a parameterized subscription', function () {
        var resource = new WaterlineResource(collection);
        resource.activate('/dummy');
        var subscription = createMockSubscription({ dummyId: '4' });
        resource.subscribe(subscription);
        expect(waterline.observe).to.have.been.calledOnce;
        expect(waterline.observe.firstCall.args[1]).to.have.property('id', '4');

        var doc = {
            id: '4',
            dummy: 'value'
        };

        waterline.observe.returnValues[0].subscribe.yield({ event: 'created', record: doc });

        expect(subscription.send).to.have.been.calledOnce;
        var firstArgs = subscription.send.firstCall.args;
        expect(firstArgs[0].$o).to.equal(doc);
        expect(firstArgs[0].$op).to.equal('i');
    });

    it('should properly generate a query that needs values from path variables', function () {
        var resource = new WaterlineResource(collection, { parent: '$:parentId' });
        resource.activate('/parent/:parentId/children');

        var subscription = createMockSubscription({ parentId: '987' });
        resource.subscribe(subscription);

        expect(waterline.observe).to.have.been.calledOnce;
        expect(waterline.observe.firstCall.args[1])
            .to.have.property('parent', '987');
    });
});
