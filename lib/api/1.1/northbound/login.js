// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    passport = require('passport');

module.exports = loginRouterFactory;

di.annotate(loginRouterFactory, new di.Provide('Http.Api.Login'));
di.annotate(loginRouterFactory, new di.Inject(
        'Http.Services.RestApi',
        'Auth.Services',
        'Errors'
    )
);

function loginRouterFactory (
    rest,
    authService,
    Errors
) {
    var BAD_REQUEST_STATUS = 400;
    var UNAUTHORIZED_STATUS = 401;
    var ERROR_STATUS = 500;

    var router = express.Router();

    /**
     * @api {post} /api/1.1/login/ POST /
     * @apiVersion 1.1.0
     * @apiDescription get a token before accessing other apis
     * @apiName login-post
     * @apiGroup login
     * @apiSuccess {json} a token to be used when accessing other apis:
     *      {
     *       "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiY
     *       WRtaW4iLCJpYXQiOjE0NTI0ODA3MTIsImV4cCI6MTQ1MjU2NzExMn0.Qo-9y
     *       omlkd0WE1jlEA-L1WqA6k_9qJYhkicQL5IUmSg"
     *      }
     */

    router.post('/login',
        function(req, res, next) {          //Middleware to do authentication.
            passport.authenticate('local', {
                    session: false
                },
                function(err, user, challenges, status){ // Callback to handle auth error
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
                        var username = authService.userFromConf;
                        var token = {
                            'token': authService.createJwtToken(username)
                        };

                        res.send(token);
                    }
                }
            )(req, res, next);
        });

    return router;
}
