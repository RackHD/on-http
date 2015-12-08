#!/usr/bin/env node

'use strict';

var exec = require('child_process').exec;

var cmdDriveWwid = 'ls -l /dev/disk/by-id';
var cmdVdInfo = 'ls -l /dev/disk/by-path';
var cmdScsiId = 'lsscsi';
var options = {
    timeout: 10000 //10 seconds
};

/**
 * Parse the Drive WWID output
 * @param {String} idList - stdout for command 'ls -l /dev/disk/by-id'
 * @return {Object} include device name, Linux and ESXi WWIDs for each disks
 */
function parseDriveWwid(idList) {
    //idList example
    //"lrwxrwxrwx. 1 root root  9 Nov 18 20:30 ata-SATADOM-SV_3SE_20150522AA9992050085 -> ../../sdb"
    //returned string example
    // "ata-SATADOM-SV_3SE_20150522AA9992050085->../../sdb"
    var lines = idList.split('\n').map(function(line) {
        var split = line.split(/\s+/);
        return [split[8],split[10]].join('->');
    });

    //According to SCSI-3 spec, vendor specified logic unit name string is 60
    var scsiLines = [], sataLines = [], wwnLines = [], requiredStrLen = 60;
    lines.forEach(function(line){
        if ( line && !(line.match('part'))){
            var nameIndex = line.lastIndexOf('/'), idIndex = line.lastIndexOf('->');
            if (line.indexOf('scsi') === 0) {
                scsiLines.push([line.slice(nameIndex + 1), line.slice(0, idIndex)]);
            }
            else if (line.indexOf('ata') === 0) {
                sataLines.push([line.slice(nameIndex + 1), line.slice(0, idIndex)]);
            }
            else if (line.indexOf('wwn') === 0) {
                wwnLines.push([line.slice(nameIndex + 1), line.slice(0, idIndex)]);
            }
        }
    });

    //wwnLine example: wwn-0x5000cca23de9e287 -> ../../sdb
    //esxiWwn example: ["sdb", "naa.5000cca23de9e287"]
    var esxiWwn = wwnLines.map(function(wwnLine) {
        var line = wwnLine[1];
        var split = line.split(/-/);
        return [wwnLine[0], 'naa.' + split[1].slice(2)];
    });

    //ESXi SATA WWID should be ('t10.ATA_____' + VendorInfo + Sub + SerialNumber)
    //VendorInfo + Sub + SerialNumber should be 60 characters.
    //Sub is made of N(N = 60 - VendorInfo - SerialNumber) underline '_' symbols
    //ESXi SATA WWID should finally replace remaing dashs '-' with '2D', '3D' ...
    //esxiLine example:
    //["sda", "ata-32GB_SATA_Flash_Drive_B061430580090000000F"]
    //esxiSata example
    //["sda", "t10.ATA_____32GB_SATA_Flash_Drive___________________B061430580090000000F"]
    //Todo: confrim above analysis is correct for all SATA disks.
    var esxiSata = sataLines.map(function(esxiLine) {
        var line = esxiLine[1];
        var headIndex = line.indexOf('-'), snIndex = line.lastIndexOf('_');
        var headStr = ['t10.', line.slice(0, headIndex).toUpperCase(), '_____'].join(''),
            vendorStr = line.slice(headIndex + 1, snIndex + 1),
            snStr = line.slice(snIndex + 1),
            dashStr = '';
        for (var i = 0; i< requiredStrLen - vendorStr.length - snStr.length; i += 1){
            dashStr += '_';
        }
        var strLine = [headStr, vendorStr, dashStr, snStr].join('');
        //return strLine.replace('-', '2D');
        //ESXi driveid replaces Nth '-' with 'ND' like 2D, 3D
        var strArray = strLine.split('-');
        if (strArray.length !== 1) {
            strLine = strArray[0];
            for (i = 0; i < strArray.length -1; i += 1){
                strLine = [strLine, (i + 2).toString(), 'D', strArray[i + 1]].join('');
            }
        }
        return [esxiLine[0], strLine];
    });

    //If one device Name is mapped to both WWN and SATA array, use WWN element instead
    esxiWwn.forEach(function(line) {
        esxiSata.forEach(function(subline){
            if (line[0] === subline[0]){
                subline [1] = line[1];
            }
        });
    });

    //esxiLine example: ["sda", "scsi-35000c500725f45d7"]
    //esxiScsi example: ["sda", "naa.5000c500725f45d7"]
    var esxiScsi = scsiLines.map(function(esxiLine) {
        var line = esxiLine[1];
        var split = line.split(/-|_/);
        return [esxiLine[0], 'naa.' + split[1].slice(1)];
    });

    //linuxLine example: ["sda", "scsi-35000c500725f45d7"]
    //linuxParsed example: ["sda", "/dev/disk/by-id/scsi-35000c500725f45d7"]
    var linuxParsed = sataLines.concat(scsiLines).map(function(linuxLine) {
        return [linuxLine[0], '/dev/disk/by-id/' + linuxLine[1]];
    });

    return {esxiDriveIds: esxiSata.concat(esxiScsi), linuxDriveIds: linuxParsed};
}


