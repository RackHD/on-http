'use strict';

module.exports = {mockPost: function mockPost (req, res, next) {
    res.data = req.data;
    return next(req, res);
}};
