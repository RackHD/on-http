// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

var stream = require('stream');

describe('Http.Api.Files', function() {
    var fileService,
        mockRdStream;

    before('start HTTP server', function() {
        this.timeout(5000);
        return helper.startServer().then(function() {
            fileService = helper.injector.get('fileService');
        });
    });

    after('stop HTTP server', function() {
        return helper.stopServer();
    });

    describe('GET /files/:uuid', function() {
        before('create mock file stream', function() {
            mockRdStream = new stream.Readable();
            mockRdStream._read = function() {
                this.push('this is mock file 1234');
                this.push(null);
            };
        });

        beforeEach('set up mocks', function() {
            sinon.stub(fileService, 'get');
        });

        afterEach('tear down mocks', function() {
            fileService.get.restore();
        });

        it('should return file by uuid', function() {
            fileService.get.withArgs('1234')
                .returns(Promise.resolve(mockRdStream));

            return helper.request()
                .get('/api/1.1/files/1234')
                .expect(200)
                .expect('this is mock file 1234')
                .expect(function() {
                    expect(fileService.get).to.have.been.calledOnce;
                });
        });

        it('should return File not found', function() {
            fileService.get.withArgs('5678')
                .returns(Promise.reject({ name: '404' }));

            return helper.request()
                .get('/api/1.1/files/5678')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .expect({ error: 'File not found.' })
                .expect(function() {
                    expect(fileService.get).to.have.been.calledOnce;
                });
        });

        it('should return Failed to serve file request', function() {
            fileService.get.withArgs('abcd')
                .returns(Promise.reject({}));

            return helper.request()
                .get('/api/1.1/files/abcd')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect({ error: 'Failed to serve file request.' })
                .expect(function() {
                    expect(fileService.get).to.have.been.calledOnce;
                });
        });
    });

    describe('GET /files/:filename/latest', function() {
        before('create mock file stream', function() {
            mockRdStream = new stream.Readable();
            mockRdStream._read = function() {
                this.push('this is mock file, filename:mockfile1');
                this.push(null);
            };
        });

        beforeEach('set up mocks', function() {
            sinon.stub(fileService, 'get');
            sinon.stub(fileService, 'verify');
        });

        afterEach('tear down mocks', function() {
            fileService.get.restore();
            fileService.verify.restore();
        });

        it('should return latest file by filename', function() {
            fileService.verify.withArgs('mockfile1')
                .returns(Promise.resolve(
                    [
                        { uuid: 'abcd' },
                        { uuid: '5678' },
                        { uuid: '1234' }
                    ]
                ));

            fileService.get.withArgs('1234')
                .returns(Promise.resolve(mockRdStream));

            return helper.request()
                .get('/api/1.1/files/mockfile1/latest')
                .expect(200)
                .expect('this is mock file, filename:mockfile1')
                .expect(function() {
                    expect(fileService.verify).to.have.been.calledOnce;
                    expect(fileService.get).to.have.been.calledOnce;
                });
        });

        it('should return File not found', function() {
            fileService.verify.withArgs('mockfile2')
                .returns(Promise.reject({ name: '404' }));

            return helper.request()
                .get('/api/1.1/files/mockfile2/latest')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .expect({ error: 'File not found.' })
                .expect(function() {
                    expect(fileService.verify).to.have.been.calledOnce;
                    expect(fileService.get).to.not.have.been.called;
                });
        });

        it('should return File not found 2', function() {
            fileService.verify.withArgs('mockfile3')
                .returns(Promise.resolve([{ uuid: '1234' }]));

            fileService.get.returns(Promise.reject({ name: '404' }));

            return helper.request()
                .get('/api/1.1/files/mockfile3/latest')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .expect({ error: 'File not found.' })
                .expect(function() {
                    expect(fileService.verify).to.have.been.calledOnce;
                    expect(fileService.get).to.have.been.calledOnce;
                });
        });

        it('should return Failed to serve file request', function() {
            fileService.verify.withArgs('mockfile4')
                .returns(Promise.resolve([{ uuid: '1234' }]));

            fileService.get.returns(Promise.reject({}));

            return helper.request()
                .get('/api/1.1/files/mockfile4/latest')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect({ error: 'Failed to serve file request.' })
                .expect(function() {
                    expect(fileService.get).to.have.been.calledOnce;
                    expect(fileService.get).to.have.been.calledOnce;
                });
        });
    });

    describe('DELETE /files/:uuid', function() {
        beforeEach('set up mocks', function() {
            sinon.stub(fileService, 'delete');
        });

        afterEach('tear down mocks', function() {
            fileService.delete.restore();
        });

        it('should delete file by uuid', function() {
            fileService.delete.withArgs('1234')
                .returns(Promise.resolve());

            return helper.request()
                .delete('/api/1.1/files/1234')
                .expect(204)
                .expect(function() {
                    expect(fileService.delete).to.have.been.calledOnce;
                });
        });

        it('should return File not found', function() {
            fileService.delete.withArgs('5678')
                .returns(Promise.reject({ name: '404' }));

            return helper.request()
                .delete('/api/1.1/files/5678')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .expect({ error: 'File not found.' })
                .expect(function() {
                    expect(fileService.delete).to.have.been.calledOnce;
                });
        });

        it('should return Error deleting file from the database', function() {
            fileService.delete.withArgs('abcd')
                .returns(Promise.reject({}));

            return helper.request()
                .delete('/api/1.1/files/abcd')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect({ error: 'Error deleting file from the database.' })
                .expect(function() {
                    expect(fileService.delete).to.have.been.calledOnce;
                });
        });
    });

    describe('GET /files/metadata/:filename', function() {
        beforeEach('set up mocks', function() {
            sinon.stub(fileService, 'verify');
        });

        afterEach('tear down mocks', function() {
            fileService.verify.restore();
        });

        it('should return metadata by filename', function() {
            fileService.verify.withArgs('mockfile1')
                .returns(Promise.resolve([{ uuid: '123456' }]));

            return helper.request()
                .get('/api/1.1/files/metadata/mockfile1')
                .expect(200)
                .expect([{ uuid: '123456'}])
                .expect(function() {
                    expect(fileService.verify).to.have.been.calledOnce;
                });
        });

        it('should return File not found', function() {
            fileService.verify.withArgs('mockfile2')
                .returns(Promise.reject({ name: '404' }));

            return helper.request()
                .get('/api/1.1/files/metadata/mockfile2')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .expect({ error: 'File not found.' })
                .expect(function() {
                    expect(fileService.verify).to.have.been.calledOnce;
                });
        });

        it('should return Error retrieving metadata', function() {
            fileService.verify.withArgs('mockfile3')
                .returns(Promise.reject({}));

            return helper.request()
                .get('/api/1.1/files/metadata/mockfile3')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect({ error: 'Error retrieving metadata.' })
                .expect(function() {
                    expect(fileService.verify).to.have.been.calledOnce;
                });
        });
    });

    describe('GET /files/md5/:filename/latest', function() {
        beforeEach('set up mocks', function() {
            sinon.stub(fileService, 'verify');
        });

        afterEach('tear down mocks', function() {
            fileService.verify.restore();
        });

        it('should return md5 by filename', function() {
            fileService.verify.withArgs('mockfile1')
                .returns(Promise.resolve([{ md5: 'xxxx-yyyy' }]));

            return helper.request()
                .get('/api/1.1/files/md5/mockfile1/latest')
                .expect(200)
                .expect('"xxxx-yyyy"')
                .expect(function() {
                    expect(fileService.verify).to.have.been.calledOnce;
                });
        });

        it('should return File not found', function() {
            fileService.verify.withArgs('mockfile2')
                .returns(Promise.reject({ name: '404' }));

            return helper.request()
                .get('/api/1.1/files/md5/mockfile2/latest/')
                .expect('Content-Type', /^application\/json/)
                .expect(404)
                .expect({ error: 'File not found.' })
                .expect(function() {
                    expect(fileService.verify).to.have.been.calledOnce;
                });
        });

        it('should return Error retrieving metadata', function() {
            fileService.verify.withArgs('mockfile3')
                .returns(Promise.reject({}));

            return helper.request()
                .get('/api/1.1/files/md5/mockfile3/latest')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect({ error: 'Error retrieving metadata.' })
                .expect(function() {
                    expect(fileService.verify).to.have.been.calledOnce;
                });
        });
    });

    describe('GET /files/list/all', function() {
        beforeEach('set up mocks', function() {
            sinon.stub(fileService, 'list');
        });

        afterEach('tear down mocks', function() {
            fileService.list.restore();
        });

        it('should return file list by query', function() {
            fileService.list.withArgs({ name: 'file1'})
                .returns(Promise.resolve([{ name: 'file1', data: 'test data' }]));

            return helper.request()
                .get('/api/1.1/files/list/all')
                .send({ name: 'file1'})
                .expect(200)
                .expect([{ name: 'file1', data: 'test data'}])
                .expect(function() {
                    expect(fileService.list).to.have.been.calledOnce;
                });
        });

        it('should return Error retrieving file list', function() {
            fileService.list.returns(Promise.reject({}));

            return helper.request()
                .get('/api/1.1/files/list/all')
                .expect('Content-Type', /^application\/json/)
                .expect(500)
                .expect({ error: 'Error retrieving file list.' })
                .expect(function() {
                    expect(fileService.list).to.have.been.calledOnce;
                });
        });
    });
});