/**
 * Parse Virtual Drive output via by-path output
 * @param {String} pathList - stdout for command 'ls -l /dev/disk/by-path'
 * @return {Array} include device name, virtual disk name and scsi ID for each disk
 */
function parseVdInfo(pathList) {
    var lines = pathList.split('\n').map(function(line) {
        var split = line.split(/\s+/);
        return [split[8],split[10]].join('->');
    });
    var pciLines = [];
    lines.forEach(function(line){
        if ( line && !(line.match('part'))){
            var nameIndex = line.lastIndexOf('/'), idIndex = line.lastIndexOf('->');
            if (line.indexOf('pci') === 0) {
                pciLines.push([line.slice(nameIndex + 1), line.slice(0,idIndex)]);
            }
        }
    });

    return pciLines.map(function(line) {
        var scsiId = line[1].slice(line[1].lastIndexOf('-') + 1), vdStr;
        if (scsiId.split(':').length === 4){
            var scsiIdArray = scsiId.split(':');
            vdStr = ['/c', scsiIdArray[0], '/v', scsiIdArray[2]].join('');
        }
        return [line[0], vdStr, scsiId];
    });
}

/**
 * Parse scsi ID output via lsscsi command
 * @param {String} lsscsiList - stdout for command 'lsscsi'
 * @return {Array} include device name and scsi info for each disk
 */
function parseScsiInfo(lsscsiList) {
    var lines = lsscsiList.split('\n');
    return lines.map(function(line) {
        if(line){
            return [line.slice(line.lastIndexOf('/') + 1).replace(' ', ''),
                line.slice(1, line.indexOf(']'))];
        }
    });
}

/**
 * Build the drive mapping table
 * @param {String} wwidData
 * @param {String} vdData
 * @param {String} scsiData
 * @return 0 if success, otherwise failed.
 */
function buildDriveMap(wwidData, vdData, scsiData) {
    var parsedWwids = parseDriveWwid(wwidData),
        scsiList = parseScsiInfo(scsiData),
        vdList = parseVdInfo(vdData);
    var linuxWwids = parsedWwids.linuxDriveIds, esxiWwids = parsedWwids.esxiDriveIds;
    var driveIds=[];
    esxiWwids.forEach(function(esxiWwid){
        var vd = '', scsiId = '', diskPath = esxiWwid[0];
        vdList.forEach(function(elem){
            if (typeof elem !== 'undefined') {
                if (elem[0] === diskPath) {
                    vd = elem[1];
                }
            }
        });
        scsiList.forEach(function(elem){
            if (typeof elem !== 'undefined'){
                if(elem[0] === diskPath){
                    scsiId = elem[1];
                }
            }
        });
        driveIds.push({"scsiId": scsiId, "virtualDisk": vd,
            "esxiWwid": esxiWwid[1], "devName": diskPath});
    });

    linuxWwids.forEach(function(linuxWwid, k){
        driveIds[k].identifier = k;
        driveIds[k].linuxWwid = linuxWwid[1];
    });
    console.log(JSON.stringify(driveIds));
    return 0;
}

function run() {
    var wwidData, vdData, scsiData;
    try {
        exec(cmdDriveWwid, options, function (err0, stdout0) {
            if (err0) {
                console.error(err0.toString());
                process.exit(1);
            }
            wwidData = stdout0;
            exec(cmdVdInfo, options, function (err1, stdout1) {
                if (err1) {
                    var errStr= "ls: cannot access /dev/disk/by-path: No such file or directory";
                    //"/dev/disk/by-path" doesn't exist means only SATADOM exists, no HDDs
                    // Ignore this error and use null string for vdData
                    if (err1.toString().search(errStr) !== -1){
                        vdData = '';
                    }
                    else {
                        console.error(err1.toString());
                        process.exit(1);
                    }
                }
                else {
                    vdData = stdout1;
                }
                exec(cmdScsiId, options, function (err2, stdout2) {
                    if (err2) {
                        console.error(err2.toString());
                        process.exit(1);
                    }
                    scsiData = stdout2;
                    if (buildDriveMap(wwidData, vdData, scsiData)) {
                        console.error('build drive map failed, wwidData=' +
                            wwidData + '\nvdData=' + vdData);
                        process.exit(1);
                    }
                    else {
                        process.exit(0);
                    }
                });
            });
        });
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}

return run();
