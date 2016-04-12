#!/bin/bash

# create SSH key for root
<% if (undefined !== rootSshKey) { -%>
mkdir /root/.ssh
echo <%=rootSshKey%> > /root/.ssh/authorized_keys
chown -R root:root /root/.ssh
<% } -%>

# create users and SSH key for users
<% users.forEach(function(user) { -%>
useradd -u <%=user.uid%> -m -p <%=user.encryptedPassword%> <%=user.name%>
    <%_ if (undefined !== user.sshKey) { _%>
mkdir /home/<%=user.name%>/.ssh
echo <%=user.sshKey%> > /home/<%=user.name%>/.ssh/authorized_keys
chown -R <%=user.name%>:<%=user.name%> /home/<%=user.name%>/.ssh
    <%_ } _%>
<% }); -%>
