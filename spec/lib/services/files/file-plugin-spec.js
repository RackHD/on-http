// Copyright 2015, EMC, Inc.

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
        Promise;

    beforeEach(function(){
        helper.setupInjector(
            _.flattenDeep([
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

        Promise = helper.injector.get('Promise');
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
        sinon.stub(fs, 'unlink');
        sinon.stub(fs, 'exists');
        sinon.stub(fs, 'rename');
        sinon.stub(fs, 'createReadStream');
        sinon.stub(fs, 'createWriteStream');

        execker = {};

        helper.setupInjector(
            _.flattenDeep([
                helper.require('/lib/services/files/file-plugin')
            ])
        );
    });

    afterEach(function() {
        fs = helper.injector.get('fs');
        fs.unlink.restore();
        fs.exists.restore();
        fs.rename.restore();
        fs.createReadStream.restore();
        fs.createWriteStream.restore();
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

        execker.exec = sinon.stub();
        execker.exec.callsArgWith(0, null, null);

        waterline.files.findOne.returns(execker);
        waterline.files.create.returns(Promise.resolve(fakeFile));
        fs.createWriteStream.returns(fakeStream);

        var streamObjPromise = backend.put('file.txt');

        fakeStream.emit('metadata', {md5: 'an md5', sha256: 'a sha'});

        return streamObjPromise.should.eventually.have.property('stream')
        .that.deep.equals(fakeStream);
    });

    it("should fail and clean up if waterline validation fails for put", function(){
        var fakeStream = new EventEmitter();

        return new Promise(function (resolve) {
            fs.createWriteStream.returns(fakeStream);
            fakeStream.on('error', function(){
                resolve();
            });
            execker.exec = sinon.stub();
            execker.exec.callsArgWith(0, null, null);
            waterline.files.findOne.returns(execker);
            waterline.files.create.returns(Promise.reject());

            backend.put('aFilename.txt');
            fakeStream.emit('metadata', {md5: 'an md5', sha256: 'a sha256'});
        }).then(function() {
            fs.unlink.callCount.should.equal(1);
        });
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

    it("should fail on delete if the file is not found on disk", function() {
        execker.exec = sinon.stub();
        execker.exec.callsArgWith(0, null, fakeFile);
        waterline.files.findOne.returns(execker);
        fs.exists.callsArgWith(1, false);

        return backend.delete('a uuid')
        .catch(function(err) {
            err.message.should.equal("File not found on disk");
        });
    });

    it("should fail on delete if the file is not found in the database", function() {
        execker.exec = sinon.stub();
        execker.exec.callsArgWith(0, null, null);
        waterline.files.findOne.returns(execker);
        fs.exists.callsArgWith(1, true);

        return backend.delete('a uuid')
        .catch(function(err) {
            err.message.should.equal("File not found in database");
        });
    });
});
