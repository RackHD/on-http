// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('2.0 Http.Api.Catalogs', function () {

    var Promise;
    var Errors;
    var stubNeedByIdentifier;
    var stubFind;

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]).then(function () {
            Promise = helper.injector.get('Promise');
            Errors = helper.injector.get('Errors');
            var w = helper.injector.get('Services.Waterline');
            stubNeedByIdentifier = sinon.stub(w.catalogs, "needByIdentifier");
            stubFind = sinon.stub(w.catalogs, "find");
        });
    });

    beforeEach('loading views', function(){
        return helper.injector.get('Views').load();
    });

    afterEach("reset stubs", function() {
        stubFind.reset();
        stubNeedByIdentifier.reset();
    });

    after('stop HTTP server', function () {
        stubFind.restore();
        stubNeedByIdentifier.restore();
        return helper.stopServer();
    });

    describe("GET /catalogs", function() {

        it("should a list of all catalogs", function() {

            stubFind.returns(Promise.resolve([
                {
                    id: '123',
                    node: '123',
                    source: 'foo',
                    data: { something: 'here' }
                }
            ]));

            return helper.request().get('/api/2.0/catalogs')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(1);
                    expect(res.body[0]).to.be.an("Object").with.property('id', "123");
                });
        });

        it("should return an empty array if no catalogs exist", function() {

            stubFind.returns(Promise.resolve([]));

            return helper.request().get('/api/2.0/catalogs')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(0);
                });
        });

        it("should pass through query from query params", function() {
            stubFind.returns(Promise.resolve([
                {
                    id: '123',
                    node: '123',
                    source: 'foo',
                    data: { something: 'here' }
                }
            ]));

            return helper.request().get('/api/2.0/catalogs?source=somesource')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(1);
                    expect(stubFind.firstCall).to.have.been.calledWith({source: 'somesource'});
                });

        });
    });

    describe("GET /catalogs/:identifier", function() {

        it("should return an individual catalog", function() {
            stubNeedByIdentifier.returns(Promise.resolve({
                    id: '123',
                    node: '123',
                    source: 'foo',
                    data: { something: 'here' }
                }));

            return helper.request().get('/api/2.0/catalogs/123')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property("node", "/api/2.0/nodes/123");
                    expect(stubNeedByIdentifier.calledWith('123')).to.equal(true);
                    expect(res.body).to.be.an("Object").with.property('id', "123");
                });
        });

        it("should return a 404 if no catalogs can be found", function() {

            stubFind.returns(Promise.reject(new Errors.NotFoundError('Not Found')));

            return helper.request().get('/api/2.0/catalogs')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });
});
