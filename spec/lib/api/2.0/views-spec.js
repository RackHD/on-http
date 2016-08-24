// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Views', function () {
    var Promise;
    var viewsProtocol;
    var _;
    var ejs;

    before('start HTTP server', function () {
        this.timeout(10000);
        return helper.startServer([
        ]).then(function() {
            _ = helper.injector.get('_');
            viewsProtocol = helper.injector.get('Views');
            ejs = helper.injector.get('ejs');
            Promise = helper.injector.get('Promise');
            sinon.stub(viewsProtocol, 'load');
            sinon.stub(viewsProtocol, 'getAll');
            sinon.stub(viewsProtocol, 'get');
            sinon.stub(viewsProtocol, 'put');
            sinon.stub(viewsProtocol, 'unlink');
        });
    });

    afterEach('reset stubs', function () {
        _(viewsProtocol).methods().forEach(function (method) {
            if (viewsProtocol[method].reset) {
              viewsProtocol[method].reset();
            }
        }).value();
    });

    after('stop HTTP server', function () {
        _(viewsProtocol).methods().forEach(function (method) {
            if (viewsProtocol[method].restore) {
              viewsProtocol[method].restore();
            }
        }).value();
        return helper.stopServer();
    });

    describe('2.0 Views', function() {
        before(function() {
            sinon.stub(viewsProtocol, 'render', function(viewName, options) {
                switch(viewName) {
                    case 'renderable.2.0.json':
                        return Promise.resolve(
                            JSON.stringify(_.omit(options, '_', 'Constants', 'basepath'))
                        );
                    case 'collection.2.0.json':
                        return Promise.map(options.collection, function(item) {
                            return JSON.parse(item);
                        }).then(function(parsed) {
                            return JSON.stringify(parsed);
                        });
                    default:
                        return Promise.resolve();
                };
            });
            sinon.stub(ejs, 'render', function(template, options) {
                return Promise.resolve(
                    JSON.stringify(_.omit(options, '_', 'Constants', 'basepath'))
                );
            });
        });

        after(function() {
            viewsProtocol.render.restore();
            viewsProtocol.get.reset();
            ejs.render.restore();
        });

        it('should get all views', function() {
            var views = [
                {name: 'foo', scope: 'global', id: '1', hash: '1234'},
                {name: 'bar', scope: 'global', id: '2', hash: '5678'}
            ];
            viewsProtocol.get.resolves(views[0]);
            viewsProtocol.getAll.resolves(views);
            return helper.request().get('/api/2.0/views')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res) {
                    res.body.forEach(function(view, i) {
                        expect(view.name).to.equal(views[i].name);
                        expect(view.scope).to.equal(views[i].scope);
                        expect(view.id).to.equal(views[i].id);
                        expect(view.hash).to.equal(views[i].hash);
                    });
                    expect(viewsProtocol.getAll).to.have.been.calledOnce;
                });
        });

        it('should get one view', function() {
            var view = {name: 'foo', scope: 'global', id: '1', hash: '1234'};

            viewsProtocol.get.resolves(view);
            return helper.request().get('/api/2.0/views/foo')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res) {
                    expect(res.body.name).to.equal(view.name);
                    expect(res.body.scope).to.equal(view.scope);
                    expect(res.body.id).to.equal(view.id);
                    expect(res.body.hash).to.equal(view.hash);
                    expect(viewsProtocol.get).to.have.been.calledOnce;
                    expect(viewsProtocol.get).to.have.been.calledWith('foo');
                });
        });
    });

    describe('2.0 Views', function() {
        before(function() {
            sinon.stub(viewsProtocol, 'render').resolves('{"message": "error"}');
        });

        after(function() {
            viewsProtocol.render.restore();
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
                .expect(201)
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
                .send('{ "message": "hello" }')
                .expect(201)
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
