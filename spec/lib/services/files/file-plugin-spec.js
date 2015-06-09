// Copyright 2015, EMC Corporation

"use strict";

var EventEmitter = require('events').EventEmitter;

describe("fileService disk backend", function() {
    var BackendFS,
        backend,
        config,
        fakeFile,
        fs,
        waterline,
        execker,
        Q;

    beforeEach(function(){
        helper.setupInjector(
            _.flatten([
                helper.require('/lib/services/files/file-plugin')
            ])
        );

        config = {
            root: ''
        };

        fakeFile = {
            filename: 'fauxFile_uuidGoesHere.txt',
            basename: 'fauxFile.txt',
            uuid: 'IamUniversallyUnique',
            md5: 'I am a hash',
            sha: 'I am another hash'
        };

        Q = helper.injector.get('Q');
        BackendFS = helper.injector.get('Files.FS');
        backend = new BackendFS(config);
    });

    it("should expose a get method", function(){
        backend.should.have.property('get')
        .that.is.a('function').with.length(1);
    });

    it("should expose a put method", function() {
        backend.should.have.property('put')
        .that.is.a('function').with.length(1);
    });

    it("should expose a getMeta method", function() {
        backend.should.have.property('getMeta')
        .that.is.a('function').with.length(1);
    });

    it("should expose a delete method", function() {
        backend.should.have.property('delete')
        .that.is.a('function').with.length(1);
    });

    it("should expose a list method", function() {
        backend.should.have.property('list')
        .that.is.a('function').with.length(1);
    });


    beforeEach(function() {

        waterline = helper.injector.get('Services.Waterline');
        waterline.files = {};
        waterline.files.create = sinon.stub();
        waterline.files.destroy = sinon.stub();
        waterline.files.find = sinon.stub();
        waterline.files.findOne = sinon.stub();

        fs = helper.injector.get('fs');
        fs.unlink = sinon.stub();
        fs.exists = sinon.stub();
        fs.createReadStream = sinon.stub();
        fs.createWriteStream = sinon.stub();

        execker = {};

        helper.setupInjector(
            _.flatten([
                helper.require('/lib/services/files/file-plugin')
            ])
        );
    });

    it("should resolve a promise on successful get", function() {
        execker.exec = sinon.stub();
        execker.exec.callsArgWith(0, null, fakeFile);

        waterline.files.findOne.returns(execker);
        fs.exists.callsArgWith(1, true);
        fs.createReadStream.returnsArg(0);

        var rdStreamPromise = backend.get('a uuid');

        return rdStreamPromise.should.eventually.equal(fakeFile.filename);
    });

    it("should fail on get if the file is not found", function() {
        execker.exec = sinon.stub();
        execker.exec.callsArgWith(0, null, fakeFile);

        waterline.files.findOne.returns(execker);
        fs.exists.callsArgWith(1, false);
        fs.createReadStream.returnsArg(0);

        var rdStreamPromise = backend.get('a uuid');

        return rdStreamPromise.should.be.rejectedWith('File not found');
    });

    it("should resolve a promise for a writestream on successful put", function() {
        var fakeStream = new EventEmitter();

        fs.createWriteStream.returns(fakeStream);

        var streamObjPromise = backend.put('file.txt');

        fakeStream.emit('metadata', {md5: 'an md5', sha256: 'a sha'});

        return streamObjPromise.should.eventually.have.property('stream')
        .that.deep.equals(fakeStream);
    });

    it("should fail and clean up if waterline validation fails for put", function(){
        var fakeStream = new EventEmitter(),
            deferred = Q.defer();

        fs.createWriteStream.returns(fakeStream);
        fakeStream.on('error', function(){
            deferred.resolve();
        });
        waterline.files.create.returns(Q.reject());

        backend.put('aFilename.txt');
        fakeStream.emit('metadata', {md5: 'an md5', sha256: 'a sha256'});

        return deferred.promise.then(function() {
            fs.unlink.callCount.should.equal(1);
        }).should.be.fulfilled;


    });

    it("should return a list of available files", function() {
        var files = [fakeFile, fakeFile];

        execker.exec = sinon.stub();
        execker.exec.callsArgWith(0, null, files);
        waterline.files.find.returns(execker);
        fakeFile.toJSON = sinon.stub();
        fakeFile.toJSON.returns(fakeFile);

        var arrayPromise = backend.list({});

        return arrayPromise.should.eventually.deep.equal(files);
    });

    it("should delete both waterline records and filesystem files", function(){
        execker.exec = sinon.stub();
        execker.exec.callsArgWith(0, null, fakeFile);
        waterline.files.findOne.returns(execker);
        fs.exists.callsArgWith(1, true);
        fs.unlink.callsArgWith(1, null);
        waterline.files.destroy.returns('destroyed file');

        var deletionPromise = backend.delete('a uuid');

        return deletionPromise.then(function(){
            fs.unlink.callCount.should.equal(1);
            waterline.files.destroy.callCount.should.equal(1);
        }).should.be.fulfilled;
    });

    it("should fail on delete if the file is not found", function() {
        execker.exec = sinon.stub();
        execker.exec.callsArgWith(0, null, fakeFile);
        waterline.files.findOne.returns(execker);
        fs.exists.callsArgWith(1, false);

        var deletionPromise = backend.delete('a uuid');

        return deletionPromise.should.eventually
        .be.rejectedWith('File not found');
    });

});
