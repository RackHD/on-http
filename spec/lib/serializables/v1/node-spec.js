// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Node Serializable V1', function () {
    var Serializable;

    helper.before(function () {
        return helper.requireGlob('/lib/serializables/**/*.js');
    });

    before(function () {
        Serializable = helper.injector.get('Serializables.V1.Node');
    });

    helper.after();

    describe('deserialize', function () {
        beforeEach(function () {
            this.subject = new Serializable();
        });

        it('should assign defaults', function () {
            return this.subject.deserialize({
                name: 'name'
            }).should.eventually.have.deep.property(
                'name'
            ).and.equal('name');
        });

        it('should encrypt obmSettings config password', function () {
            return this.subject.deserialize({
                name: 'fake',
                obmSettings: [
                    {
                        service: 'fake-service',
                        config: {
                            password: 'password'
                        }
                    }
                ]
            }).should.eventually.have.deep.property(
                'obmSettings[0].config.password'
            ).and.not.equal('password');
        });

        it('should encrypt obmSettings config community', function () {
            return this.subject.deserialize({
                name: 'fake',
                obmSettings: [
                    {
                        service: 'fake-service',
                        config: {
                            community: 'community'
                        }
                    }
                ]
            }).should.eventually.have.deep.property(
                'obmSettings[0].config.community'
            ).and.not.equal('community');
        });
    });
});
