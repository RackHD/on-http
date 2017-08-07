#!/usr/bin/env bash
hddArr=<%=hddArr%>
ssdStoragePoolArr=<%=ssdStoragePoolArr%>
ssdCacheCadeArr=<%=ssdCacheCadeArr%>
echo hddArr is: $hddArr
echo ssdStoragePoolArr is: $ssdStoragePoolArr
echo ssdCacheCadeArr is: $ssdCacheCadeArr

function create_vd_for_hdd()
{
    echo "Creating Virtual Disks for Hard Drives"
    if [ ! -z "$hddArr" ]; then
    convertedHddArr=(<%= hddArr.join(" ") %>)
	for i in "${convertedHddArr[@]}"
		do
		    echo running: /opt/MegaRAID/storcli/storcli64 /c0 add vd type=raid0 drives=$i direct wb ra pdcache=off
		    /opt/MegaRAID/storcli/storcli64 /c0 add vd type=raid0 drives=$i direct wb ra pdcache=off
         done
     fi
    echo "Done Creating Virtual Disks For Hard Drives"
}


function create_vd_for_ssd_sp()
{
    echo "Creating Virtual Disks for Solid  State Drives For Storage Pool"
    if [ ! -z $ssdStoragePoolArr ]; then
        convertedSsdStoragePoolArr=(<%= ssdStoragePoolArr.join(" ") %>)
        for i in "${convertedSsdStoragePoolArr[@]}"
            do
                echo running: /opt/MegaRAID/storcli/storcli64 /c0 add vd type=raid0 drives=$i  direct wt ra
                /opt/MegaRAID/storcli/storcli64 /c0 add vd type=raid0 drives=$i  direct wt ra
            done
    fi
    echo "Done creating Virtual Disks for Solid  State Drives For Storage Pool"
}


function create_sp_for_ssd_cache()
{
    echo "Creating Virtual Disks for Solid  State Drives For Cache Cade"
    if [ ! -z ssdCacheCadeArr ]; then
        convertedSsdCacheCadeArr=(<%= ssdCacheCadeArr.join(" ") %>)
        ITER=0
        for i in "${convertedSsdCacheCadeArr[@]}"
            do
                echo running:  /opt/MegaRAID/storcli/storcli64 /c0 add vd cc type=raid0 drives=$i WB
                /opt/MegaRAID/storcli/storcli64 /c0 add vd cc type=raid0 drives=$i WB

                echo running: /opt/MegaRAID/storcli/storcli64  /c0/v$i  set rdcache=nora
                /opt/MegaRAID/storcli/storcli64  /c0/v$ITER  set rdcache=nora
                ITER=$(expr $ITER + 1)
            done
    fi
    echo "Done creating Virtual Disks for Solid  State Drives For Cache Cade"
}


function delete_vd()
{
    echo "Deleting Virtual Disks"
	for i in {1..5}
		do
		    echo running: /opt/MegaRAID/storcli/storcli64 /c0/v$i del force
		    /opt/MegaRAID/storcli/storcli64 /c0/v$i del force
        done
    echo "Done Deleting Virtual Disks"
}


function delete_cc()
{
    echo "Deleting CacheCade"
	for i in {0..0}
		do
		    echo running: /opt/MegaRAID/storcli/storcli64 /c0/v$i del cc
		    /opt/MegaRAID/storcli/storcli64 /c0/v$i del cc
        done
    echo "Done Deleting CacheCade"
}

#delete_vd
#delete_cc
create_sp_for_ssd_cache
create_vd_for_hdd
create_vd_for_ssd_sp
