// Copyright 2016, EMC, Inc.

'use strict';

describe('Ssh Serializable V1', function () {
    var encryption;
    var Serializable;

    helper.before(function () {
        return helper.requireGlob('/lib/serializables/**/*.js');
    });

    before(function () {
        encryption = helper.injector.get('Services.Encryption');
        Serializable = helper.injector.get('Serializables.V1.Ssh');
    });

    helper.after();

    describe('serialize', function () {
        beforeEach(function () {
            this.subject = new Serializable();
        });

        it('should redact encrypted password fields', function() {
            return this.subject.serialize(
                {
                    host: 'fake-host',
                    user: 'fake-user',
                    password: encryption.encrypt('fake-password')
                }
            ).should.eventually.have.property('password').that.equals('REDACTED');
        });

        it('should redact encrypted privateKey fields', function() {
            return this.subject.serialize(
                {
                    host: 'fake-host',
                    user: 'fake-user',
                    publicKey: 'fake-public-key',
                    privateKey: encryption.encrypt('fake-private-key'),
                }
            ).should.eventually.have.property('privateKey').that.equals('REDACTED');
        });
    });

    describe('deserialize', function () {
        beforeEach(function () {
            this.subject = new Serializable();
        });

        it('should conform to a host/user/password schema', function() {
            return this.subject.deserialize(
                {
                    host: 'fake-host',
                    user: 'fake-user',
                    password: 'fake-password'
                }
            ).should.be.fulfilled;
        });

        it('should conform to a host/user/publicKey/privateKey schema', function() {
            return this.subject.deserialize(
                {
                    host: 'fake-host',
                    user: 'fake-user',
                    publicKey: 'fake-public-key',
                    privateKey: 'fake-private-key'
                }
            ).should.be.fulfilled;
        });

        it('should optionally support both schemas', function() {
            return this.subject.deserialize(
                {
                    host: 'fake-host',
                    user: 'fake-user',
                    password: 'fake-password',
                    publicKey: 'fake-public-key',
                    privateKey: 'fake-private-key'
                }
            ).should.be.fulfilled;
        });

        it('should fail on a bad host/user/password key schema', function() {
            return this.subject.deserialize(
                {
                    host: 'fake-host',
                    user: 'fake-user',
                    publicKey: 'fake-public-key'
                }
            ).should.be.rejectedWith(/SchemaError/);
        });

        it('should fail on a bad host/user/public/private key schema', function() {
            return this.subject.deserialize(
                {
                    host: 'fake-host',
                    user: 'fake-user',
                    publicKey: 'fake-public-key'
                }
            ).should.be.rejectedWith(/SchemaError/);
        });

        it('should encrypt password fields', function() {
            return this.subject.deserialize(
                {
                    host: 'fake-host',
                    user: 'fake-user',
                    password: 'fake-password'
                }
            ).should.eventually.have.property(
                'password'
            ).and.not.equal('fake-password');
        });

        it('should encrypt privateKey fields', function() {
            return this.subject.deserialize(
                {
                    host: 'fake-host',
                    user: 'fake-user',
                    publicKey: 'fake-public-key',
                    privateKey: 'fake-private-key'
                }
            ).should.eventually.have.property(
                'privateKey'
            ).and.not.equal('fake-private-key');
        });
    });
});
