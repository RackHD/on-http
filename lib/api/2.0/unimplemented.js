'use strict';

module.exports = {
  unimplemented: unimplemented
};

function unimplemented(req, res) {
  res.sendStatus(501);
}

