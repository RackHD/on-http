// Copyright 2015, EMC, Inc.

'use strict';

var rewire = require('rewire');

describe('get_driveid script', function() {
    var getDriveId = rewire('../../../data/templates/get_driveid.js');

    //Configure for case with DVD existing and VD info doesn't exist
    var mockScsiDvd =
        '[0:0:0:0]    disk    ATA      QEMU HARDDISK    2.2.  /dev/sda\n' +
        '[1:0:0:0]    cd/dvd  QEMU     QEMU DVD-ROM     2.2.  /dev/sr0';
    var mockVdInfoDvd = '';
    var mockWwidDvd =
        'total 0\n' +
        'drwxr-xr-x 2 root root 80 Dec 22 07:31 ./\n' +
        'drwxr-xr-x 3 root root 60 Dec 22 07:31 ../\n' +
        'lrwxrwxrwx 1 root root  9 Dec 22 07:31 ata-QEMU_DVD-ROM_QM00003 -> ../../sr0\n' +
        'lrwxrwxrwx 1 root root  9 Dec 22 07:31 ata-QEMU_HARDDISK_QM00001 -> ../../sda';

    //Configure for case with SATADOM and SATA Drive
    var mockScsiStd =
        '[5:0:0:0]    disk    ATA      HUS724040ALA640  MFAO  /dev/sda\n' +
        '[6:0:0:0]   disk    ATA      32GB SATA Flash  SFDE  /dev/sdb\n' +
        '[7:2:0:0]    disk    LSI      MRROMB           4.26  /dev/sdc';
    var mockVdInfoStd =
        'total 0\n' +
        'drwxr-xr-x 2 root root 360 Dec 22 10:02 ./\n' +
        'drwxr-xr-x 5 root root 100 Dec 22 10:02 ../\n' +
        'lrwxrwxrwx 1 root root   9 Dec 24 11:05 pci-0000:03:00.0-scsi-7:2:0:0 -> ../../sdc';
    var mockWwidStd =
    //jshint ignore: start
        'total 0\n' +
        'drwxr-xr-x 2 root root 360 Dec 22 10:02 ./\n' +
        'drwxr-xr-x 5 root root 100 Dec 22 10:02 ../\n' +
        'lrwxrwxrwx 1 root root   9 Dec 22 10:03 ata-32GB_SATA-Flash_Drive_B0714226900900000016 -> ../../sdb\n' +
        'lrwxrwxrwx 1 root root  10 Dec 22 10:03 ata-32GB_SATA-Flash_Drive_B0714226900900000016-part1 -> ../../sdb1\n' +
        'lrwxrwxrwx 1 root root   9 Dec 22 10:03 ata-HUS724040ALA640_PBJY9ZJX -> ../../sda\n' +
        'lrwxrwxrwx 1 root root   9 Dec 24 11:05 scsi-3600163600196c0401e0c0e6511cec3c0 -> ../../sdc\n' +
        'lrwxrwxrwx 1 root root   9 Dec 22 10:03 wwn-0x5000cca23de98340 -> ../../sda\n' +
        'lrwxrwxrwx 1 root root   9 Dec 24 11:05 wwn-0x600163600196c0401e0c0e6511cec3c0 -> ../../sdc'; //
    //jshint ignore: end

    describe('run get driveid', function() {
        var buildDriveMap = getDriveId.__get__('buildDriveMap');

        it('should discard DVD info', function() {
            var result = buildDriveMap(mockWwidDvd, mockVdInfoDvd, mockScsiDvd);
            expect(result).to.deep.equal(JSON.stringify(
                //jshint ignore: start
                [
                    {
                        "scsiId":"0:0:0:0",
                        "virtualDisk":"",
                        "esxiWwid":"t10.ATA_____QEMU_HARDDISK________________________________________QM00001",
                        "devName":"sda",
                        "identifier":0,
                        "linuxWwid":"/dev/disk/by-id/ata-QEMU_HARDDISK_QM00001"
                    }
                ]
                //jshint ignore: end
            ));
        });

        it('should parse normal data', function() {
            var result = buildDriveMap(mockWwidStd, mockVdInfoStd, mockScsiStd);
            expect(result).to.deep.equal(JSON.stringify(
                //jshint ignore: start
                [
                    {
                        "scsiId":"6:0:0:0",
                        "virtualDisk":"",
                        "esxiWwid":"t10.ATA_____32GB_SATA2DFlash_Drive___________________B0714226900900000016",
                        "devName":"sdb",
                        "identifier":0,
                        "linuxWwid":"/dev/disk/by-id/ata-32GB_SATA-Flash_Drive_B0714226900900000016"
                    },
                    {
                        "scsiId":"5:0:0:0",
                        "virtualDisk":"",
                        "esxiWwid":"naa.5000cca23de98340",
                        "devName":"sda",
                        "identifier":1,
                        "linuxWwid":"/dev/disk/by-id/ata-HUS724040ALA640_PBJY9ZJX"
                    },
                    {
                        "scsiId":"7:2:0:0",
                        "virtualDisk":"/c7/v0",
                        "esxiWwid":"naa.600163600196c0401e0c0e6511cec3c0",
                        "devName":"sdc",
                        "identifier":2,
                        "linuxWwid":"/dev/disk/by-id/scsi-3600163600196c0401e0c0e6511cec3c0"
                    }
                ]
                //jshint ignore: end
            ));
        });

    });
});

