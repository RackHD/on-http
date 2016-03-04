// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    jwt = require('jsonwebtoken'),
    crypto = require('crypto'),
    passport = require('passport'),
    JwtStrategy = require('passport-jwt').Strategy,
    LocalStrategy = require('passport-local').Strategy,
    BasicStrategy = require('passport-http').BasicStrategy,
    ExtractJwt = require('passport-jwt').ExtractJwt;

var BAD_REQUEST_STATUS = 400;
var UNAUTHORIZED_STATUS = 401;
var ERROR_STATUS = 500;

module.exports = authServiceFactory;
di.annotate(authServiceFactory, new di.Provide('Auth.Services'));
di.annotate(authServiceFactory,
    new di.Inject(
        'Assert',
        'Services.Configuration',
        '_'
    )
);

function authServiceFactory(
    assert,
    configuration,
    _
) {
    var redfishSessions = [];

    function AuthService() {
    }

    AuthService.prototype.init = function(){
        var self = this;
        this.strategies = [];

        self.algorithm = 'HS256';
        self.secretOrKey = '';
        self.ignoreTokenExpiration = false;
        self.encoder = 'base64';

        self.hashConfig = {
            // number of bytes in the Hash
            hashBytes: 64,
            // number of bytes in the slat
            saltBytes: 64,
            // number of iterations to get the final hash, longer means more secure,
            // but also slower
            iterations: 10000
        };

        self.loadFromConf();

        self.jwtSignOptions = {
            algorithm : self.algorithm,
            secretOrKey : self.secretOrKey,
            expiresIn : self.expiresIn
        };

        self.jwtVerifyOptions = {
            algorithm : self.algorithm,
            secretOrKey : self.secretOrKey,
            ignoreExpiration : self.ignoreTokenExpiration
        };
    };

    AuthService.prototype.getPassportMidware = function () {
        var self = this;
        var passportMidware = passport.initialize();

        passport.use(new LocalStrategy(self.localStrategyAuth.bind(self)));
        passport.use(new JwtStrategy(
            _.merge(self.jwtVerifyOptions, 
                    { jwtFromRequest: ExtractJwt.versionOneCompatibility({ 
                        authScheme: 'JWT', 
                        tokenQueryParameterName: 'auth_token' })
                    }),
            self.jwtStrategyAuth.bind(self)));
        passport.use('redfish', new JwtStrategy(
            _.merge(self.jwtVerifyOptions, 
                    { jwtFromRequest: ExtractJwt.fromHeader('x-auth-token') }),
            self.jwtStrategyRedfish.bind(self)));
        passport.use(new BasicStrategy(self.localStrategyAuth.bind(self)));

        return passportMidware;
    };

    AuthService.prototype.loadFromConf = function (){
        var username = configuration.get('authUsername', 'admin');
        var passwordHash = configuration.get('authPasswordHash',
            'KcBN9YobNV0wdux8h0fKNqi4uoKCgGl/j8c6YGlG7iA0PB3P9ojbmANGhD' +
            'lcSBE0iOTIsYsGbtSsbqP4wvsVcw==');
        var salt = configuration.get('authPasswordSalt',
            'zlxkgxjvcFwm0M8sWaGojh25qNYO8tuNWUMN4xKPH93PidwkCAvaX2JItL' +
            'A3p7BSCWIzkw4GwWuezoMvKf3UXg==');
        var secret = configuration.get('authTokenSecret',
            'RackHDRocks!');

        assert.string(username, 'Invalid username in configure file');
        assert.string(passwordHash, 'Invalid password hash in configure file');
        assert.string(salt, 'Invalid crypto salt in configure file');
        assert.string(secret, 'Invalid token secret in configure file');

        this.userFromConf = username;
        this.hashFromConf = new Buffer(passwordHash, this.encoder);
        this.saltFromConf = new Buffer(salt, this.encoder);
        this.secretOrKey = new Buffer(secret, this.encoder);

        if (this.hashFromConf.length !== this.hashConfig.hashBytes ||
            this.saltFromConf.length !== this.hashConfig.saltBytes){
            throw new Error('Invalid password hash or salt length in configure file');
        }

        this.expiresIn = configuration.get('authTokenExpireIn',
                                            86400); //86400 = 24 * 60 * 60, 24hours
        assert.number(this.expiresIn, 'Invalid token expire value in configure file');

        if (this.expiresIn === 0){
            this.ignoreTokenExpiration = true;
        }
    };

    AuthService.prototype.localStrategyAuth = function (username, password, done) {
        var self =  this;
        self.calcPasswordHash(
            password,
            self.saltFromConf,
            self.hashConfig.iterations,
            self.hashConfig.hashBytes,
            function(err, hashCalculated){
                if(err){
                    return done(err);
                }
                if (!hashCalculated ||
                    username !== self.userFromConf ||
                    hashCalculated.toString(self.encoder) !==
                    self.hashFromConf.toString(self.encoder)) {

                    return done(null, false, {
                        message: 'Invalid username or password'
                    });
                }
                return done(null, username);
            });
    };

    AuthService.prototype.calcPasswordHash = function (password, salt, iteration, bytes, callback) {
        var self = this;

        crypto.pbkdf2(password, salt, self.hashConfig.iterations, self.hashConfig.hashBytes,
            function(err, hash){
                if(err){
                    callback(err);
                }
                callback(null, hash);
            });
    };

    AuthService.prototype.createJwtToken = function (user) {
        var self = this;
        return jwt.sign({
            user: user
        },
        self.secretOrKey,
        self.jwtSignOptions
        );
    };

    AuthService.prototype.jwtStrategyAuth = function(jwtPayload, done) {
        var user = jwtPayload.user;
        if (user === this.userFromConf){
            return done(null, user);
        }
        else{
            return done(null, false);
        }
    };

    AuthService.prototype.jwtStrategyRedfish = function(jwtPayload, done) {
        var found = _.find(redfishSessions, function(entry) {
            return (entry.user === jwtPayload.user) && 
                   (entry.id === jwtPayload.id);
        });
        if( found ) {
            return done(null, found.user);
        } else {
            return done(null, false);
        }
    };

    AuthService.prototype.authMiddlewareJwt = function(req, res, next) {
        passport.authenticate(      // middleware for token authentication
            'jwt',
            {session: false},
            function errorHandler(err, user, challenges){
                if(err){
                    res.status(ERROR_STATUS).send({message: 'Internal server error'});
                }
                else if (!user){
                    res.status(UNAUTHORIZED_STATUS).send({message: challenges.message});
                }
                else{   // nothing wrong, move on to next middleware
                    // remove the authToken query string if there are any.
                    delete req.query.auth_token; /* jshint ignore: line */
                    next();
                }
            }
        )(req, res, next);
    };

    AuthService.prototype.authMiddlewareLogin = function(req, res, next) {
        var self = this;

        passport.authenticate('local', {
                session: false
            },
            function errorHandler(err, user, challenges){ // Callback to handle auth error
                if(err){
                    res.status(ERROR_STATUS).send({message: 'Internal server error'});
                }
                else if (!user){
                    if(challenges.message === 'Missing credentials'){
                        res.status(BAD_REQUEST_STATUS).send(challenges);
                    }
                    else if(challenges.message === 'Invalid username or password') {
                        res.status(UNAUTHORIZED_STATUS).send(challenges);
                    }
                    else {
                        res.status(UNAUTHORIZED_STATUS).send(challenges);
                    }
                }
                else {
                    var username = self.userFromConf;
                    var token = {
                        'token': self.createJwtToken(username)
                    };

                    res.send(token);
                }
            }
        )(req, res, next);
    };

    AuthService.prototype.authMiddlewareRedfish = function(req, res, next) {
        passport.authenticate(
            ['basic', 'redfish'],
            {session: false},
            function(err, user, challenges) {
                if(err){
                    res.status(ERROR_STATUS).send({message: 'Internal server error'});
                }
                else if (!user){
                    res.status(UNAUTHORIZED_STATUS).send({message: challenges.message});
                }
                else {
                    next();
                }
            }
        )(req, res, next);
    };

    AuthService.prototype.addRedfishSession = function(user, id) {
        var self = this;
        redfishSessions.push( {user: user, id: id} );
        return jwt.sign( {user: user, id: id}, self.secretOrKey, self.jwtSignOptions );
    };

    AuthService.prototype.getRedfishSession = function(id) {
        if(!id) {
            return redfishSessions;
        }
        return _.find(redfishSessions, function(entry) {
            return entry.id === id;
        });
    };

    AuthService.prototype.delRedfishSession = function(id) {
        _.remove(redfishSessions, function(entry) {
            return entry.id === id;
        });
    };

    return new AuthService();
}
