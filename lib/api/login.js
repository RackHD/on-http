// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express');

module.exports = loginRouterFactory;

di.annotate(loginRouterFactory, new di.Provide('Http.Api.Login'));
di.annotate(loginRouterFactory, new di.Inject(
        'Auth.Services'
    )
);

function loginRouterFactory (
    authService
) {


    var router = express.Router();

    /**
     * @api {post} /login/ POST /
     * @apiVersion 1.1.0
     * @apiDescription get a token before accessing other apis
     * @apiName login-post
     * @apiGroup login
     * @apiParam {String} username username used to login
     * @apiParam {String} password password used to login
     * @apiSuccess {json} a token to be used when accessing other apis:
     *      {
     *       "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiY
     *       WRtaW4iLCJpYXQiOjE0NTI0ODA3MTIsImV4cCI6MTQ1MjU2NzExMn0.Qo-9y
     *       omlkd0WE1jlEA-L1WqA6k_9qJYhkicQL5IUmSg"
     *      }
     */

    router.post('/login', authService.authMiddlewareLogin.bind(authService));

    return router;
}
