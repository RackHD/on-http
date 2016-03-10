// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    jwt = require('jsonwebtoken'),
    passport = require('passport'),
    JwtStrategy = require('passport-jwt').Strategy,
    LocalStrategy = require('passport-local').Strategy,
    BasicStrategy = require('passport-http').BasicStrategy,
    ExtractJwt = require('passport-jwt').ExtractJwt,
    AnonStrategy = require('passport-anonymous').Strategy;

var BAD_REQUEST_STATUS = 400;
var UNAUTHORIZED_STATUS = 401;
var ERROR_STATUS = 500;

module.exports = authServiceFactory;
di.annotate(authServiceFactory, new di.Provide('Auth.Services'));
di.annotate(authServiceFactory,
    new di.Inject(
        'Assert',
        'Services.Configuration',
        '_',
        'Services.Waterline'
    )
);

function authServiceFactory(
    assert,
    configuration,
    _,
    waterline
) {
    var redfishSessions = [];

    function AuthService() {
    }

    AuthService.prototype.init = function(){
        var self = this;

        self.algorithm = 'HS256';
        self.secretOrKey = '';
        self.ignoreTokenExpiration = false;
        self.encoder = 'base64';

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

        // We do not use passport.session middleware and run our strategies
        // with session: false, but this is a required function for req.logIn 
        // to succeed.  The 'user' value below is the value passed to req.logIn
        // and it is returned to indicate success.
        passport.serializeUser(function(user, done) {
            done(null, user); 
        });
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
        passport.use(new AnonStrategy());

        return passportMidware;
    };

    AuthService.prototype.loadFromConf = function () {
        var secret = configuration.get('authTokenSecret', 'RackHDRocks!');
        assert.string(secret, 'Invalid token secret in configure file');
        this.secretOrKey = new Buffer(secret, this.encoder);

        this.expiresIn = configuration.get('authTokenExpireIn', 24 * 60 * 60 /* 24 hours */);
        assert.number(this.expiresIn, 'Invalid token expire value in configure file');

        if (this.expiresIn === 0){
            this.ignoreTokenExpiration = true;
        }
    };

    AuthService.prototype.localStrategyAuth = function (username, password, done) {
        waterline.localusers.findOne({username: username}).then(function(user) {
            if(user && user.comparePassword(password)) {
                return done(null, username);
            }
            return done(null, false, {message: 'Unauthorized'});
        }).catch(function(err) {
            return done(err);
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
        waterline.localusers.findOne({username: jwtPayload.user}).then(function(user) {
            if(user) {
                return done(null, user.username);
            }
            return done(null, false, {message: 'Unauthorized'});
        }).catch(function(err) {
            return done(err);
        });
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
                    var token = {
                        'token': self.createJwtToken(user)
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

    AuthService.prototype.authenticateWithMethod = function(req, res, next, method) {
        passport.authenticate(method, {session: false}, function(err, user, challenges) {
                if(err){
                    res.status(ERROR_STATUS).send({message: 'Internal server error'});
                }
                else if (!user){
                    res.status(UNAUTHORIZED_STATUS).send({message: challenges.message});
                }
                else {
                    req.login(user, function(err) {
                        if(err) {
                            return next(err);
                        }
                        next();
                    });
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
