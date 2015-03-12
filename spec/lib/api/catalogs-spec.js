// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Catalogs', function () {

    var Q;
    var Errors;
    var stubNeedByIdentifier;
    var stubFind;

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([]).then(function () {
            Q = helper.injector.get('Q');
            Errors = helper.injector.get('Errors');
            var w = helper.injector.get('Services.Waterline');
            stubNeedByIdentifier = sinon.stub(w.catalogs, "needByIdentifier");
            stubFind = sinon.stub(w.catalogs, "find");
        });
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    beforeEach("reset stubs", function() {
        stubFind.reset();
        stubNeedByIdentifier.reset();
    });

    describe("GET /catalogs", function() {

        it("should a list of all catalogs", function() {

            stubFind.returns(Q.resolve([
                {
                    id: '123',
                    node: '123',
                    source: 'foo',
                    data: { something: 'here' }
                }
            ]));

            return helper.request().get('/api/1.1/catalogs')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(1);
                    expect(res.body[0]).to.be.an("Object").with.property('id', "123");
                });
        });

        it("should return an empty array if no catalogs exist", function() {

            stubFind.returns(Q.resolve([]));

            return helper.request().get('/api/1.1/catalogs')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Array").with.length(0);
                });
        });

        it("should pass through query from query params", function() {
            stubFind.returns(Q.resolve([
                {
                    id: '123',
                    node: '123',
                    source: 'foo',
                    data: { something: 'here' }
                }
            ]));

            return helper.request().get('/api/1.1/catalogs?source=somesource')
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
            stubNeedByIdentifier.returns(Q.resolve({
                    id: '123',
                    node: '123',
                    source: 'foo',
                    data: { something: 'here' }
                }));

            return helper.request().get('/api/1.1/catalogs/123')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.have.property("node", "123");
                    expect(stubNeedByIdentifier.calledWith('123')).to.equal(true);
                    expect(res.body).to.be.an("Object").with.property('id', "123");
                });
        });

        it("should return a 404 if no catalogs can be found", function() {

            stubFind.returns(Q.reject(new Errors.NotFoundError('Not Found')));

            return helper.request().get('/api/1.1/catalogs')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });
});
