// Copyright 2016, EMC, Inc.

'use strict';

describe('Http.Api.Internal.Files', function () {
    var uuid;
    var numFilesBefore;
    var badFilename = "RackHD_Rulez";
    var badUuid = "617";

    before('start HTTP server and add file', function () {
        this.timeout(10000);

        return helper.startServer([]).then(function () {
            Promise = helper.injector.get('Promise');
            return helper.request().get('/api/2.0/files');
        }).then(function (res) {
            return Promise.map(res.body, function (file) {
                helper.request().delete('/api/2.0/files/' + file);
            });
        }).then(function () {
            return helper.request().put('/api/2.0/files/mockfile')
                .set('Content-Type', 'application/octet-stream')
                .send('hello')
                .expect(201)
                .expect(function (res) {
                    uuid = res.body.uuid;
                });
        }).then(function () {
            return helper.request().get('/api/2.0/files');
        }).then(function (res) {
            numFilesBefore = res.body.length;
        });
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    describe('GET /files/{fileidentifier}', function () {
        it('should get file by name', function () {
            return helper.request().get('/api/2.0/files/mockfile')
                .expect('Content-Type', /^application\/octet-stream/)
                .expect(200, 'hello');
        });

        it('should get file by uuid', function () {
            return helper.request().get('/api/2.0/files/' + uuid)
                .expect('Content-Type', /^application\/octet-stream/)
                .expect(200, 'hello');
        });

        it('should return 404 on invalid uuid', function () {
            return helper.request().get('/api/2.0/files' + badUuid)
                .expect(404);
        });

        it('should return 404 on invalid filename', function () {
            return helper.request().get('/api/2.0/files' + badFilename)
                .expect(404);
        });
    });

    describe('PUT /files', function () {
        var newUuid;
        var numFilesAfter;
        beforeEach('should PUT new mockfile', function () {
            return helper.request().put('/api/2.0/files/mockfile')
                .set('Content-Type', 'application/octet-stream')
                .send('PUT /files works!')
                .expect(201)
                .expect(function (res) {
                    newUuid = res.body.uuid;
                    expect(newUuid).to.equal(uuid);
                });
        });

        it('should get data from new mockfile', function () {
            return helper.request().get('/api/2.0/files/mockfile')
                .expect(200, 'PUT /files works!');
        });

        it('should see only new mockfile', function () {
            return helper.request().get('/api/2.0/files')
                .expect(200)
                .expect(function (res) {
                    numFilesAfter = res.body.length;
                    expect(numFilesBefore).to.equal(numFilesAfter);
                    expect(res.body).to.have.lengthOf(1);
                });
        });
    });

    describe('GET /files/{filename}/md5', function () {
        it('should get file by filename', function () {
            return helper.request().get('/api/2.0/files/mockfile/md5')
                .expect(200)
                .expect('Content-Type', /^application\/json/)
                .expect(function(res) {
                    expect(res.body).to.be.a('string');
                });
        });

        it('should return 404 if no file found', function () {
            return helper.request().get('/api/2.0/files/' + badFilename + '/md5')
                .expect(404)
                .expect('Content-Type', /^application\/json/);
        });
    });

    describe('GET files/{filename}/metadata', function () {
        it('should get metadata', function () {
            return helper.request().get('/api/2.0/files/mockfile/metadata')
                .expect(200)
                .expect('Content-Type', /^application\/json/)
                .expect(function (res) {
                    expect(res.body.md5).to.be.a('string');
                    expect(res.body).to.be.an('object').and.to.have.property('md5');
                    expect(res.body).to.have.property('uuid');
                    expect(res.body).to.have.property('name');
                    expect(res.body).to.have.property('sha256');
                    expect(res.body.uuid).to.be.a('string');
                });
        });

        it('should get 404 for bad filename', function () {
            return helper.request().get('/api/2.0/files/' + badFilename + '/metadata')
                .expect(404)
                .expect('Content-Type', /^application\/json/);
        });
    });

    describe('GET /files', function () {
        it('should get all files', function () {
            return helper.request().get('/api/2.0/files')
                .expect(function (res) {
                    expect(res.body).to.be.an('array');
                    expect(res.body).to.have.lengthOf(1);
                });
        });
    });

    describe('DELETE /files/{fileidentifier}', function () {
        it('should delete file by uuid', function () {
            return helper.request().delete('/api/2.0/files/' + uuid)
                .expect(204);
        });

        it('should fail to get deleted file', function () {
            return helper.request().get('/api/2.0/files' + uuid)
                .expect(404)
                .expect('Content-Type', /^text\/html/);
        });

        it('should return 404 if file not found', function () {
            return helper.request().delete('/api/2.0/files/' + badUuid)
                .expect(404);
        });
    });
});
    
