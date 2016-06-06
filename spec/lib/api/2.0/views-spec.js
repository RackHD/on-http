// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Views', function () {
    var viewsProtocol;
    var _;

    before('start HTTP server', function () {
        this.timeout(10000);
        viewsProtocol = {
            load: sinon.stub(),
            getAll: sinon.stub(),
            get: sinon.stub(),
            put: sinon.stub(),
            unlink: sinon.stub()
        };

        return helper.startServer([
            dihelper.simpleWrapper(viewsProtocol, 'Views')
        ]).then(function() {
            _ = helper.injector.get('_');
        });
    });

    beforeEach('reset stubs', function () {
        _(viewsProtocol).methods().forEach(function (method) {
            if (_(viewsProtocol).has(method)) {
              viewsProtocol[method].reset();
            }
        }).value();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    describe('2.0 Views', function() {
        // should create a view (octet-stream)
        it('should get all views', function() {
            var views = [
                {name: 'foo', content: 'foo', scope: 'global'},
                {name: 'bar', content: 'bar', scope: 'global'}
            ];
            viewsProtocol.getAll.resolves(views);
            return helper.request().get('/api/2.0/views')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res) {
                    res.body.forEach(function(view, i) {
                        expect(view).to.deep.equal(views[i]);
                    });
                    expect(viewsProtocol.getAll).to.have.been.calledOnce;
                });
        });

        it('should get one view', function() {
            var view = {name: 'foo', content: 'foo', scope: 'global'};

            viewsProtocol.get.resolves(view);
            return helper.request().get('/api/2.0/views/foo')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res) {
                    expect(res.body).to.deep.equal(view);
                    expect(viewsProtocol.get).to.have.been.calledOnce;
                    expect(viewsProtocol.get).to.have.been.calledWith('foo');
                });
        });

        it('should fail to get non-existant view', function() {
            viewsProtocol.get.resolves();
            return helper.request().get('/api/2.0/views/foo')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .expect(function() {
                    expect(viewsProtocol.get).to.have.been.calledOnce;
                    expect(viewsProtocol.get).to.have.been.calledWith('foo');
                });
        });

        it('should create a text/plain view', function() {
            var view = {name: 'foo', content: 'foo', scope: 'global'};

            viewsProtocol.put.resolves(view);
            return helper.request().put('/api/2.0/views/foo')
                .set('Content-Type', 'text/plain')
                .send('{ "message": "hello" }')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res) {
                    expect(res.body).to.deep.equal(view);
                    expect(viewsProtocol.put).to.have.been.calledOnce;
                });
        });

        it('should create an application/octet-stream view', function() {
            var view = {name: 'foo', content: 'foo', scope: 'global'};
            viewsProtocol.put.resolves(view);

            return helper.request().put('/api/2.0/views/foo')
                .set('Content-Type', 'application/octet-stream')
                .send(new Buffer('{ "message": "hello" }', 'ascii'))
                .expect(200)
                .expect(function(res) {
                    expect(res.get('Content-Type')).to.match(/^application\/json/);
                    expect(res.body).to.deep.equal(view);
                    expect(viewsProtocol.put).to.have.been.calledOnce;
                });
        });

        it('should reject invalid data type', function() {
            return helper.request().put('/api/2.0/views/foo')
                .set('Content-Type', 'text/html')
                .send('{ "message": "hello" }')
                .expect('Content-Type', /^application\/json/)
                .expect(400)
                .expect(function() {
                    expect(viewsProtocol.put).not.to.have.been.called;
                });
        });

        it('should delete a view', function() {
            var view = {name: 'foo', content: 'foo', scope: 'global'};

            viewsProtocol.unlink.resolves(view);
            return helper.request().delete('/api/2.0/views/foo')
                .expect(204)
                .expect(function() {
                    expect(viewsProtocol.unlink).to.have.been.calledOnce;
                    expect(viewsProtocol.unlink).to.have.been.calledWith('foo');
                });
        });

        it('should fail to delete non-existant view', function() {
            viewsProtocol.unlink.resolves();
            return helper.request().delete('/api/2.0/views/foo')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .expect(function() {
                    expect(viewsProtocol.unlink).to.have.been.calledOnce;
                    expect(viewsProtocol.unlink).to.have.been.calledWith('foo');
                });
        });
    });
});
