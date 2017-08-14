#!/usr/bin/env bash
ssdStoragePoolArr=<%=ssdStoragePoolArr%>
ssdCacheCadeArr=<%=ssdCacheCadeArr%>
type=<%=type%>
path=<%=path%>
hddArr=<%- JSON.stringify(hddArr) %>
controller=<%=controller%>

echo hddArr is: $hddArr
echo ssdStoragePoolArr is: $ssdStoragePoolArr
echo ssdCacheCadeArr is: $ssdCacheCadeArr
echo type is: $type
echo path is: $path


function create_vd_for_hdd()
{
    echo "Creating Virtual Disks For Hard Drives using hddArr"
    <% hddArr.forEach(function (value){ %>
        echo running check for Ugood before
        convertedDrivesList=(<%=value.drives.replace(/[[\],]/g,' ')%>)
        echo printing convertedListt "${convertedDrivesList[0]}"
        for i in "${convertedDrivesList[@]}"
            do
               echo inside loop $i
               cmdReturn=$(sudo /opt/MegaRAID/storcli/storcli64 /c0 /eall /sall show | grep <%=value.enclosure%>:$i)
               myarray=(${cmdReturn})
               echo ${myarray[2]}
               if [[ ${myarray[2]} == "Onln" ]]; then
                   echo "BINGO, online"
                   #vdMatch1=$(sudo /opt/MegaRAID/storcli/storcli64 /c0 /vall show | grep ${myarray[3]}\/)

                   vdMatch1=$(sudo /opt/MegaRAID/storcli/storcli64 /c0 /vall show | grep ${myarray[3]}\/ |cut -d / -f2 |cut -d " " -f1)
                   echo printing output : $vdMatch1
                   #KU: Using |grep followed by |cut with delimiters / and " " to get the number after the DG/ : that worked
                   #get the regex on vdMatch
                   # split on / and call delete
                   delete_individual_vd $vdMatch1
               fi
            done
        hardDrives=<%=value.drives.replace(/[[\]]/g,'')%>
        echo printing hardDrives: $hardDrives
        echo running: $path /c$controller add vd type=<%=value.type%> drives=<%=value.enclosure%>:<%=value.drives.replace(/[[\]]/g,'')%> direct wb ra pdcache=off
        $path /c$controller add vd type=<%=value.type%> drives=<%=value.enclosure%>:<%=value.drives.replace(/[[\]]/g,'')%> direct wb ra pdcache=off
    echo "Done Creating Virtual Disks For Hard Drives using"
    <% }); %>
}

function create_vd_for_ssd_sp()
{
    echo "Creating Virtual Disks for Solid  State Drives For Storage Pool"
    if [ ! -z $ssdStoragePoolArr ]; then
        convertedSsdStoragePoolArr=(<%= ssdStoragePoolArr.join(" ") %>)
        for i in "${convertedSsdStoragePoolArr[@]}"
            do
                echo running: $path /c$controller add vd type=$type drives=$i  direct wt ra
                $path /c$controller add vd type=$type drives=$i  direct wt ra
            done
    fi
    echo "Done creating Virtual Disks for Solid  State Drives For Storage Pool"
}


#revisit/test on Dell nodes because currently H730 mini controller does not support cachecading
# seeing SSC-spread spectrum clocking is not supported
function create_sp_for_ssd_cache()
{
    echo "Creating Virtual Disks for Solid  State Drives For Cache Cade"
    if [ ! -z ssdCacheCadeArr ]; then
        convertedSsdCacheCadeArr=(<%= ssdCacheCadeArr.join(" ") %>)
        ITER=0
        for i in "${convertedSsdCacheCadeArr[@]}"
            do
                echo running:  $path /c$controller add vd cc type=$type drives=$i WB
                $path /c$controller add vd cc type=$type drives=$i WB

                echo running: $path  /c$controller/v$i  set rdcache=nora
                $path  /c$controller/v$ITER  set rdcache=nora
                ITER=$(expr $ITER + 1)
            done

    fi
    echo "Done creating Virtual Disks for Solid  State Drives For Cache Cade"
}

function delete_vd()
{
    echo "Deleting Virtual Disks"
	for i in {0..5}
		do
		    echo running: $path /c$controller/v$i del force
		    $path /c$controller/v$i del force
        done
    echo "Done Deleting Virtual Disks"
}

function delete_individual_vd()
{
    echo "Deleting $1 Virtual Disks"
    echo running: $path /c$controller/v$1 del force
    $path /c$controller/v$1 del force
    echo "Done Deleting Virtual Disks"
}

function delete_cc()
{
    echo "Deleting CacheCade"
	for i in {0..0}
		do
		    echo running: $path /c0/v$i del cc
		    $path /c0/v$i del cc
        done
    echo "Done Deleting CacheCade"
}

#delete_vd
#delete_cc
#create_sp_for_ssd_cache
create_vd_for_hdd
#create_vd_for_ssd_sp
