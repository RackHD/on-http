// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Nodes', function () {

    var Q;
    var stubFindByIdentifier;
    var stubFindLatestCatalogOfSource;

    before('start HTTP server', function () {
        this.timeout(5000);
        return helper.startServer([
        ]).then(function () {
            Q = helper.injector.get('Q');
            var w = helper.injector.get('Services.Waterline');
            stubFindByIdentifier = sinon.stub(w.nodes, "findByIdentifier");
            stubFindLatestCatalogOfSource = sinon.stub(w.catalogs, "findLatestCatalogOfSource");
        });

    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    describe('GET /nodes/:identifier/catalogs/:source', function() {
        it('should return a single catalog', function () {

            stubFindByIdentifier.returns(Q.resolve({
                id: '123',
                name: '123'
            }));
            stubFindLatestCatalogOfSource.returns(Q.resolve(
                {
                    node: '123',
                    source: 'dummysource',
                    data: {
                        foo: 'bar'
                    }
                }
            ));

            return helper.request().get('/api/1.1/nodes/123/catalogs/dummysource')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(res.body).to.be.an("Object").with.property('source', 'dummysource');
                    expect(res.body).to.be.an("Object").with.property('node', '123');
                });
        });

        it('should return a 404 if an empty list is returned', function () {

            stubFindByIdentifier.returns(Q.resolve({
                id: '123',
                name: '123'
            }));
            stubFindLatestCatalogOfSource.returns(Q.resolve());

            return helper.request().get('/api/1.1/nodes/123/catalogs/dummysource')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });

        it("should return a 404 if the node wasn't found", function () {

            stubFindByIdentifier.returns(Q.resolve());

            return helper.request().get('/api/1.1/nodes/123/catalogs/dummysource')
                .expect('Content-Type', /^application\/json/)
                .expect(404);
        });
    });

});
