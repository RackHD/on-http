// Copyright 2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('SockJS.Server', function () {
    helper.before(function() {
        return _.flatten([
            helper.require('/lib/services/sockjs-service.js'),
            helper.require('/lib/services/stomp-service.js'),
            dihelper.simpleWrapper(require('renasar-mq'), 'MQ')
        ]);
    });

    helper.after();

    it('should attach stomp to an http server', function () {
        var server = helper.injector.get('SockJS.Server');
        server.listen(require('http').createServer());
    });

    it('should attach stomp to an https server', function () {
        var server = helper.injector.get('SockJS.Server');
        server.listen(require('https').createServer({

            // dummy key + cert
            key: [
                '-----BEGIN RSA PRIVATE KEY-----',
                'MIICXAIBAAKBgQClQ+J0lDAgr+yWWo2miXB8eL7kLSh5zPntNpXWmmmC2FjeYz7v',
                '+1yzk3SxDuRVhSQagdQVYf7/smnc+CSnaZBbPHRf1uaHoyH7baDhE0kVAOZvR/Ce',
                'guSBauehHfSPKXUjp/ETNa91PdNEb8fF1n6/LMUL2pn7zEKgCXLXHmvepwIDAQAB',
                'AoGARlNM2i71C/PQyWpfPK7fnxgCozZUMwB2merQeDHdFEDcEEZLUfO0zvXAglfD',
                '8mBlrKHyjebVjBlv0wgFEPhq5LkUg2XsBQJyj3DWVU+Q8hrf3PCZIQqO7LYak+i9',
                'mo5XuvtDLLW4Pax57xj7vDh4nxgZyyQjFBP3SWYees04z4ECQQDPrvboYfIdWoZS',
                'Yomdt1KhB4rDuzYWJDXuvJGOEmANHP5xQcc5mJYx1FxWnVzhtgfULcThypnfw4fV',
                'lqCGgXHrAkEAy7abp2/GTG3Y8vJ/pfrnt/n+EXHnlUnZK+iVChFyanW6aMkSxPdo',
                'xUemRbc2r9snHCT66RxqYLc5a3PswXKbNQJAIj2RfaywU0CahriyQat41w28Rhr2',
                'ht3/elXilY7YATF3jcqvgwJyONLvSmR1bM0rK0NEg4l4pxjAq2lDHAn5cwJBAJP5',
                'WEWevqdD36RSHAEAKZONJ02atMLPes4XSzOeCsNkMvzsmhKzOMqcyh24ASRqh5U9',
                'E3mDJ46LaU0xTtgSHMUCQF8fu69J3XzAC9XuJPfmJMTpatO1cvfV86en7GWTN6ns',
                'j2zdnpxHUlp3WDPLlxOETrrkqsrv5bmmk8EB6a54xrQ=',
                '-----END RSA PRIVATE KEY-----'
            ].join('\n'),
            cert: [
                '-----BEGIN CERTIFICATE-----',
                'MIICsjCCAhugAwIBAgIJAIl9pLsmOe3RMA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNV',
                'BAYTAkFVMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBX',
                'aWRnaXRzIFB0eSBMdGQwIBcNMTUwMTE1MjM0MDI4WhgPMzAxNDA1MTgyMzQwMjha',
                'MEUxCzAJBgNVBAYTAkFVMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJ',
                'bnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJ',
                'AoGBAKVD4nSUMCCv7JZajaaJcHx4vuQtKHnM+e02ldaaaYLYWN5jPu/7XLOTdLEO',
                '5FWFJBqB1BVh/v+yadz4JKdpkFs8dF/W5oejIfttoOETSRUA5m9H8J6C5IFq56Ed',
                '9I8pdSOn8RM1r3U900Rvx8XWfr8sxQvamfvMQqAJctcea96nAgMBAAGjgacwgaQw',
                'HQYDVR0OBBYEFAAlOtAP7he0rdTtHWCMY93HGPlqMHUGA1UdIwRuMGyAFAAlOtAP',
                '7he0rdTtHWCMY93HGPlqoUmkRzBFMQswCQYDVQQGEwJBVTETMBEGA1UECBMKU29t',
                'ZS1TdGF0ZTEhMB8GA1UEChMYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkggkAiX2k',
                'uyY57dEwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQUFAAOBgQB2vvY/PlHRHWNd',
                'hhNdxDtTHT6oi7rOnfZ6cAX0uUwWgPzQldlIbsgBpYQ3dueC7avCE7lxfU6Ev5Di',
                'btdcSnj4t1X8qunD6nefX98EwegJpd6RNdHwUnHCP9lRFTb6RtJEzY3Wwf/MLGOC',
                'p779AandWmwv+QgN0LiIvpnSl9QCTw==',
                '-----END CERTIFICATE-----'
            ].join('\n')
        }));
    });

    it('should attach stomp to a TCP socket', function () {
        var server = helper.injector.get('SockJS.Server');
        server.listen(require('net').createServer({ allowHalfOpen: true }));
    });
});

