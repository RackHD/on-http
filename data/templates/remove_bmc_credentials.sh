#!/usr/bin/env bash

usernames=(<%= users.join(" ") %>)

mapfile -t userlist < <(ipmitool user list)

array_len=${#userlist[@]}
if [ "$array_len" -gt  "1" ]; then
   array_len=$(expr $array_len - 1)
fi
for user in ${usernames[@]}; do
   for i in $(seq 1 $array_len); do
      if [ `echo ${userlist[i]} | grep -c $user ` -gt 0 ] ; then
         userid=(${userlist[i]//$'\n'/ })
         #Delete BMC User
         for i in {1..15}; do
            ipmitool channel setaccess $i  ${userid} callin=off ipmi=off link=off privilege=15
         done
         ipmitool user disable $userid
         ipmitool user set password $userid ""
         ipmitool user set name ${userid} ""
      fi
   done
done

