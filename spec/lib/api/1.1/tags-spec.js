// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Tags', function () {
    var taskGraphProtocol;
    var waterline;
    var input = {
            name: 'tag-name',
            rules: [
                {
                    path: 'dmi.dmi.base_board.manufacturer',
                    contains: 'Intel'
                },
                {
                    path: 'dmi.memory.total',
                    equals: '32946864kB'
                }
            ]
        };
    var node = {
        id: 1,
        name: 'test-node'
    };

    before('start HTTP server', function () {
        this.timeout(5000);
        taskGraphProtocol = {
            runTaskGraph: sinon.stub()
        };
        helper.setupInjector([
            helper.require("/lib/services/sku-pack-service"),
            dihelper.simpleWrapper(function() { arguments[1](); }, 'rimraf')
        ]);
        return helper.startServer([
            dihelper.simpleWrapper(taskGraphProtocol, 'Protocol.TaskGraphRunner')
        ]).then(function() {
            waterline = helper.injector.get('Services.Waterline');
            sinon.stub(waterline.nodes, "find");
            sinon.stub(waterline.tags, "find");
            sinon.stub(waterline.tags, "findOne");
            sinon.stub(waterline.tags, "destroy");
        });
    });

    beforeEach('reset stubs', function () {
        waterline.nodes.find.reset();
        waterline.tags.find.reset();
        waterline.tags.destroy.reset();
        waterline.tags.findOne.reset();
        waterline.nodes.find.resolves([node]);
        waterline.tags.find.resolves([input]);
        waterline.tags.findOne.resolves(input);
        waterline.tags.destroy.resolves();
        taskGraphProtocol.runTaskGraph.reset();
    });

    after('stop HTTP server', function () {
        return helper.stopServer().then(function() {
            waterline.nodes.find.restore();
            waterline.tags.find.restore();
            waterline.tags.destroy.restore();
            waterline.tags.findOne.restore();
        });
    });

    it('should return an empty array from GET /tags', function () {
        waterline.tags.find.resolves([]);
        return helper.request().get('/api/1.1/tags')
            .expect('Content-Type', /^application\/json/)
            .expect(200, []);
    });


    it('should return the correct properties', function() {
        waterline.tags.find.resolves([]);
        return helper.request().post('/api/1.1/tags')
        .send(input)
        .expect('Content-Type', /^application\/json/)
        .expect(201)
        .then(function (req) {
            var tag = req.body;
            expect(tag).to.have.property('name').that.equals(input.name);
            expect(tag).to.have.property('rules').that.deep.equals(input.rules);
            expect(taskGraphProtocol.runTaskGraph).to.have.been.calledOnce;
            expect(taskGraphProtocol.runTaskGraph).to.have.been.calledWith('Graph.GenerateTags');
            expect(taskGraphProtocol.runTaskGraph.firstCall.args[1])
                .to.have.deep.property('defaults.nodeId', node.id);
        });
    });

    it('should contain the tag in GET /tags', function () {
        return helper.request().get('/api/1.1/tags')
        .expect('Content-Type', /^application\/json/)
        .expect(200, [input]);
    });

    it('should return a tag from GET /tags/:id', function () {
        return helper.request().get('/api/1.1/tags/tag-name')
        .expect('Content-Type', /^application\/json/)
        .expect(200, input)
        .then(function() {
            expect(waterline.tags.findOne).to.have.been.called;
        });
    });

    it('should destroy a tag', function() {
        return helper.request().delete('/api/1.1/tags/tag-name')
        .expect(204)
        .then(function() {
            expect(waterline.tags.destroy).to.have.been.called;
        });
    });
});

