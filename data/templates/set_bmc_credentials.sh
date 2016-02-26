#!/usr/bin/env bash

echo " Getting the user ID"
cmdReturn=$(sudo ipmitool user summary)
myarray=(${cmdReturn//$'\n'/ })
userNumber=${myarray[8]}
userNumber=$((userNumber + 1))
echo "number of user : $userNumber"

sudo ipmitool user set name $userNumber <%=user%>
sudo ipmitool user set password $userNumber <%=password%>
sudo ipmitool channel setaccess 1 $userNumber callin=on ipmi=on link=on privilege=4
sudo ipmitool user enable $userNumber
echo "Done"

