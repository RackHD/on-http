// Copyright 2016, EMC, Inc.

'use strict';

describe('Http.Api.Notification', function () {
    var notificationApiService;
    var taskProtocol;

    var notificationMessage = {
        taskId: "73b8ca01-735b-40d6-897a-7003ef2fa988",
        data: 'dummy data'
    };

     var activeTask = {
         taskId: notificationMessage.taskId,
     };

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]);
    });

    beforeEach('set up mocks', function () {
        notificationApiService = helper.injector.get('Http.Services.Api.Notification');
        taskProtocol = helper.injector.get('Protocol.Task');

        sinon.stub(taskProtocol, 'activeTaskExists').resolves(activeTask);
    });

    afterEach('teardown mocks', function () {
        function resetMocks(obj) {
            _(obj).methods().forEach(function (method) {
                if (typeof obj[method].restore === 'function') {
                    obj[method].restore();
                }
            }).value();
        }
        resetMocks(taskProtocol);
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    describe('POST /notification', function () {
        it('should return notification detail', function () {
            return helper.request()
            .post(
                '/api/current/notification?taskId='
                + notificationMessage.taskId 
                + '&data='
                + notificationMessage.data)
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(201, notificationMessage);
        });

        it('should fail with no taskId in query parameter', function () {
            return helper.request()
            .post(
                '/api/current/notification?'
                + 'data='
                + notificationMessage.data)
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(400, { message: 'Missing task ID in query or body' });
        });

        it('should fail with no data in query parameter', function () {
            return helper.request()
            .post(
                '/api/current/notification?taskId='
                + notificationMessage.taskId)
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(400, { message: 'Missing notification data in query or body' });
        });

        it('should fail with invalid task ID in query parameter', function () {
            return helper.request()
            .post(
                '/api/current/notification?taskId='
                + 'I_am_not_a_valid_task_id'
                + '&data='
                + notificationMessage.data)
            .set('Content-Type', 'application/json')
            .expect('Content-Type', /^application\/json/)
            .expect(400, { message: 'Invalid taskId, uuid expected' });
        });

        it('should pass with taskId in query body', function () {
            return helper.request()
            .post('/api/current/notification?data=' + notificationMessage.data)
            .send({taskId: notificationMessage.taskId})
            .expect('Content-Type', /^application\/json/)
            .expect(201, notificationMessage);
        });

        it('should pass with data in query body', function () {
            return helper.request()
            .post('/api/current/notification?taskId=' + notificationMessage.taskId)
            .send({data: notificationMessage.data})
            .expect('Content-Type', /^application\/json/)
            .expect(201, notificationMessage);
        });

        it('should pass with data as an object in query body', function () {
            var mockDataObj = {
                taskId: notificationMessage.taskId,
                data: { type: "I_am_the_type", data: "I_am_the_data"} 
            };
            return helper.request()
            .post('/api/current/notification?taskId=' + notificationMessage.taskId)
            .send(mockDataObj)
            .expect('Content-Type', /^application\/json/)
            .expect(201, mockDataObj);
        });

    });

});
