#!/usr/bin/env bash

channel=''
function set_channel()
{
    for i in {1..15}; do
        ipmitool user list $i &>/dev/null
        status=$?
        if [ "$status" -eq "0" ] ; then
            channel=$i
            break
        fi
    done
}
set_channel
echo "channel number is" $channel
if [ -z "${channel}" ]; then
 echo "Channel number was not set correctly, exiting script"
exit 1
fi
echo " Getting the user list"
cmdReturn=$(ipmitool user list $channel)
myarray=(${cmdReturn//$'\n'/ })
cmdReturn1=$(ipmitool user summary $channel)
myarray1=(${cmdReturn1//$'\n'/ })
userNumber=${myarray1[8]}
user=$(<%=user%>)
#The check variable is a flag to determine if the user already exists
#(1:already exist and 0:user does not exist)
check=0
#The i variable is an index to determine the userID from the cmdReturn(userList)
i=0

for x in $cmdReturn; do
   if [ <%=user%> == $x ]; then
   userNumber=${myarray[$(($i-1))]}
   echo "Username already present, overwriting existing user"
   ipmitool user set name $userNumber <%=user%>
   ipmitool user set password $userNumber <%=password%>
   ipmitool channel setaccess $channel $userNumber callin=on ipmi=on link=on privilege=4
   ipmitool user enable $userNumber
   check=$((check + 1))
  exit
  fi
  i=$((i+1))
done


if [ $check == 0 ]; then
 echo "Creating a new user"
 userNumber=$((userNumber + 1))
 ipmitool user set name $userNumber <%=user%>
 ipmitool user set password $userNumber <%=password%>
 ipmitool channel setaccess $channel $userNumber callin=on ipmi=on link=on privilege=4
 ipmitool user enable $userNumber
exit
fi
echo "Done"
