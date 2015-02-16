"use strict";

require('../../helper.js');

var EventEmitter = require('events').EventEmitter;


describe("fileService disk backend", function() {
    var BackendFS,
        backend,
        config,
        fakeFile,
        q;

    beforeEach(function(){
        helper.setupInjector(
            _.flatten([
                helper.require('/lib/services/files/file-plugin')
            ])
        );


        config = {
            root: '.'
        };

        fakeFile = {
            filename: 'fauxFile_uuidGoesHere.txt',
            basename: 'fauxFile.txt',
            uuid: 'IamUniversallyUnique',
            md5: 'I am a hash',
            sha: 'I am another hash'
        };

        q = helper.injector.get('Q');
        BackendFS = helper.injector.get('Files.FS');
        backend = new BackendFS(config);
    });

    it("should expose get/put/list/delete methods", function(){

        backend.should.have.property('get')
        .that.is.a('function').with.length(1);

        backend.should.have.property('put')
        .that.is.a('function').with.length(1);

        backend.should.have.property('getMeta')
        .that.is.a('function').with.length(1);

        backend.should.have.property('delete')
        .that.is.a('function').with.length(1);

        backend.should.have.property('list')
        .that.is.a('function').with.length(1);

    });

    describe('get', function() {
        var readStreamStub,
            findStub,
            existsStub;

        beforeEach(function() {
            readStreamStub = sinon.stub(backend, 'createReadStream'),
            findStub = sinon.stub(backend, 'findOneEntry'),
            existsStub = sinon.stub(backend, 'exists');
        });

        it("should resolve a promise on successful get", function() {

            findStub.returns(q.resolve(fakeFile));
            existsStub.returns(q.resolve(fakeFile));
            readStreamStub.returns('this would be a stream');

            var rdStreamPromise = backend.get('a uuid');

            return rdStreamPromise.should.eventually.equal('this would be a stream');
        });

        it("should fail on get if the file is not found", function() {

            findStub.returns(q.reject('file not found'));

            var rdStreamPromise = backend.get('a uuid');

            return rdStreamPromise.should.be.rejectedWith('file not found');
        });
    });

    it("should resolve a promise for a writestream on put", function() {
        var writeStreamStub = sinon.stub(backend, 'createWriteStream'),
            fakeStream = new EventEmitter();

        sinon.stub(backend, 'createEntry');
        writeStreamStub.returns(fakeStream);

        var streamObjPromise = backend.put('file.txt');

        fakeStream.emit('metadata', {md5: 'an md5', sha256: 'a sha'});

        return streamObjPromise.should.eventually.have.property('stream')
        .that.deep.equals(fakeStream);
    });


    it("should return a list of available files", function() {
        var findStub = sinon.stub(backend, 'findEntries');
        fakeFile.toJSON = sinon.stub();

        fakeFile.toJSON.returns(fakeFile);
        findStub.returns(q.resolve([fakeFile]));

        var arrayPromise = backend.list({});

        return arrayPromise.should.eventually.deep.equal([fakeFile]);
    });

    it("should fail on delete if the file is not found", function() {
        var findStub = sinon.stub(backend, 'findOneEntry');

        sinon.stub(backend, 'unlink');
        sinon.stub(backend, 'destroyEntry');



        findStub.returns(q.reject('file not found'));

        var deletionPromise = backend.delete('a uuid');

        return deletionPromise.should.eventually
        .be.rejectedWith('file not found');
    });

});
