"use strict";
Object.defineProperties(exports, {
  isUpperCase: {get: function() {
      return isUpperCase;
    }},
  isClass: {get: function() {
      return isClass;
    }},
  isFunction: {get: function() {
      return isFunction;
    }},
  isObject: {get: function() {
      return isObject;
    }},
  toString: {get: function() {
      return toString;
    }},
  __esModule: {value: true}
});
function isUpperCase(char) {
  return char.toUpperCase() === char;
}
function isClass(clsOrFunction) {
  if (clsOrFunction.name) {
    return isUpperCase(clsOrFunction.name.charAt(0));
  }
  return Object.keys(clsOrFunction.prototype).length > 0;
}
function isFunction(value) {
  return typeof value === 'function';
}
function isObject(value) {
  return typeof value === 'object';
}
function toString(token) {
  if (typeof token === 'string') {
    return token;
  }
  if (token === undefined || token === null) {
    return '' + token;
  }
  if (token.name) {
    return token.name;
  }
  return token.toString();
}
;
