#!/bin/sh
mkdir -m 700 /home/<%=username%>/.ssh 
mkdir -m 700 /root/.ssh 

curl http://<%=server%>:<%=port%>/api/common/templates/renasar-ansible.pub > /root/.ssh/authorized_keys 
cp /root/.ssh/authorized_keys /home/<%=username%>/.ssh
chown -R <%=uid%>:<%=uid%> /home/<%=username%>/.ssh
